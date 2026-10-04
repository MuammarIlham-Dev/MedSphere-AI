import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;

// Direct DB connection for fixtures since we don't have service_role_key in this environment
// SECURITY: Using environment variable for database connection
const DB_URL = process.env.SUPABASE_DB_URL || process.env.VITE_SUPABASE_DB_URL;
if (!DB_URL) {
  throw new Error('SUPABASE_DB_URL environment variable is required for integration tests');
}
const sql = postgres(DB_URL, { ssl: 'require' });

describe('Doctor Tier Database Integration with Fixtures', () => {

  const testPatientUserId = '11111111-2222-3333-4444-555555555555';
  let testPatientId: string;
  
  const testDoctorUserId = '66666666-7777-8888-9999-000000000000';
  let testDoctorId: string;
  let testDoctorHospitalId: string;

  beforeAll(async () => {
    // 0. Cleanup any lingering data from failed runs
    await sql`DELETE FROM public.prescription_items WHERE prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId}))`;
    await sql`DELETE FROM public.prescriptions WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    await sql`DELETE FROM public.medical_records WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    await sql`DELETE FROM public.appointment_feedback WHERE appointment_id IN (SELECT id FROM public.appointments WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId}))`;
    await sql`DELETE FROM public.appointments WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    await sql`DELETE FROM public.doctors WHERE profile_id = ${testDoctorUserId}`;
    await sql`DELETE FROM public.hospitals WHERE license_no = 'HOSP-TEST-123'`;
    await sql`DELETE FROM public.profiles WHERE id IN (${testPatientUserId}, ${testDoctorUserId})`;
    await sql`DELETE FROM auth.users WHERE id IN (${testPatientUserId}, ${testDoctorUserId})`;

    // 1. Create profiles first
    await sql`
      INSERT INTO auth.users (id, email) VALUES (${testPatientUserId}, 'test_patient@medsphere.invalid')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO public.profiles (id, full_name, role, digital_health_id)
      VALUES (${testPatientUserId}, 'Test Patient', 'citizen', 'DHI-PATIENT-123')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO auth.users (id, email) VALUES (${testDoctorUserId}, 'test_doctor@medsphere.invalid')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO public.profiles (id, full_name, role, digital_health_id)
      VALUES (${testDoctorUserId}, 'Test Doctor', 'doctor', 'DHI-DOCTOR-123')
      ON CONFLICT (id) DO NOTHING
    `;

    // 2. Create hospital
    const hospital = await sql`
      INSERT INTO public.hospitals (owner_id, name, address, type, verification, license_no)
      VALUES (${testDoctorUserId}, 'Integration Test Hospital', 'Test', 'general', 'verified', 'HOSP-TEST-123')
      RETURNING id
    `;
    testDoctorHospitalId = hospital[0]?.id;

    // 3. Create patient and doctor
    await sql`
      INSERT INTO public.patient_profiles (profile_id)
      VALUES (${testPatientUserId})
      ON CONFLICT (profile_id) DO NOTHING
    `;
    testPatientId = testPatientUserId;

    // 4. Create doctor profile and doctor
    // (Doctor profile was already created in step 1)
    const doctor = await sql`
      INSERT INTO public.doctors (profile_id, specialty, license_no, qualifications, hospital_id, experience_years, consultation_fee, verification, clinic_enabled, video_enabled)
      VALUES (${testDoctorUserId}, 'Cardiology', 'TEST-1234', ARRAY['MBBS'], ${testDoctorHospitalId}, 5, 500, 'verified', true, true)
      RETURNING id
    `;
    testDoctorId = doctor[0]?.id;

    // 4. Create a valid schedule (Wednesday, 09:00 - 17:00, 15 min slots, Clinic)
    await sql`
      INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, is_active, type)
      VALUES (${testDoctorId}, 3, '09:00', '17:00', 15, true, 'clinic')
    `;
  });

  afterAll(async () => {
    // Delete dependent records first using stable IDs
    await sql`DELETE FROM public.prescription_items WHERE prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId}))`;
    await sql`DELETE FROM public.prescriptions WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    await sql`DELETE FROM public.medical_records WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    
    await sql`DELETE FROM public.appointment_feedback WHERE appointment_id IN (SELECT id FROM public.appointments WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId}))`;
    await sql`DELETE FROM public.appointments WHERE patient_id = ${testPatientUserId} OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = ${testDoctorUserId})`;
    await sql`DELETE FROM public.doctors WHERE profile_id = ${testDoctorUserId}`;
    if (testDoctorHospitalId) {
      await sql`DELETE FROM public.hospitals WHERE id = ${testDoctorHospitalId}`;
    }
    await sql`DELETE FROM public.profiles WHERE id IN (${testPatientUserId}, ${testDoctorUserId})`;
    await sql`DELETE FROM auth.users WHERE id IN (${testPatientUserId}, ${testDoctorUserId})`;
    await sql.end();
  });

  describe('Schedule Deduplication & Constraints', () => {
    it('should reject a duplicate active schedule for the same (doctor, weekday, type)', async () => {
      let error;
      try {
        await sql`
          INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, is_active, type)
          VALUES (${testDoctorId}, 3, '10:00', '18:00', 30, true, 'clinic')
        `;
      } catch (err: any) {
        error = err;
      }
      expect(error).not.toBeUndefined();
      expect(error?.message).toMatch(/duplicate key value/i);
    });

    it('should allow a schedule with the same weekday but different type (video)', async () => {
      let error = null;
      try {
        await sql`
          INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, is_active, type)
          VALUES (${testDoctorId}, 3, '14:00', '16:00', 15, true, 'video')
        `;
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeNull();
    });
  });

  describe('Rating Protections (Local Setting)', () => {
    it('should reject manual rating updates from normal clients or admin without local setting', async () => {
      let error;
      try {
        await sql`UPDATE public.doctors SET rating_avg = 4.5 WHERE id = ${testDoctorId}`;
      } catch (err: any) {
        error = err;
      }
      expect(error).not.toBeUndefined();
      expect(error?.message).toMatch(/managed automatically/i);
    });

    it('should allow rating updates via the update_doctor_rating trigger', async () => {
      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW() - INTERVAL '1 day', 15, 'clinic', 'completed', 500, 1)
        RETURNING id
      `;

      let fbError = null;
      try {
        await sql`
          INSERT INTO public.appointment_feedback (appointment_id, rating, comment)
          VALUES (${apt[0]?.id}, 5, 'Excellent!')
        `;
      } catch (err: any) {
        fbError = err;
      }
      
      expect(fbError).toBeNull();

      const doc = await sql`SELECT rating_avg, rating_count FROM public.doctors WHERE id = ${testDoctorId}`;
      expect(Number(doc[0]?.rating_avg)).toBe(5);
      expect(Number(doc[0]?.rating_count)).toBe(1);

      // Test UPDATE
      await sql`UPDATE public.appointment_feedback SET rating = 3 WHERE appointment_id = ${apt[0]?.id}`;
      const docAfterUpdate = await sql`SELECT rating_avg, rating_count FROM public.doctors WHERE id = ${testDoctorId}`;
      expect(Number(docAfterUpdate[0]?.rating_avg)).toBe(3);
      expect(Number(docAfterUpdate[0]?.rating_count)).toBe(1);

      // Test DELETE
      await sql`DELETE FROM public.appointment_feedback WHERE appointment_id = ${apt[0]?.id}`;
      const docAfterDelete = await sql`SELECT rating_avg, rating_count FROM public.doctors WHERE id = ${testDoctorId}`;
      expect(Number(docAfterDelete[0]?.rating_avg)).toBe(0);
      expect(Number(docAfterDelete[0]?.rating_count)).toBe(0);
    });
  });

  describe('amount_charged freezing', () => {
    it('should prevent mutating amount_charged once set', async () => {
      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW() + INTERVAL '1 day', 15, 'clinic', 'booked', 500, 1)
        RETURNING id
      `;

      let error;
      try {
        await sql`UPDATE public.appointments SET amount_charged = 600 WHERE id = ${apt[0]?.id}`;
      } catch (err: any) {
        error = err;
      }
      expect(error).not.toBeUndefined();
      expect(error?.message).toMatch(/amount_charged is immutable/i);
    });
  });

  describe('RPC: book_appointment and overlaps', () => {
    it('should reject unauthorized booking (no auth)', async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
      let error;
      try {
        // Authenticate via postgres by setting the role and request.jwt.claims
        // Actually, we can just use the anon client with a valid user token if we want to test RPC!
        // But since we can't easily sign in the testPatientUserId, we can test the function via SQL directly
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testPatientUserId })}, true)`;
          
          await tx`
            SELECT book_appointment(
              ${testDoctorId},
              NULL,
              (NOW() + INTERVAL '1 day')::timestamptz,
              15,
              'clinic',
              'test'
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();
    });

    it('should successfully book an appointment and capture correct historical fee', async () => {
      let aptId: string | undefined;
      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testPatientUserId })}, true)`;
        
        // Find next Wednesday
        const apt = await tx`
          SELECT (book_appointment(
            ${testDoctorId},
            NULL,
            (date_trunc('week', now() + interval '1 week') + interval '2 days' + interval '10 hours')::timestamptz,
            15,
            'clinic',
            'test reason'
          )).id as apt_id
        `;
        aptId = apt[0]?.apt_id;
      });
      expect(aptId).toBeDefined();

      const inserted = await sql`SELECT status, amount_charged FROM public.appointments WHERE id = ${aptId!}`;
      expect(inserted[0]?.status).toBe('booked');
      expect(Number(inserted[0]?.amount_charged)).toBe(500); // Historical fee captured
    });

    it('should reject overlap', async () => {
      let error;
      try {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testPatientUserId })}, true)`;
          
          await tx`
            SELECT book_appointment(
              ${testDoctorId},
              NULL,
              (date_trunc('week', now() + interval '1 week') + interval '2 days' + interval '10 hours')::timestamptz,
              15,
              'clinic',
              'overlap reason'
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/slot is no longer available/i);
    });

    it('should reject invalid duration', async () => {
      let error;
      try {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testPatientUserId })}, true)`;
          
          await tx`
            SELECT book_appointment(
              ${testDoctorId},
              NULL,
              (date_trunc('week', now() + interval '1 week') + interval '2 days' + interval '11 hours')::timestamptz,
              200,
              'clinic',
              'too long'
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/invalid duration/i);
    });
  });

  describe('RPC: record_consultation', () => {
    it('should reject consultation from unassigned doctor', async () => {
      let error;
      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW() - INTERVAL '1 day', 15, 'clinic', 'completed', 500, 101)
        RETURNING id
      `;

      try {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          // Some other user
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testPatientUserId })}, true)`;
          
          await tx`
            SELECT record_consultation(
              ${apt[0]?.id}::uuid,
              ${'Checkup'}::text,
              ${'Fever'}::text,
              ${'Rest'}::text,
              ${null}::text,
              ${null}::jsonb
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/verified doctor required/i);
    });

    it('should rollback transaction if prescription items are invalid', async () => {
      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW(), 15, 'clinic', 'in_progress', 500, 102)
        RETURNING id
      `;

      let error;
      try {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testDoctorUserId })}, true)`;
          
          const rxItems = [
            { medicine_id: null, dosage: '1x', frequency: 'daily', duration_days: 'invalid_int', instructions: '' }
          ];

          await tx`
            SELECT record_consultation(
              ${apt[0]?.id}::uuid,
              ${'Checkup'}::text,
              ${'Fever'}::text,
              ${'Rest'}::text,
              ${'Prescription Notes'}::text,
              ${sql.json(rxItems)}
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();

      // Ensure no record or prescription was created
      const recs = await sql`SELECT COUNT(*) as count FROM public.medical_records WHERE appointment_id = ${apt[0]?.id}`;
      expect(Number(recs[0]?.count)).toBe(0);
    });

    it('should successfully record consultation and create prescription', async () => {
      const med = await sql`
        INSERT INTO public.medicines (name, form, strength, manufacturer)
        VALUES ('TestMed', 'tablet', '500mg', 'TestCo')
        RETURNING id
      `;

      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW(), 15, 'clinic', 'in_progress', 500, 103)
        RETURNING id
      `;

      let recordId: string | undefined;
      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testDoctorUserId })}, true)`;
        
        const rxItems = [
          { medicine_id: med[0]?.id, dosage: '1x', frequency: 'daily', duration_days: 5, instructions: 'After meals' }
        ];

        const result = await tx`
          SELECT record_consultation(
            ${apt[0]?.id}::uuid,
            ${'Final Checkup'}::text,
            ${'All good'}::text,
            ${'Notes'}::text,
            ${'Take meds'}::text,
            ${sql.json(rxItems)}
          )
        `;
        recordId = result[0]?.record_consultation;
      });

      expect(recordId).toBeDefined();

      // Verify medical record
      const rec = await sql`SELECT * FROM public.medical_records WHERE id = ${recordId!}`;
      expect(rec[0]?.title).toBe('Final Checkup');

      // Verify prescription
      const rx = await sql`SELECT * FROM public.prescriptions WHERE appointment_id = ${apt[0]?.id}`;
      expect(rx.length).toBe(1);

      // Verify prescription items
      const rxItem = await sql`SELECT * FROM public.prescription_items WHERE prescription_id = ${rx[0]?.id}`;
      expect(rxItem.length).toBe(1);
      expect(rxItem[0]?.duration_days).toBe(5);

      // Verify appointment is completed
      const updatedApt = await sql`SELECT status FROM public.appointments WHERE id = ${apt[0]?.id}`;
      expect(updatedApt[0]?.status).toBe('completed');
    });

    it('should reject duplicate consultations for the same appointment', async () => {
      const apt = await sql`
        INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_min, type, status, amount_charged, token_number)
        VALUES (${testPatientId}, ${testDoctorId}, NOW(), 15, 'clinic', 'in_progress', 500, 104)
        RETURNING id
      `;

      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testDoctorUserId })}, true)`;
        
        await tx`
          SELECT record_consultation(
            ${apt[0]?.id}::uuid,
            ${'First Checkup'}::text,
            ${'All good'}::text,
            ${'Notes'}::text,
            ${null}::text,
            ${null}::jsonb
          )
        `;
      });

      let error;
      try {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: testDoctorUserId })}, true)`;
          
          await tx`
            SELECT record_consultation(
              ${apt[0]?.id}::uuid,
              ${'Second Checkup'}::text,
              ${'All good'}::text,
              ${'Notes'}::text,
              ${null}::text,
              ${null}::jsonb
            )
          `;
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/already exists/i);
    });
  });
});
