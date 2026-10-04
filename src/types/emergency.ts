import type { AmbulanceStatus, EmergencyStatus } from '@/types';

export type EmergencyDispatchStatus =
  | 'offered'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export interface EmergencyDispatch {
  id: string;
  emergency_id: string;
  ambulance_id: string;
  operator_id: string;
  driver_id: string;
  status: EmergencyDispatchStatus;
  distance_km: number | null;
  offered_at: string;
  responded_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EmergencyDispatchCandidate {
  ambulance_id: string;
  driver_id: string;
  hospital_id: string | null;
  hospital_name: string | null;
  hospital_city: string | null;
  vehicle_no: string;
  ambulance_type: string;
  equipment: string[];
  status: AmbulanceStatus;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string;
  distance_km: number | null;
}

export interface MyAmbulance {
  ambulance_id: string;
  hospital_id: string | null;
  hospital_name: string | null;
  vehicle_no: string;
  ambulance_type: string;
  equipment: string[];
  status: AmbulanceStatus;
  current_lat: number | null;
  current_lng: number | null;
  updated_at: string;
}

export interface AmbulanceDispatchMission {
  dispatch_id: string;
  emergency_id: string;
  emergency_type: string;
  emergency_status: EmergencyStatus;
  emergency_lat: number;
  emergency_lng: number;
  emergency_address: string | null;
  hospital_id: string | null;
  hospital_name: string | null;
  dispatch_status: EmergencyDispatchStatus;
  distance_km: number | null;
  vehicle_no: string;
  ambulance_id: string;
  offered_at: string;
  accepted_at: string | null;
}

export type EmergencyRealtimeAction =
  | 'sos_created'
  | 'dispatch_offered'
  | 'dispatch_accepted'
  | 'dispatch_declined'
  | 'dispatch_cancelled'
  | 'status_changed';
