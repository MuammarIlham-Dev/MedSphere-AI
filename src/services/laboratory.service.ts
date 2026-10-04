import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export interface LabWorklistItem {
  id: string;
  test_id: string;
  test_name: string;
  test_code: string;
  sample_status: string;
  collected_at: string | null;
  report_id: string | null;
  report_status: string | null;
  report_code: string | null;
}

export interface LabWorklistOrder {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  priority: string;
  status: string;
  booked_at: string;
  accepted_at: string | null;
  items: LabWorklistItem[];
}

interface LabWorklistRow {
  order_id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  priority: string;
  order_status: string;
  booked_at: string;
  accepted_at: string | null;
  test_id: string;
  test_code: string;
  test_name: string;
  sample_status: string;
  collected_at: string | null;
  report_id: string | null;
  report_status: string | null;
  report_code: string | null;
}

export const laboratoryService = {
  worklist: async (labId: string): Promise<LabWorklistOrder[]> => {
    const rows = await unwrap<LabWorklistRow[]>(
      supabase.rpc('get_laboratory_worklist', { p_lab_id: labId }),
    );

    const grouped = new Map<string, LabWorklistOrder>();
    for (const row of rows) {
      const item: LabWorklistItem = {
        id: row.order_id + ':' + row.test_id,
        test_id: row.test_id,
        test_name: row.test_name,
        test_code: row.test_code,
        sample_status: row.sample_status,
        collected_at: row.collected_at,
        report_id: row.report_id,
        report_status: row.report_status,
        report_code: row.report_code,
      };
      const existing = grouped.get(row.order_id);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      grouped.set(row.order_id, {
        id: row.order_id,
        appointment_id: row.appointment_id,
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        doctor_id: row.doctor_id,
        doctor_name: row.doctor_name,
        hospital_name: row.hospital_name,
        priority: row.priority,
        status: row.order_status,
        booked_at: row.booked_at,
        accepted_at: row.accepted_at,
        items: [item],
      });
    }
    return Array.from(grouped.values());
  },

  acceptOrder: (orderId: string) =>
    unwrap(supabase.rpc('accept_lab_order', { p_order_id: orderId })),

  advanceSample: (itemId: string) =>
    unwrap(supabase.rpc('advance_lab_sample', { p_item_id: itemId })),

  createReport: (input: { orderId: string; testId: string; result: Record<string, unknown> }) =>
    unwrap(supabase.rpc('create_lab_report', {
      p_order_id: input.orderId,
      p_test_id: input.testId,
      p_result_json: input.result,
      p_file_id: null,
    })),

  verifyReport: (reportId: string) =>
    unwrap(supabase.rpc('verify_lab_report', { p_report_id: reportId })),

  deliverReport: (reportId: string) =>
    unwrap(supabase.rpc('deliver_lab_report', { p_report_id: reportId })),
};
