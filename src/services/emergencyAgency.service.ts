import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { publishEmergencyRealtime } from './emergencyRealtime.service';
import type {
  EmergencyAgency,
  EmergencyAgencyMembership,
  EmergencyAgencyDispatch,
  EmergencyAgencyDispatchView,
} from '@/types/emergencyAgency';

export const emergencyAgencyService = {
  myAgencies: () =>
    unwrap<EmergencyAgencyMembership[]>(
      supabase.rpc('get_my_emergency_agencies'),
    ),

  myDispatches: () =>
    unwrap<EmergencyAgencyDispatchView[]>(
      supabase.rpc('get_my_emergency_agency_dispatches'),
    ),

  operatorDispatches: (emergencyId: string) =>
    unwrap<EmergencyAgencyDispatchView[]>(
      supabase.rpc('get_emergency_agency_dispatches', { p_emergency_id: emergencyId }),
    ),

  myEmergencyResponse: (emergencyId: string) =>
    unwrap<Array<{
      dispatch_id: string;
      agency_name: string;
      agency_type: 'ems' | 'fire' | 'police' | 'rescue';
      status: 'offered' | 'acknowledged' | 'en_route' | 'on_scene' | 'completed' | 'declined' | 'timed_out' | 'cancelled';
      requested_at: string;
      responded_at: string | null;
    }>>(
      supabase.rpc('get_my_emergency_agency_response', { p_emergency_id: emergencyId }),
    ),

  dispatchRequired: async (emergencyId: string) => {
    const { data, error } = await supabase.rpc(
      'dispatch_required_emergency_agencies',
      { p_emergency_id: emergencyId },
    );
    if (error) throw error;
    void publishEmergencyRealtime('agency_dispatches_changed', emergencyId).catch(() => undefined);
    return (data ?? []) as EmergencyAgencyDispatch[];
  },

  escalate: async (emergencyId: string) => {
    const count = await unwrap<number>(
      supabase.rpc('escalate_expired_emergency_agency_dispatches', {
        p_emergency_id: emergencyId,
      }),
    );
    if (count > 0) {
      void publishEmergencyRealtime('agency_dispatches_changed', emergencyId).catch(() => undefined);
    }
    return count;
  },

  acknowledge: async (dispatchId: string, emergencyId: string) => {
    const dispatch = await unwrap<EmergencyAgencyDispatch>(
      supabase.rpc('acknowledge_emergency_agency_dispatch', { p_dispatch_id: dispatchId }),
    );
    void publishEmergencyRealtime('agency_dispatch_acknowledged', emergencyId, dispatchId).catch(() => undefined);
    return dispatch;
  },

  decline: async (dispatchId: string, emergencyId: string) => {
    const dispatch = await unwrap<EmergencyAgencyDispatch>(
      supabase.rpc('decline_emergency_agency_dispatch', { p_dispatch_id: dispatchId }),
    );
    void publishEmergencyRealtime('agency_dispatch_declined', emergencyId, dispatchId).catch(() => undefined);
    return dispatch;
  },

  resolveNonAmbulance: async (emergencyId: string) => {
    const emergency = await unwrap(
      supabase.rpc('resolve_non_ambulance_emergency', { p_emergency_id: emergencyId }),
    );
    void publishEmergencyRealtime('status_changed', emergencyId).catch(() => undefined);
    return emergency;
  },

  updateStatus: async (
    dispatchId: string,
    emergencyId: string,
    status: Extract<EmergencyAgencyDispatch['status'], 'en_route' | 'on_scene' | 'completed' | 'cancelled'>,
    notes?: string,
  ) => {
    const dispatch = await unwrap<EmergencyAgencyDispatch>(
      supabase.rpc('update_emergency_agency_dispatch', {
        p_dispatch_id: dispatchId,
        p_status: status,
        p_notes: notes ?? null,
      }),
    );
    const action = status === 'cancelled'
      ? 'agency_dispatch_cancelled'
      : 'agency_dispatch_status_changed';
    void publishEmergencyRealtime(action, emergencyId, dispatchId).catch(() => undefined);
    return dispatch;
  },

  // Administrative provisioning; actual agency creation/member assignment remains admin-only.
  createAgency: (input: {
    name: string;
    agencyType: 'ems' | 'fire' | 'police' | 'rescue';
    licenseNo: string;
    phone?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }) =>
    unwrap<EmergencyAgency>(
      supabase.rpc('admin_create_emergency_agency', {
        p_name: input.name,
        p_agency_type: input.agencyType,
        p_license_no: input.licenseNo,
        p_phone: input.phone ?? null,
        p_city: input.city ?? null,
        p_lat: input.lat ?? null,
        p_lng: input.lng ?? null,
      }),
    ),

  setMember: (agencyId: string, userId: string, active = true, memberRole = 'responder') =>
    unwrap(
      supabase.rpc('set_emergency_agency_member', {
        p_agency_id: agencyId,
        p_user_id: userId,
        p_active: active,
        p_member_role: memberRole,
      }),
    ),

  setResponderRole: (profileId: string, enabled: boolean) =>
    unwrap(
      supabase.rpc('set_emergency_responder_role', {
        p_profile_id: profileId,
        p_enabled: enabled,
      }),
    ),
};
