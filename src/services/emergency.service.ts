import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import { publishEmergencyLocation } from '@/lib/emergencyAbly';
import { publishEmergencyRealtime } from './emergencyRealtime.service';
import type { Emergency } from '@/types';
import type {
  AmbulanceDispatchMission,
  EmergencyDispatch,
  EmergencyDispatchCandidate,
  MyAmbulance,
} from '@/types/emergency';

const safeRealtime = (action: Parameters<typeof publishEmergencyRealtime>[0], emergencyId: string) =>
  publishEmergencyRealtime(action, emergencyId).catch(() => undefined);

const getMyAmbulance = async (): Promise<MyAmbulance | null> => {
  const { data, error } = await supabase.rpc('get_my_ambulance');
  if (error) throw error;
  return (data?.[0] as MyAmbulance | undefined) ?? null;
};

export const emergencyService = {
  async triggerSOS(input: {
    lat: number;
    lng: number;
    type?: string;
    address?: string;
    city?: string;
  }): Promise<Emergency> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');

    const emergency = await unwrap<Emergency>(
      supabase.rpc('trigger_emergency_sos', {
        p_lat: input.lat,
        p_lng: input.lng,
        p_type: input.type ?? 'medical',
        p_address: input.address ?? null,
        p_city: input.city ?? null,
      }),
    );

    void safeRealtime('sos_created', emergency.id);
    return emergency;
  },

  get: (id: string) =>
    unwrap<Emergency>(supabase.from('emergencies').select('*').eq('id', id).single()),

  myActive: async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');
    return unwrap<Emergency | null>(
      supabase
        .from('emergencies')
        .select('*')
        .eq('reporter_id', uid)
        .in('status', ['active', 'dispatched', 'on_scene', 'transporting', 'arrived'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  },

  listActive: () =>
    unwrap<Emergency[]>(
      supabase.rpc('get_emergency_operator_feed'),
    ),

  getDispatchCandidates: (emergencyId: string) =>
    unwrap<EmergencyDispatchCandidate[]>(
      supabase.rpc('get_emergency_dispatch_candidates', {
        p_emergency_id: emergencyId,
        p_limit: 8,
      }),
    ),

  getCurrentDispatch: (emergencyId: string) =>
    unwrap<EmergencyDispatch | null>(
      supabase.rpc('get_emergency_operator_dispatch', { p_emergency_id: emergencyId }),
    ),

  dispatchNearest: async (emergencyId: string) => {
    const dispatch = await unwrap<EmergencyDispatch>(
      supabase.rpc('dispatch_nearest_ambulance', { p_emergency_id: emergencyId }),
    );
    void safeRealtime('dispatch_offered', emergencyId);
    return dispatch;
  },

  acceptDispatch: async (dispatchId: string) => {
    const emergency = await unwrap<Emergency>(
      supabase.rpc('accept_emergency_dispatch', { p_dispatch_id: dispatchId }),
    );
    void safeRealtime('dispatch_accepted', emergency.id);
    return emergency;
  },

  declineDispatch: async (dispatchId: string) => {
    const result = await unwrap<EmergencyDispatch>(
      supabase.rpc('decline_emergency_dispatch', { p_dispatch_id: dispatchId }),
    );
    void safeRealtime('dispatch_declined', result.emergency_id);
    return result;
  },

  cancelDispatch: async (dispatchId: string, emergencyId: string) => {
    const result = await unwrap<EmergencyDispatch>(
      supabase.rpc('cancel_emergency_dispatch', { p_dispatch_id: dispatchId }),
    );
    void safeRealtime('dispatch_cancelled', emergencyId);
    return result;
  },

  updateStatus: async (emergencyId: string, status: Emergency['status']) => {
    const emergency = await unwrap<Emergency>(
      supabase.rpc('update_emergency_status', {
        p_emergency_id: emergencyId,
        p_status: status,
      }),
    );
    void safeRealtime('status_changed', emergency.id);
    return emergency;
  },

  getMyAmbulance,

  getMyDispatches: () =>
    unwrap<AmbulanceDispatchMission[]>(
      supabase.rpc('get_my_emergency_dispatches'),
    ),

  publishAmbulanceLocation: async (ambulanceId: string, lat: number, lng: number) => {
    await publishEmergencyLocation(ambulanceId, lat, lng);
  },
};
