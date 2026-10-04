import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { AuditLog, Doctor, GovOverview } from '@/types';

const count = async (table: string, build?: (q: any) => any) => {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (build) q = build(q);
  return (await q).count ?? 0;
};

export const adminService = {
  pendingRoleRequests: () =>
    unwrap<Array<{ id: string; full_name: string; phone: string | null; requested_role: string; created_at: string }>>(
      supabase.from('profiles')
        .select('id,full_name,phone,requested_role,created_at')
        .eq('role', 'citizen')
        .not('requested_role', 'is', null)
        .order('created_at', { ascending: true })
        .limit(100),
    ),

  resolveRoleRequest: (profileId: string, approve: boolean) =>
    unwrap(supabase.rpc('resolve_requested_role', {
      p_profile_id: profileId,
      p_approve: approve,
    })),

  pendingDoctors: () =>
    unwrap<Doctor[]>(supabase.from('doctors').select('*').eq('verification', 'pending').order('id')),

  pendingDoctorCredentials: () =>
    unwrap<Array<any>>(supabase.from('doctor_credentials')
      .select('*, file:file_id(bucket,path,mime,size_bytes), doctors:doctor_id(id, specialty, license_no, profiles:profile_id(full_name))')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)),

  reviewDoctorCredential: (id: string, status: 'accepted' | 'rejected', notes?: string) =>
    unwrap(supabase.rpc('review_doctor_credential', {
      p_credential_id: id,
      p_status: status,
      p_notes: notes || null,
    })),

  verifyDoctor: (id: string, approve: boolean, reason?: string) =>
    unwrap(supabase.rpc('set_doctor_verification', {
      p_doctor_id: id,
      p_status: approve ? 'verified' : 'rejected',
      p_reason: reason || null,
    })),

  auditLog: (offset = 0) =>
    unwrap<AuditLog[]>(supabase.from('audit_logs').select('*')
      .order('created_at', { ascending: false }).range(offset, offset + 49)),

  govOverview: async (): Promise<GovOverview> => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [citizens, doctors, hospitals, appointmentsToday, activeEmergencies, waitingRecipients, activeDonors] =
      await Promise.all([
        count('profiles', (q) => q.eq('role', 'citizen')),
        count('doctors', (q) => q.eq('verification', 'verified')),
        count('hospitals', (q) => q.eq('verification', 'verified')),
        count('appointments', (q) => q.gte('scheduled_at', todayStart.toISOString())),
        count('emergencies', (q) => q.in('status', ['active', 'dispatched', 'on_scene', 'transporting'])),
        count('organ_recipients', (q) => q.eq('status', 'waiting')),
        count('organ_donors', (q) => q.eq('status', 'active')),
      ]);
    const inv = await supabase.from('blood_inventory').select('units_available');
    const bloodUnits = ((inv.data ?? []) as Array<{ units_available: number }>).reduce((a, r) => a + r.units_available, 0);
    return { citizens, doctors, hospitals, appointmentsToday, activeEmergencies, bloodUnits, waitingRecipients, activeDonors };
  },
};

