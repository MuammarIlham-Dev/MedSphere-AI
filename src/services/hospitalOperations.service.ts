import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export interface HospitalClinician {
  doctor_id: string;
  profile_id: string;
  full_name: string;
  specialty: string | null;
  verification: string;
  clinic_enabled: boolean;
  video_enabled: boolean;
}

export const hospitalOperationsService = {
  clinicians: (hospitalId: string) =>
    unwrap<HospitalClinician[]>(supabase.rpc('get_hospital_clinicians', { p_hospital_id: hospitalId })),

  rejectBedRequest: (requestId: string, notes?: string) =>
    unwrap<any>(supabase.rpc('reject_bed_request', {
      p_request_id: requestId,
      p_review_notes: notes?.trim() || null,
    })),

  assignAdmissionDoctor: (admissionId: string, doctorId: string | null) =>
    unwrap<any>(supabase.rpc('assign_admission_doctor', {
      p_admission_id: admissionId,
      p_doctor_id: doctorId,
    })),

  transferAdmission: (admissionId: string, targetBedId: string, reason: string, notes?: string) =>
    unwrap<any>(supabase.rpc('transfer_admission', {
      p_admission_id: admissionId,
      p_target_bed_id: targetBedId,
      p_reason: reason.trim(),
      p_notes: notes?.trim() || null,
    })),

  dischargeAdmission: (admissionId: string, notes?: string) =>
    unwrap<any>(supabase.rpc('discharge_admission', {
      p_admission_id: admissionId,
      p_discharge_notes: notes?.trim() || null,
    })),
};
