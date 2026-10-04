export type EmergencyAgencyType = 'ems' | 'fire' | 'police' | 'rescue';

export type EmergencyAgencyDispatchStatus =
  | 'offered'
  | 'acknowledged'
  | 'en_route'
  | 'on_scene'
  | 'completed'
  | 'declined'
  | 'timed_out'
  | 'cancelled';

export interface EmergencyAgency {
  id: string;
  name: string;
  agency_type: EmergencyAgencyType;
  license_no: string;
  phone: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  verification: 'pending' | 'verified' | 'rejected' | 'suspended';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyAgencyDispatch {
  id: string;
  emergency_id: string;
  agency_id: string;
  requested_by: string;
  assigned_member_id: string | null;
  status: EmergencyAgencyDispatchStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  distance_km: number | null;
  requested_at: string;
  expires_at: string;
  responded_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface EmergencyAgencyDispatchView extends EmergencyAgencyDispatch {
  agency_name: string;
  agency_type: EmergencyAgencyType;
  emergency_type: string;
  emergency_status: import('@/types').EmergencyStatus;
  emergency_lat: number;
  emergency_lng: number;
  emergency_address: string | null;
}
