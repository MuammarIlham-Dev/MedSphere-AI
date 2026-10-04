import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { publishBloodRealtime } from '@/services/bloodRealtime.service';
import type { BloodBroadcast, BloodBroadcastResponse, HospitalBloodBroadcast, HospitalBloodBroadcastResponse, BloodBroadcastMode } from '@/types/bloodNetwork';
import type { BloodGroup, Urgency } from '@/types';
import type { BloodRequest } from '@/types';

export const bloodBroadcastService = {
  donorBroadcasts: () =>
    unwrap<BloodBroadcast[]>(supabase.rpc('get_blood_broadcasts_for_donor')),

  donorResponses: () =>
    unwrap<BloodBroadcastResponse[]>(supabase.rpc('get_my_blood_broadcast_responses')),

  respond: async (requestId: string) => {
    const result = await unwrap<any>(
      supabase.rpc('offer_blood_broadcast_response', { p_request_id: requestId })
    );
    void publishBloodRealtime(requestId, 'response_changed').catch(() => undefined);
    return result;
  },

  withdraw: async (responseId: string) => {
    const result = await unwrap<any>(
      supabase.rpc('withdraw_blood_broadcast_response', { p_response_id: responseId })
    );
    if (result?.request_id) {
      void publishBloodRealtime(result.request_id, 'response_changed').catch(() => undefined);
    }
    return result;
  },

  hospitalBroadcasts: (hospitalId: string) =>
    unwrap<HospitalBloodBroadcast[]>(
      supabase.rpc('get_hospital_blood_broadcasts', { p_hospital_id: hospitalId })
    ),

  hospitalResponses: (requestId: string) =>
    unwrap<HospitalBloodBroadcastResponse[]>(
      supabase.rpc('get_hospital_blood_broadcast_responses', { p_request_id: requestId })
    ),

  createHospitalBroadcast: async (input: {
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
  }) => {
    const result = await unwrap<BloodRequest>(
      supabase.rpc('create_hospital_blood_broadcast', {
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
      })
    );
    void publishBloodRealtime(result.id, 'created').catch(() => undefined);
    return result;
  },

  confirmResponse: async (responseId: string) => {
    const result = await unwrap<any>(
      supabase.rpc('confirm_blood_broadcast_response', { p_response_id: responseId })
    );
    void publishBloodRealtime(result.request_id, 'response_changed').catch(() => undefined);
    return result;
  },

  declineResponse: async (responseId: string) => {
    const result = await unwrap<any>(
      supabase.rpc('decline_blood_broadcast_response', { p_response_id: responseId })
    );
    void publishBloodRealtime(result.request_id, 'response_changed').catch(() => undefined);
    return result;
  },

  closeBroadcast: async (requestId: string) => {
    const result = await unwrap<BloodRequest>(
      supabase.rpc('close_blood_broadcast', { p_request_id: requestId })
    );
    void publishBloodRealtime(requestId, 'closed').catch(() => undefined);
    return result;
  },
};
