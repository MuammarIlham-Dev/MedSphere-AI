export type BloodBroadcastMode = 'normal' | 'emergency';
export type BloodBroadcastResponseStatus = 'queued' | 'confirmed' | 'declined' | 'withdrawn' | 'released' | 'fulfilled';

export interface BloodBroadcast {
  request_id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_city: string | null;
  hospital_address: string | null;
  hospital_lat: number | null;
  hospital_lng: number | null;
  blood_group: import('@/types').BloodGroup;
  units: number;
  urgency: import('@/types').Urgency;
  broadcast_mode: BloodBroadcastMode;
  needed_by: string | null;
  broadcast_expires_at: string;
  donor_target_count: number | null;
  response_count: number;
  donor_committed_units?: number;
  total_covered_units?: number;
  remaining_uncovered_units?: number;
  distance_km: number | null;
}

export interface BloodBroadcastResponse {
  response_id: string;
  request_id: string;
  status: BloodBroadcastResponseStatus;
  responded_at: string;
  confirmed_at: string | null;
  units?: number;
  hospital_name: string;
  hospital_city: string | null;
  hospital_address: string | null;
  blood_group: import('@/types').BloodGroup;
  units: number;
  urgency: import('@/types').Urgency;
  broadcast_mode: BloodBroadcastMode;
  needed_by: string | null;
  broadcast_expires_at: string;
}

export interface HospitalBloodBroadcast {
  request_id: string;
  patient_name: string;
  blood_group: import('@/types').BloodGroup;
  units: number;
  units_fulfilled: number;
  urgency: import('@/types').Urgency;
  broadcast_mode: BloodBroadcastMode;
  status: import('@/types').RequestStatus;
  needed_by: string | null;
  broadcast_expires_at: string | null;
  donor_target_count: number | null;
  response_count: number;
  donor_committed_units?: number;
  remaining_uncovered_units?: number;
  broadcast_closed_at: string | null;
  created_at: string;
}

export interface HospitalBloodBroadcastResponse {
  response_id: string;
  donor_id: string;
  donor_name: string;
  donor_phone: string | null;
  donor_blood_group: import('@/types').BloodGroup;
  donor_city: string | null;
  status: BloodBroadcastResponseStatus;
  responded_at: string;
  confirmed_at: string | null;
}
