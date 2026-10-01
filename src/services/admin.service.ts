import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { AuditLog, Doctor, GovOverview } from '@/types';



export const adminService = {
  pendingDoctors: () =>
    unwrap<Doctor[]>(supabase.from('doctors').select('*').eq('verification', 'pending').order('id')),

  verifyDoctor: (id: string, approve: boolean) =>
    unwrap(supabase.from('doctors').update({ verification: approve ? 'verified' : 'rejected' }).eq('id', id).select().single()),

  auditLog: (offset = 0) =>
    unwrap<AuditLog[]>(supabase.from('audit_logs').select('*')
      .order('created_at', { ascending: false }).range(offset, offset + 49)),

  govOverview: async (): Promise<GovOverview> => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [citizens, doctors, hospitals, appointmentsToday, activeEmergencies, waitingRecipients, activeDonors] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'citizen').then(r => r.count ?? 0),
        supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('verification', 'verified').then(r => r.count ?? 0),
        supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('verification', 'verified').then(r => r.count ?? 0),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', todayStart.toISOString()).then(r => r.count ?? 0),
        supabase.from('emergencies').select('id', { count: 'exact', head: true }).in('status', ['active', 'dispatched', 'on_scene', 'transporting']).then(r => r.count ?? 0),
        supabase.from('organ_recipients').select('id', { count: 'exact', head: true }).eq('status', 'waiting').then(r => r.count ?? 0),
        supabase.from('organ_donors').select('id', { count: 'exact', head: true }).eq('status', 'active').then(r => r.count ?? 0),
      ]);
    const inv = await supabase.from('blood_inventory').select('units_available');
    const bloodUnits = ((inv.data ?? []) as Array<{ units_available: number }>).reduce((a, r) => a + r.units_available, 0);
    return { citizens, doctors, hospitals, appointmentsToday, activeEmergencies, bloodUnits, waitingRecipients, activeDonors };
  },
};

