import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { BloodBroadcast, BloodBroadcastResponse, HospitalBloodBroadcast, HospitalBloodBroadcastResponse, BloodBroadcastMode, BloodGroup, Urgency } from '@/types/bloodNetwork';
import type { BloodBank, BloodInventoryRow, BloodRequest } from '@/types';

export const bloodBroadcastService = {
  donorBroadcasts: () => unwrap<BloodBroadcast[]>(supabase.rpc('get_blood_broadcasts_for_donor')),
  donorResponses: () => unwrap<BloodBroadcastResponse[]>(supabase.rpc('get_my_blood_broadcast_responses')),
  respond: (requestId: string) =>
    unwrap(supabase.rpc('offer_blood_broadcast_response', { p_request_id: requestId })),
  withdraw: (responseId: string) =>
    unwrap(supabase.rpc('withdraw_blood_broadcast_response', { p_response_id: responseId })),

  hospitalBroadcasts: (hospitalId: string) =>
    unwrap<HospitalBloodBroadcast[]>(supabase.rpc('get_hospital_blood_broadcasts', { p_hospital_id: hospitalId })),
  hospitalResponses: (requestId: string) =>
    unwrap<HospitalBloodBroadcastResponse[]>(supabase.rpc('get_hospital_blood_broadcast_responses', { p_request_id: requestId })),
  createHospitalBroadcast: (input: {
    hospitalId: string;
    patientName: string;
    bloodGroup: BloodGroup;
    units: number;
    broadcastMode: BloodBroadcastMode;
    urgency: Urgency;
    neededBy?: string;
    durationMinutes: number;
    donorTargetCount?: number;
    notes?: string;
  }) =>
    unwrap<BloodRequest>(supabase.rpc('create_hospital_blood_broadcast', {
      p_hospital_id: input.hospitalId,
      p_patient_name: input.patientName.trim(),
      p_blood_group: input.bloodGroup,
      p_units: input.units,
      p_broadcast_mode: input.broadcastMode,
      p_urgency: input.urgency,
      p_needed_by: input.neededBy ?? null,
      p_duration_minutes: input.durationMinutes,
      p_donor_target_count: input.donorTargetCount ?? null,
      p_notes: input.notes?.trim() || null,
    })),
  confirmResponse: (responseId: string) =>
    unwrap(supabase.rpc('confirm_blood_broadcast_response', { p_response_id: responseId })),
  declineResponse: (responseId: string) =>
    unwrap(supabase.rpc('decline_blood_broadcast_response', { p_response_id: responseId })),
  closeBroadcast: (requestId: string) =>
    unwrap(supabase.rpc('close_blood_broadcast', { p_request_id: requestId })),
};
