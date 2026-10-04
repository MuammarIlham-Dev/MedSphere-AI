import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { MedicalRecord, MedicationReminder } from '@/types';

export interface LabReportSummary {
  id: string;
  report_code: string;
  status: string;
  result_json: Record<string, unknown>;
  created_at: string;
  test_name: string | null;
}

export interface RecordConsultationInput {
  appointmentId: string;
  title: string;
  diagnosis: string;
  notes: string;
  prescriptionNotes: string;
  prescriptionItems: {
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    instructions: string;
  }[];
}

export interface PrescriptionWithItems {
  id: string;
  created_at: string;
  notes: string | null;
  prescription_items: any[];
}

export const ehrService = {
  records: (patientId: string): Promise<MedicalRecord[]> =>
    unwrap<MedicalRecord[]>(supabase.from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100)),

  async prescriptions(patientId: string): Promise<PrescriptionWithItems[]> {
    const rows = await unwrap<PrescriptionWithItems[]>(
      supabase.from('prescriptions')
        .select('*, prescription_items(*, medicines(name, generic_name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    );
    return rows;
  },

  async labReports(patientId: string): Promise<LabReportSummary[]> {
    const orders = await unwrap<Array<{ id: string }>>(
      supabase.from('lab_orders').select('id').eq('patient_id', patientId).limit(100),
    );
    if (orders.length === 0) return [];

    const rows = await unwrap<Array<{ id: string; report_code: string; status: string; result_json: Record<string, unknown>; created_at: string; lab_tests?: { name: string } | { name: string }[] }>>(
      supabase.from('lab_reports')
        .select('id, report_code, status, result_json, created_at, lab_tests(name)')
        .in('order_id', orders.map((order) => order.id))
        .order('created_at', { ascending: false }),
    );
    return rows.map((row) => ({
      id: row.id,
      report_code: row.report_code,
      status: row.status,
      result_json: row.result_json,
      created_at: row.created_at,
      test_name: Array.isArray(row.lab_tests) ? (row.lab_tests[0]?.name ?? null) : (row.lab_tests?.name ?? null),
    }));
  },

  searchMedicines: (query: string) =>
    unwrap<{ id: string; name: string }[]>(
      supabase.from('medicines')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(20)
    ),

  pharmacies: () =>
    unwrap<Array<{ id: string; name: string; city: string | null }>>(
      supabase.from('pharmacies').select('id, name, city').eq('verification', 'verified').order('name').limit(100)
    ),

  prescriptionShares: (patientId: string) =>
    unwrap<any[]>(
      supabase.from('prescription_pharmacy_shares')
        .select('id, prescription_id, pharmacy_id, status, created_at, updated_at, pharmacy:pharmacy_id(id, name, city)')
        .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100)
    ).then((rows) => rows.map((row) => ({ ...row, pharmacy: Array.isArray(row.pharmacy) ? row.pharmacy[0] : row.pharmacy }))),

  sharePrescription: (prescriptionId: string, pharmacyId: string) =>
    unwrap(supabase.rpc('share_prescription_with_pharmacy', { p_prescription_id: prescriptionId, p_pharmacy_id: pharmacyId })),

  cancelPrescriptionShare: (shareId: string) =>
    unwrap(supabase.rpc('cancel_prescription_pharmacy_share', { p_share_id: shareId })),

  medicationReminders: (patientId: string): Promise<MedicationReminder[]> =>
    unwrap<MedicationReminder[]>(supabase.from('medication_reminders').select('*').eq('patient_id', patientId).order('start_date', { ascending: false })),

  createMedicationReminder: (patientId: string, input: { label: string; times: string[]; start_date: string; end_date?: string | null; is_active?: boolean }) =>
    unwrap<MedicationReminder>(supabase.from('medication_reminders').insert({
      patient_id: patientId, label: input.label, times: input.times,
      start_date: input.start_date, end_date: input.end_date ?? null, is_active: input.is_active ?? true,
    }).select().single()),

  deleteMedicationReminder: (id: string) =>
    unwrap(supabase.from('medication_reminders').delete().eq('id', id)),

  recordConsultation: async (input: RecordConsultationInput): Promise<string> => {
    const recordId = await unwrap<string>(supabase.rpc('record_consultation', {
      p_appointment_id: input.appointmentId,
      p_title: input.title,
      p_diagnosis: input.diagnosis,
      p_notes: input.notes,
      p_prescription_notes: input.prescriptionNotes || null,
      p_prescription_items: input.prescriptionItems.length > 0 ? input.prescriptionItems : null,
    }));
    return recordId;
  }
};
