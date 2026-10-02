import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { AuditLog, Doctor, GovOverview } from '@/types';

const count = async (table: string, build?: (q: any) => any) => {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (build) q = build(q);
  return (await q).count ?? 0;
};

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

