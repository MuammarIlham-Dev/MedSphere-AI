export interface BloodRequestCoverage {
  request_id: string;
  units_requested: number;
  units_fulfilled: number;
  donor_committed_units: number;
  total_covered_units: number;
  remaining_uncovered_units: number;
  queued_donors: number;
  confirmed_donors: number;
}

export interface BloodBankDonorCommitment {
  response_id: string;
  request_id: string;
  donor_id: string;
  donor_name: string;
  donor_phone: string | null;
  donor_blood_group: import('@/types').BloodGroup;
  donor_city: string | null;
  units: number;
  hospital_id: string;
  hospital_name: string;
  hospital_city: string | null;
  needed_by: string | null;
  urgency: import('@/types').Urgency;
  broadcast_mode: import('@/types/bloodNetwork').BloodBroadcastMode;
  confirmed_at: string | null;
}
