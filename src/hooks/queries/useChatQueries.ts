import * as Ably from 'ably';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { useState, useEffect, useRef } from 'react';
import { ablyChannel, publish } from '@/lib/ably';
import type { ChatMessage, AblyEventMap } from '@/types';
export function useChat(conversationId: string | undefined) {
  const profile = useAuthStore((s) => s.profile);
  const qc = useQueryClient();
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState<{ name: string } | null>(null);
  const [readBy, setReadBy] = useState<Record<string, string>>({});
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const history = useQuery({
    queryKey: ['chat', conversationId],
    queryFn: () => chatService.history(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId || !profile) return;
    const ch = ablyChannel(`chat:${conversationId}`);
    const onMsg = (m: Ably.Message) => {
      const { message } = m.data as AblyEventMap['chat:message'];
      if (message.sender_id !== profile.id) setLive((prev) => [...prev, message]);
    };
    const onTyping = (m: Ably.Message) => {
      const d = m.data as AblyEventMap['chat:typing'];
      if (d.userId === profile.id) return;
      setTyping(d.isTyping ? { name: d.name } : null);
    };
    const onRead = (m: Ably.Message) => {
      const d = m.data as AblyEventMap['chat:read'];
      setReadBy((prev) => ({ ...prev, [d.userId]: d.at }));
    };
    void ch.subscribe('chat:message', onMsg);
    void ch.subscribe('chat:typing', onTyping);
    void ch.subscribe('chat:read', onRead);
    return () => {
      void ch.unsubscribe('chat:message', onMsg);
      void ch.unsubscribe('chat:typing', onTyping);
      void ch.unsubscribe('chat:read', onRead);
    };
  }, [conversationId, profile]);

  const send = useMutation({
    mutationFn: (body: string) => chatService.send(conversationId!, body),
    onSuccess: (message) => {
      setLive((prev) => [...prev, message]);
      void qc.invalidateQueries({ queryKey: ['chat', conversationId] });
    },
  });

  const signalTyping = (isTyping: boolean) => {
    if (!conversationId || !profile) return;
    void publish(`chat:${conversationId}`, 'chat:typing', { userId: profile.id, name: profile.full_name, isTyping });
    if (isTyping) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => signalTyping(false), 2_500);
    }
  };

  const markRead = () => {
    if (!conversationId || !profile) return;
    void publish(`chat:${conversationId}`, 'chat:read', { userId: profile.id, at: new Date().toISOString() });
  };

  const messages = [...(history.data ?? []), ...live].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { messages, send, typing, signalTyping, markRead, readBy, isLoading: history.isLoading };
}

/** Presence: enter a channel and stream who is online. */
export function usePresence(channelName: string, data?: Record<string, unknown>) {
  const [members, setMembers] = useState<string[]>([]);
  useEffect(() => {
    const ch = ablyChannel(channelName);
    const sync = () => void ch.presence.get().then((ms) => setMembers(ms.map((m) => m.clientId)));
    void ch.presence.enter(data ?? {});
    void ch.presence.subscribe(['enter', 'leave', 'update'], sync);
    void sync();
    return () => {
      void ch.presence.leave();
      void ch.presence.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);
  return members;
}
