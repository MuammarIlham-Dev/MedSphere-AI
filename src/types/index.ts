// Regenerate DB row types any time with: pnpm db:types

export type Role =
  | 'citizen' | 'doctor' | 'hospital' | 'laboratory' | 'pharmacy' | 'blood_bank'
  | 'organ_authority' | 'ambulance_driver' | 'emergency_operator' | 'government'
  | 'researcher' | 'volunteer' | 'admin' | 'super_admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type BloodGroup = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';
export type Gender = 'male' | 'female' | 'other';
export type ConsultationType = 'video' | 'clinic';
export type AppointmentStatus =
  | 'booked' | 'confirmed' | 'checked_in' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export type Urgency = 'low' | 'standard' | 'high' | 'critical';
export type OrganType = 'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas' | 'cornea' | 'bone_marrow';
export type MatchStatus = 'proposed' | 'under_review' | 'accepted' | 'rejected' | 'transplanted' | 'expired';
export type RequestStatus = 'open' | 'fulfilled' | 'partially_fulfilled' | 'cancelled' | 'expired';
export type EmergencyStatus = 'active' | 'dispatched' | 'on_scene' | 'transporting' | 'arrived' | 'resolved' | 'cancelled';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type PartyStatus = 'active' | 'waiting' | 'matched' | 'transplanted' | 'inactive' | 'deceased';
export type AmbulanceStatus = 'available' | 'dispatched' | 'busy' | 'maintenance' | 'offline';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  dob: string | null;
  gender: Gender | null;
  blood_group: BloodGroup | null;
  avatar_url: string | null;
  digital_health_id: string;
  address: string | null;
  city: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  emergency_contacts: EmergencyContact[];
  mfa_enabled: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact { name: string; phone: string; relation: string }

export interface Hospital {
  id: string;
  owner_id: string;
  name: string;
  license_no: string;
  type: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  bed_capacity: number;
  beds_available: number;
  icu_capacity: number;
  icu_available: number;
  ot_count: number;
  emergency_capacity: number;
  verification: VerificationStatus;
}

export interface Doctor {
  id: string;
  profile_id: string;
  hospital_id: string | null;
  specialty: string;
  qualifications: string[];
  languages: string[];
  experience_years: number;
  license_no: string;
  consultation_fee: number;
  video_enabled: boolean;
  clinic_enabled: boolean;
  bio: string | null;
  rating_avg: number;
  rating_count: number;
  verification: VerificationStatus;
}

/** Doctor card as returned by searchDoctors (joined shape). */
export interface DoctorCard extends Doctor {
  full_name: string;
  avatar_url: string | null;
  gender: Gender | null;
  hospital_name: string | null;
  hospital_city: string | null;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  weekday: number; // 0=Sun
  start_time: string;
  end_time: string;
  slot_minutes: number;
  type: ConsultationType;
  is_active: boolean;
}

export interface TimeSlot { start: string; end: string; type: ConsultationType; available: boolean }

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string | null;
  scheduled_at: string;
  day: string;
  duration_min: number;
  type: ConsultationType;
  status: AppointmentStatus;
  token_number: number;
  reason: string | null;
  cancel_reason: string | null;
  created_at: string;
  // joined display fields (optional)
  doctor_name?: string;
  specialty?: string;
  patient_name?: string;
}

