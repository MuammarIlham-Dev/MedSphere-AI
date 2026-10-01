import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { AppNotification } from '@/types';

export const notificationService = {
  list: () =>
    unwrap<AppNotification[]>(supabase.from('notifications').select('*')
      .order('created_at', { ascending: false }).limit(50)),
  markRead: (id: string) =>
    unwrap(supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)),
  markAllRead: (uid: string) =>
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null),
};
