import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { BloodGroup, Urgency } from '@/types';

export interface HospitalBloodRequest {
  id:string; patient_name:string; blood_group:BloodGroup; units:number; units_fulfilled:number;
  urgency:Urgency; status:string; needed_by:string|null; notes:string|null; created_at:string;
}
export interface BankHospitalBloodRequest extends HospitalBloodRequest {
  hospital_id:string; hospital_name:string; city:string|null;
}

export const hospitalBloodService={
  requests:(hospitalId:string)=>unwrap<HospitalBloodRequest[]>(supabase.rpc('get_hospital_blood_requests',{p_hospital_id:hospitalId})),
  create:(hospitalId:string,input:{patientName:string;bloodGroup:BloodGroup;units:number;urgency:Urgency;neededBy?:string;notes?:string})=>
    unwrap<any>(supabase.rpc('create_hospital_blood_request',{p_hospital_id:hospitalId,p_patient_name:input.patientName,p_blood_group:input.bloodGroup,p_units:input.units,p_urgency:input.urgency,p_needed_by:input.neededBy||null,p_notes:input.notes||null})),
  cancel:(requestId:string)=>unwrap<any>(supabase.rpc('cancel_hospital_blood_request',{p_request_id:requestId})),
  bankRequests:(bankId:string)=>unwrap<BankHospitalBloodRequest[]>(supabase.rpc('get_blood_bank_hospital_requests',{p_bank_id:bankId})),
  fulfill:(requestId:string,bankId:string,units:number)=>unwrap<any>(supabase.rpc('fulfill_hospital_blood_request',{p_request_id:requestId,p_bank_id:bankId,p_units:units}))
};
