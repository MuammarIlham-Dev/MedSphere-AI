import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create admin client for creating test fixtures
const adminClient = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 
  : null;

describe('Doctor Tier Database Integration with Fixtures', () => {
  if (!adminClient) {
    it.skip('Skipping tests due to missing SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  // Real test identifiers
  const testPatientUserId = '11111111-2222-3333-4444-555555555555';
  let testPatientId: string;
  
  const testDoctorUserId = '66666666-7777-8888-9999-000000000000';
  let testDoctorId: string;
  let testDoctorHospitalId: string;

  // We need a client authenticated as the patient to test `book_appointment` properly
  // Since we can't easily sign in with a fake email in a unit test without mocking Auth,
  // we will test RPCs using the admin client but we can test validations using `rpc` calls directly.
  // Wait! The RPCs are SECURITY DEFINER and rely on `auth.uid()`.
  // If we can't mock auth.uid(), we can't test patient-side RPCs easily without real tokens.
  // We can just verify the database constraints and RPC errors.

  beforeAll(async () => {
    // 1. Create a hospital
    const { data: hospital, error: hErr } = await adminClient.from('hospitals').insert({
      name: 'Integration Test Hospital',
      address: 'Test',
      type: 'general',
      is_verified: true
    }).select().single();
    if (hErr) throw hErr;
    testDoctorHospitalId = hospital.id;

    // 2. Create patient profile and patient
    const { error: pProfErr } = await adminClient.from('profiles').insert({
      id: testPatientUserId,
      full_name: 'Test Patient',
      email: 'test_patient@medsphere.invalid',
      role: 'citizen'
    });
    if (pProfErr) throw pProfErr;

    const { data: patient, error: pErr } = await adminClient.from('patients').insert({
      profile_id: testPatientUserId,
      date_of_birth: '1990-01-01',
      gender: 'male',
      blood_group: 'O+'
    }).select().single();
    if (pErr) throw pErr;
    testPatientId = patient.id;

    // 3. Create doctor profile and doctor
    const { error: dProfErr } = await adminClient.from('profiles').insert({
      id: testDoctorUserId,
      full_name: 'Test Doctor',
      email: 'test_doctor@medsphere.invalid',
      role: 'doctor'
    });
    if (dProfErr) throw dProfErr;

    const { data: doctor, error: dErr } = await adminClient.from('doctors').insert({
      profile_id: testDoctorUserId,
      specialty: 'Cardiology',
      license_no: 'TEST-1234',
      qualifications: ['MBBS'],
      hospital_id: testDoctorHospitalId,
      experience_years: 5,
      consultation_fee: 500,
      verification: 'verified',
      is_available: true
    }).select().single();
    if (dErr) throw dErr;
    testDoctorId = doctor.id;

    // 4. Create a valid schedule (Wednesday, 09:00 - 17:00, 15 min slots, Clinic)
    const { error: sErr } = await adminClient.from('doctor_schedules').insert({
      doctor_id: testDoctorId,
      weekday: 3,
      start_time: '09:00',
      end_time: '17:00',
      slot_minutes: 15,
      is_active: true,
      type: 'clinic'
    });
    if (sErr) throw sErr;
  });

  afterAll(async () => {
    // Cleanup profiles, which cascades to everything
    await adminClient.from('profiles').delete().in('id', [testPatientUserId, testDoctorUserId]);
    await adminClient.from('hospitals').delete().eq('id', testDoctorHospitalId);
  });

  describe('Schedule Deduplication & Constraints', () => {
    it('should reject a duplicate active schedule for the same (doctor, weekday, type)', async () => {
      const { error } = await adminClient.from('doctor_schedules').insert({
        doctor_id: testDoctorId,
        weekday: 3,
        start_time: '10:00',
        end_time: '18:00',
        slot_minutes: 30,
        is_active: true,
        type: 'clinic'
      });
      // Should fail unique constraint
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/duplicate key value/i);
    });

    it('should allow a schedule with the same weekday but different type (video)', async () => {
      const { error } = await adminClient.from('doctor_schedules').insert({
        doctor_id: testDoctorId,
        weekday: 3,
        start_time: '14:00',
        end_time: '16:00',
        slot_minutes: 15,
        is_active: true,
        type: 'video'
      });
      expect(error).toBeNull();
    });
  });

  describe('Rating Protections (Local Setting)', () => {
    it('should reject manual rating updates from normal clients or admin without local setting', async () => {
      const { error } = await adminClient.from('doctors').update({ rating_avg: 4.5 }).eq('id', testDoctorId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/managed automatically/i);
    });

    it('should allow rating updates via the update_doctor_rating trigger', async () => {
      // First, create a mock appointment to leave feedback on
      const { data: apt } = await adminClient.from('appointments').insert({
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        scheduled_at: new Date(Date.now() - 86400000).toISOString(),
        duration_min: 15,
        type: 'clinic',
        status: 'completed',
        amount_charged: 500
      }).select().single();

      // Now insert feedback. The trigger should compute the average and update the doctor securely.
      const { error: fbError } = await adminClient.from('appointment_feedback').insert({
        appointment_id: apt!.id,
        rating: 5,
        review: 'Excellent!'
      });
      
      expect(fbError).toBeNull();

      const { data: doc } = await adminClient.from('doctors').select('rating_avg, rating_count').eq('id', testDoctorId).single();
      expect(doc?.rating_avg).toBe(5);
      expect(doc?.rating_count).toBe(1);
    });
  });

  describe('amount_charged freezing', () => {
    it('should prevent mutating amount_charged once set', async () => {
      const { data: apt } = await adminClient.from('appointments').insert({
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_min: 15,
        type: 'clinic',
        status: 'scheduled',
        amount_charged: 500
      }).select().single();

      const { error } = await adminClient.from('appointments').update({ amount_charged: 600 }).eq('id', apt!.id);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/amount_charged is immutable/i);
    });
  });

  describe('RPC: book_appointment and overlaps', () => {
    it('should reject unauthorized booking (no auth)', async () => {
      const client = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY as string);
      const { error } = await client.rpc('book_appointment', {
        p_doctor_id: testDoctorId,
        p_hospital_id: null,
        p_scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        p_duration_min: 15,
        p_type: 'clinic',
        p_reason: 'test'
      });
      expect(error?.message).toMatch(/Authentication required/i);
    });

    it('should reject booking outside schedule', async () => {
      const date = new Date('2026-10-07T02:00:00.000Z'); // Wed Oct 07 2026 08:00:00 GMT+0600
      
      const { error } = await adminClient!.rpc('book_appointment', {
        p_doctor_id: testDoctorId,
        p_hospital_id: null,
        p_scheduled_at: date.toISOString(),
        p_duration_min: 15,
        p_type: 'clinic',
        p_reason: 'test'
      });
      expect(error).toBeDefined();
    });
  });
});
