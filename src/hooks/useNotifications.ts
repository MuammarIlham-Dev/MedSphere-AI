import * as Ably from 'ably';
import { notificationService } from '@/services/notification.service';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ablyChannel } from '@/lib/ably';
import type { AblyEventMap } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
export function useNotifications() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.list,
    enabled: !!profile,
  });

  useEffect(() => {
    if (!profile) return;
    const channelName = `notify-db-${profile.id}-${Date.now().toString()}`;
    const db = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe();
    const ably = ablyChannel(`notify:user:${profile.id}`);
    const onPush = (msg: Ably.Message) => {
      const n = msg.data as AblyEventMap['notify:new']['notification'];
      if (n.priority === 'critical' || n.priority === 'high') toast('info', n.title);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    void ably.subscribe('notify:new', onPush);
    return () => {
      void supabase.removeChannel(db);
      ably.unsubscribe('notify:new', onPush);
    };
  }, [profile, qc, toast]);

  const unread = (query.data ?? []).filter((n) => !n.read_at).length;
  return { ...query, unread };
}
