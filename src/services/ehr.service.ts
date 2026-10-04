import { supabase } from '@/lib/supabase';
import { ApiError, unwrap } from '@/lib/api';
import type { MedicalRecord, MedicationReminder } from '@/types';

export interface LabReportSummary {
  id: string;
  report_code: string;
  status: string;
  result_json: Record<string, unknown>;
  created_at: string;
  test_name: string | null;
  file_id: string | null;
  version_no: number;
  is_current: boolean;
  amendment_reason: string | null;
}

export interface EncounterContext {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string | null;
  scheduled_at: string;
  appointment_status: string;
  consultation_type: string;
  reason: string | null;
  patient_name: string;
  digital_health_id: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  city: string | null;
  phone: string | null;
}

export interface LabReportHistoryItem {
  report_id: string;
  report_code: string;
  version_no: number;
  status: string;
  is_current: boolean;
  result_json: Record<string, unknown>;
  file_id: string | null;
  amendment_reason: string | null;
  created_at: string;
}

export interface LabTestOption {
  id: string;
  code: string;
  name: string;
  category: string | null;
  sample_type: string | null;
  price: number;
}

export interface LaboratoryOption {
  id: string;
  name: string;
  city: string | null;
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
  vitals: Record<string, string | number>;
  subjectiveNotes: string;
  objectiveNotes: string;
  assessmentNotes: string;
  carePlan: string;
  followUpAt: string | null;
  followUpInstructions: string;
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

  encounterContext: (appointmentId: string): Promise<EncounterContext | null> =>
    unwrap<EncounterContext[]>(supabase.rpc('get_doctor_encounter_context', {
      p_appointment_id: appointmentId,
    })).then((rows) => rows[0] ?? null),

  prescriptions: async (patientId: string): Promise<PrescriptionWithItems[]> =>
    unwrap<PrescriptionWithItems[]>(
      supabase.from('prescriptions')
        .select('*, prescription_items(*, medicines(name, generic_name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
    ),

  async labReports(patientId: string): Promise<LabReportSummary[]> {
    const orders = await unwrap<Array<{ id: string }>>(
      supabase.from('lab_orders').select('id').eq('patient_id', patientId).limit(100),
    );
    if (orders.length === 0) return [];

    const rows = await unwrap<Array<{ id: string; report_code: string; status: string; result_json: Record<string, unknown>; created_at: string; file_id: string | null; version_no: number; is_current: boolean; amendment_reason: string | null; lab_tests?: { name: string } | { name: string }[] }>>(
      supabase.from('lab_reports')
        .select('id, report_code, status, result_json, created_at, file_id, version_no, is_current, amendment_reason, lab_tests(name)')
        .in('order_id', orders.map((order) => order.id))
        .eq('is_current', true)
        .order('created_at', { ascending: false }),
    );
    return rows.map((row) => ({
      id: row.id,
      report_code: row.report_code,
      status: row.status,
      result_json: row.result_json,
      created_at: row.created_at,
      test_name: Array.isArray(row.lab_tests) ? (row.lab_tests[0]?.name ?? null) : (row.lab_tests?.name ?? null),
      file_id: row.file_id,
      version_no: row.version_no,
      is_current: row.is_current,
      amendment_reason: row.amendment_reason,
    }));
  },

  openLabReportDocument: (reportId: string): Promise<string> =>
    supabase.functions.invoke<{ signedUrl: string }>('lab-report-document', { body: { reportId } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data?.signedUrl) throw new ApiError('SERVER', 'Could not open laboratory document');
        return data.signedUrl;
      }),

  labReportHistory: (reportId: string): Promise<LabReportHistoryItem[]> =>
    unwrap<LabReportHistoryItem[]>(supabase.rpc('get_lab_report_history', { p_report_id: reportId })),

  labReportAccessHistory: (reportId: string) =>
    unwrap<Array<{ accessed_at: string; accessor_name: string; accessor_role: string; access_type: string }>>(
      supabase.rpc('get_lab_report_access_history', { p_report_id: reportId }),
    ),

  labTests: (): Promise<LabTestOption[]> =>
    unwrap<LabTestOption[]>(supabase.from('lab_tests')
      .select('id, code, name, category, sample_type, price')
      .order('category')
      .order('name')
      .limit(500)),

  laboratories: (): Promise<LaboratoryOption[]> =>
    unwrap<LaboratoryOption[]>(supabase.from('laboratories')
      .select('id, name, city')
      .eq('verification', 'verified')
      .order('name')
      .limit(100)),

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

  deleteMedicationReminder: (id: string) => unwrap(supabase.from('medication_reminders').delete().eq('id', id)),

  recordConsultation: async (input: RecordConsultationInput): Promise<string> =>
    unwrap<string>(supabase.rpc('record_consultation', {
      p_appointment_id: input.appointmentId,
      p_title: input.title,
      p_diagnosis: input.diagnosis,
      p_notes: input.notes,
      p_prescription_notes: input.prescriptionNotes || null,
      p_prescription_items: input.prescriptionItems.length > 0 ? input.prescriptionItems : null,
      p_vitals: Object.keys(input.vitals).length > 0 ? input.vitals : null,
      p_subjective_notes: input.subjectiveNotes || null,
      p_objective_notes: input.objectiveNotes || null,
      p_assessment_notes: input.assessmentNotes || null,
      p_care_plan: input.carePlan || null,
      p_follow_up_at: input.followUpAt,
      p_follow_up_instructions: input.followUpInstructions || null,
    })),

  createLabOrder: (input: { appointmentId: string; labId: string; priority: string; testIds: string[] }) =>
    unwrap(supabase.rpc('create_lab_order_for_encounter', {
      p_appointment_id: input.appointmentId,
      p_lab_id: input.labId,
      p_priority: input.priority,
      p_test_ids: input.testIds,
    })),
};
