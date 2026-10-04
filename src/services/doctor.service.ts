import { supabase } from '@/lib/supabase';
import { ApiError, unwrap } from '@/lib/api';
export interface TimeSlot { start: string; end: string; type: 'video' | 'clinic'; available: boolean; }

import { generateSlots } from '@/lib/utils';

import type { Doctor, DoctorCard, DoctorCredential, DoctorSearchFilters, DoctorSchedule } from '@/types';

export const doctorService = {
  async getMyDoctor(profileId: string): Promise<Doctor | null> {
    return unwrap<Doctor | null>(
      supabase.from('doctors').select('*').eq('profile_id', profileId).maybeSingle()
    );
  },

  async apply(profileId: string, data: { specialty: string; license_no: string; experience_years: number; qualifications: string[]; consultation_fee: number }) {
    return unwrap(
      supabase.from('doctors').insert({
        profile_id: profileId,
        specialty: data.specialty,
        license_no: data.license_no,
        experience_years: data.experience_years,
        qualifications: data.qualifications,
        consultation_fee: data.consultation_fee,
        verification: 'pending',
      })
    );
  },

  credentials: (): Promise<DoctorCredential[]> =>
    unwrap<DoctorCredential[]>(supabase.from('doctor_credentials')
      .select('*, file:file_id(bucket,path,mime,size_bytes)')
      .order('created_at', { ascending: false })
      .limit(50)),

  async uploadCredential(input: {
    credentialType: DoctorCredential['credential_type'];
    file: File;
    documentNumber?: string;
    issuedAt?: string;
    expiresAt?: string;
  }): Promise<DoctorCredential> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new ApiError('AUTH', 'Not signed in');
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(input.file.type)) throw new ApiError('VALIDATION', 'Credential must be a PDF, JPG, or PNG');
    if (input.file.size > 10 * 1024 * 1024) throw new ApiError('VALIDATION', 'Credential file must be 10 MB or smaller');

    const ext = input.file.type === 'application/pdf' ? 'pdf' : input.file.type === 'image/png' ? 'png' : 'jpg';
    const path = user.id + '/credentials/' + crypto.randomUUID() + '.' + ext;
    const upload = await supabase.storage.from('documents').upload(path, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const digest = await crypto.subtle.digest('SHA-256', await input.file.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

    let fileId: string | null = null;
    try {
      const fileRow = await unwrap<{ id: string }>(supabase.from('files').insert({
        owner_id: user.id,
        bucket: 'documents',
        path,
        mime: input.file.type,
        size_bytes: input.file.size,
        sha256,
        purpose: 'doctor_credential',
      }).select('id').single());

      fileId = fileRow.id;
      return await unwrap<DoctorCredential>(supabase.rpc('submit_doctor_credential', {
        p_credential_type: input.credentialType,
        p_file_id: fileRow.id,
        p_document_number: input.documentNumber || null,
        p_issued_at: input.issuedAt || null,
        p_expires_at: input.expiresAt || null,
      }));
    } catch (error) {
      await supabase.storage.from('documents').remove([path]);
      if (fileId) await supabase.from('files').delete().eq('id', fileId);
      throw error;
    }
  },

  async search(filters: DoctorSearchFilters): Promise<DoctorCard[]> {
    let q = supabase
      .from('doctors')
      .select(`*, profiles!inner(full_name, avatar_url, gender), hospitals(name, city)`)
      .eq('verification', 'verified')
      .order('rating_avg', { ascending: false })
      .limit(50);
    if (filters.specialty) q = q.eq('specialty', filters.specialty);
    if (filters.language) q = q.contains('languages', [filters.language]);
    if (filters.query) q = q.ilike('profiles.full_name', `%${filters.query}%`);
    if (filters.gender) q = q.eq('profiles.gender', filters.gender);
    if (filters.city) q = q.eq('hospitals.city', filters.city);
    if (filters.type === 'video') q = q.eq('video_enabled', true);
    if (filters.type === 'clinic') q = q.eq('clinic_enabled', true);
    interface SearchRow {
      id: string;
      specialty: string;
      experience_years: number;
      consultation_fee: number;
      rating_avg: number;
      rating_count: number;
      video_enabled: boolean;
      clinic_enabled: boolean;
      languages: string[];
      profiles: { full_name: string; avatar_url: string; gender: string };
      hospitals: { name: string; city: string } | null;
    }
    const rows = await unwrap<SearchRow[]>(q);
    return rows.map((r) => ({
      ...r,
      full_name: r.profiles.full_name,
      avatar_url: r.profiles.avatar_url,
      gender: r.profiles.gender,
      hospital_name: r.hospitals?.name ?? null,
      hospital_city: r.hospitals?.city ?? null,
      profiles: undefined,
      hospitals: undefined,
    })) as unknown as DoctorCard[];
  },

  async slots(doctorId: string, dateISO: string): Promise<TimeSlot[]> {
    const schedules = await unwrap<DoctorSchedule[]>(
      supabase.from('doctor_schedules').select('*').eq('doctor_id', doctorId).eq('is_active', true),
    );
    const dayStartISO = `${dateISO}T00:00:00+06:00`;
    const dayEndISO = `${dateISO}T23:59:59+06:00`;
    const booked = await unwrap<Array<{ scheduled_at: string }>>(
      supabase.from('appointments').select('scheduled_at').eq('doctor_id', doctorId)
        .gte('scheduled_at', dayStartISO).lte('scheduled_at', dayEndISO)
        .not('status', 'in', '("cancelled","no_show")'),
    );
    return generateSlots(schedules, booked.map((b) => b.scheduled_at), dateISO);
  },
};
