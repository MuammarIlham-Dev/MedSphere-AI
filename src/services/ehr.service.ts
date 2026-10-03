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
  prescriptionItems: {
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    instructions: string;
  }[];
}

export const ehrService = {
  records: (patientId: string): Promise<MedicalRecord[]> =>
    unwrap<MedicalRecord[]>(supabase.from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100)),

  async prescriptions(patientId: string) {
    const rows = await unwrap<any[]>(
      supabase.from('prescriptions')
        .select('*, prescription_items(*)')
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

  recordConsultation: async (input: RecordConsultationInput): Promise<string> => {
    // 1. Record the consultation (creates medical_records, and optionally a prescription if notes exist)
    // We force a prescription creation if there are items, even if notes are empty
    const prescriptionText = input.prescriptionNotes || (input.prescriptionItems.length > 0 ? 'Structured prescription' : '');
    
    const recordId = await unwrap(supabase.rpc('record_consultation', {
      p_appointment_id: input.appointmentId,
      p_title: input.title,
      p_diagnosis: input.diagnosis,
      p_notes: input.notes,
      p_prescription_notes: prescriptionText || null,
    }));

    // 2. If there are items, attach them to the created prescription
    if (input.prescriptionItems && input.prescriptionItems.length > 0) {
      // Find the prescription ID that was just created
      const prescs = await unwrap<{ id: string }[]>(
        supabase.from('prescriptions')
          .select('id')
          .eq('appointment_id', input.appointmentId)
          .order('created_at', { ascending: false })
          .limit(1)
      );

      if (prescs && prescs.length > 0 && prescs[0]) {
        const prescId = prescs[0].id;
        const itemsToInsert = input.prescriptionItems.map(item => ({
          prescription_id: prescId,
          medicine_id: item.medicine_id,
          dosage: item.dosage,
          frequency: item.frequency,
          duration_days: item.duration_days,
          instructions: item.instructions || null,
        }));
        
        await unwrap(supabase.from('prescription_items').insert(itemsToInsert));
      }
    }

    return recordId;
  }
};
