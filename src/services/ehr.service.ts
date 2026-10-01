import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { MedicalRecord } from '@/types';

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
}

export const ehrService = {
  records: (patientId: string): Promise<MedicalRecord[]> =>
    unwrap<MedicalRecord[]>(supabase.from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100)),

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

  recordConsultation: (input: RecordConsultationInput): Promise<string> =>
    unwrap(supabase.rpc('record_consultation', {
      p_appointment_id: input.appointmentId,
      p_title: input.title,
      p_diagnosis: input.diagnosis,
      p_notes: input.notes,
      p_prescription_notes: input.prescriptionNotes || null,
    })),
};
