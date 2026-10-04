import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export interface HospitalLabRow {
  order_id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  lab_id: string;
  lab_name: string;
  priority: string;
  order_status: string;
  booked_at: string;
  test_id: string;
  test_code: string;
  test_name: string;
  sample_status: string;
  collected_at: string | null;
  report_id: string | null;
  report_status: string | null;
  report_code: string | null;
}

export const hospitalLaboratoryService = {
  orders: (hospitalId: string) =>
    unwrap<HospitalLabRow[]>(
      supabase.rpc('get_hospital_lab_orders', { p_hospital_id: hospitalId }),
    ),
};
