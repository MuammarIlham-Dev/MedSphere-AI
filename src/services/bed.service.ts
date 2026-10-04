import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
export const bedService={
 availability:(city?:string)=>unwrap<any[]>(supabase.rpc('get_public_bed_availability',{p_city:city?.trim()||null})),
 request:(x:any)=>unwrap<any>(supabase.rpc('request_bed',{p_hospital_id:x.hospital_id,p_category:x.category,p_requested_from:x.requested_from,p_requested_until:x.requested_until??null,p_is_emergency:x.is_emergency??false,p_reason:x.reason,p_contact_name:x.contact_name,p_contact_phone:x.contact_phone})),
 cancel:(id:string)=>unwrap<any>(supabase.rpc('cancel_bed_request',{p_request_id:id})),
 my:(id:string)=>unwrap<any[]>(supabase.from('bed_requests').select('*, hospital:hospital_id(name,city)').eq('patient_id',id).order('created_at',{ascending:false})),
 beds:(id:string)=>unwrap<any[]>(supabase.from('hospital_beds').select('*').eq('hospital_id',id).order('ward_name').order('bed_number')),
 requests:(id:string)=>unwrap<any[]>(supabase.from('bed_requests').select('*').eq('hospital_id',id).order('created_at',{ascending:false})),
 reservations:(id:string)=>unwrap<any[]>(supabase.from('bed_reservations').select('*').eq('hospital_id',id).order('reserved_at',{ascending:false})),
 admissions:(id:string)=>unwrap<any[]>(supabase.from('admissions').select('*').eq('hospital_id',id).order('admitted_at',{ascending:false})),
 add:(x:any)=>unwrap<any>(supabase.rpc('create_hospital_bed',{p_hospital_id:x.hospital_id,p_ward_name:x.ward_name,p_bed_number:x.bed_number,p_category:x.category,p_citizen_visible:x.citizen_visible,p_citizen_requestable:x.citizen_requestable,p_emergency_only:x.emergency_only})),
 approve:(id:string,bedId?:string)=>unwrap<any>(supabase.rpc('approve_bed_request',{p_request_id:id,p_bed_id:bedId??null})),
 admit:(id:string)=>unwrap<any>(supabase.rpc('admit_bed_reservation',{p_reservation_id:id})),
 discharge:(id:string)=>unwrap<any>(supabase.rpc('discharge_admission',{p_admission_id:id}))};