export interface MedicationReminder {
  id: string;
  patient_id: string;
  label: string;
  times: string[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  type: 'consultation' | 'diagnosis' | 'surgery' | 'vaccination' | 'allergy' | 'lab' | 'imaging' | 'note';
  title: string;
  diagnosis: string | null;
  notes: string | null;
  vitals: Record<string, string | number>;
  attachments: string[];
  created_at: string;
}

export interface BloodBank {
  id: string;
  owner_id: string;
  hospital_id: string | null;
  name: string;
  city: string | null;
  phone: string | null;
  verification: VerificationStatus;
}

export interface BloodInventoryRow {
  bank_id: string;
  blood_group: BloodGroup;
  units_available: number;
  units_reserved: number;
  updated_at: string;
}

export interface BloodRequest {
  id: string;
  requester_id: string;
  hospital_id: string | null;
  patient_name: string;
  blood_group: BloodGroup;
  units: number;
  urgency: Urgency;
  status: RequestStatus;
  needed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrganDonor {
  id: string;
  profile_id: string;
  blood_group: BloodGroup;
  hla: string[];
  organs: OrganType[];
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  medical_eligibility: string | null;
  consent: 'pending' | 'granted' | 'withdrawn';
  consent_file_id: string | null;
  is_deceased_registry: boolean;
  status: PartyStatus;
  registered_at: string;
  full_name?: string;
}

export interface OrganRecipient {
  id: string;
  profile_id: string;
  hospital_id: string | null;
  blood_group: BloodGroup;
  hla: string[];
  organ_needed: OrganType;
  urgency: Urgency;
  priority_score: number;
  diagnosis: string | null;
  age: number | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  waiting_since: string;
  status: PartyStatus;
  full_name?: string;
}

export interface OrganMatch {
  id: string;
  donor_id: string;
  recipient_id: string;
  organ: OrganType;
  compatibility_score: number; // 0–100, explainable components below
  blood_compatible: boolean;
  hla_score: number;           // 0–36
  distance_km: number | null;
  status: MatchStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  donor_name?: string;
  recipient_name?: string;
  recipient_priority?: number;
}

export interface Ambulance {
  id: string;
  hospital_id: string | null;
  driver_id: string | null;
  vehicle_no: string;
  type: string;
  equipment: string[];
  status: AmbulanceStatus;
  current_lat: number | null;
  current_lng: number | null;
  updated_at: string;
}

export interface Emergency {
  id: string;
  reporter_id: string;
  type: string;
  status: EmergencyStatus;
  lat: number;
  lng: number;
  address: string | null;
  assigned_ambulance_id: string | null;
  assigned_hospital_id: string | null;
  log: Array<{ at: string; event: string; by?: string }>;
  created_at: string;
  resolved_at: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  appointment_id: string | null;
  subject: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: string[];
  created_at: string;
  edited_at: string | null;
  optimistic?: boolean;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DoctorSearchFilters {
  query?: string;
  specialty?: string;
  city?: string;
  language?: string;
  gender?: Gender;
  type?: ConsultationType;
  availableOn?: string; // ISO date
}

export interface BookAppointmentInput {
  doctor_id: string;
  hospital_id?: string | null;
  scheduled_at: string;
  duration_min: number;
  type: ConsultationType;
  reason?: string;
}

export interface RegisterDonorInput {
  blood_group: BloodGroup;
  hla: string[];
  organs: OrganType[];
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  city?: string;
  medical_eligibility?: string;
  consent_file_id?: string;
}

export interface RegisterRecipientInput {
  blood_group: BloodGroup;
  hla: string[];
  organ_needed: OrganType;
  urgency: Urgency;
  diagnosis?: string;
  age?: number;
  city?: string;
  hospital_id?: string;
}

export interface GovOverview {
  citizens: number;
  doctors: number;
  hospitals: number;
  appointmentsToday: number;
  activeEmergencies: number;
  bloodUnits: number;
  waitingRecipients: number;
  activeDonors: number;
}

export interface OrganStats {
  donors: number;
  waiting: number;
  proposed: number;
  accepted: number;
  transplanted: number;
  byOrgan: Array<{ organ: OrganType; waiting: number }>;
}

export type AblyEventMap = {
  'chat:message': { message: ChatMessage };
  'chat:typing': { userId: string; name: string; isTyping: boolean };
  'chat:read': { userId: string; at: string };
  'notify:new': { notification: Pick<AppNotification, 'type' | 'title' | 'body' | 'priority'> };
  'sos:new': { emergency: Emergency };
  'sos:update': { id: string; status: EmergencyStatus };
  'track:loc': { ambulanceId: string; lat: number; lng: number; at: string };
  'queue:update': { doctorId: string; currentToken: number };
};

export const BLOOD_GROUPS: readonly BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
export const ORGAN_TYPES: readonly OrganType[] = ['kidney', 'liver', 'heart', 'lung', 'pancreas', 'cornea', 'bone_marrow'];
export const URGENCY_LEVELS: readonly Urgency[] = ['low', 'standard', 'high', 'critical'];
export const SPECIALTIES = [
  'Cardiology', 'Dermatology', 'Endocrinology', 'ENT', 'Gastroenterology',
  'General Medicine', 'Gynecology', 'Nephrology', 'Neurology', 'Oncology',
  'Ophthalmology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology',
  'Radiology', 'Surgery', 'Urology',
] as const;
export const LANGUAGES = ['English', 'Bengali', 'Hindi', 'Urdu', 'Arabic'] as const;

/** Donor → recipient blood compatibility (mirrors SQL blood_compatible). */
export const BLOOD_COMPAT: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};