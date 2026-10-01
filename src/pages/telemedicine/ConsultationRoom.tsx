import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { cn, formatTime } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IoMicOutline, IoVideocamOutline, IoShareOutline, IoSendOutline } from 'react-icons/io5';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/stores/authStore';
import { chatService } from '@/services/chat.service';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { Appointment } from '@/types';

export default function ConsultationRoom() {
  const { appointmentId } = useParams();
  const profile = useAuthStore((s) => s.profile);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const { messages, send, typing, signalTyping, markRead, readBy } = useChat(conversationId);

  useEffect(() => {
    if (!appointmentId || !profile) return;
    void (async () => {
      const appt = await unwrap<Appointment & { doctors: { profile_id: string } }>(
        supabase.from('appointments').select('*, doctors(profile_id)').eq('id', appointmentId).single());
      const conv = await chatService.forAppointment(appointmentId, [appt.patient_id, appt.doctors.profile_id]);
      setConversationId(conv.id);
    })();
  }, [appointmentId, profile]);

  const othersRead = Object.values(readBy).sort().pop();

  return (
    <PageTransition>
      <PageHeader title="Consultation room" subtitle="End-to-end session — video provider integration point" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex min-h-[420px] flex-col lg:col-span-2">
          <div className="relative flex flex-1 items-center justify-center rounded-t-2xl bg-slate-900">
            <div className="text-center text-slate-400">
              <IoVideocamOutline className="mx-auto h-12 w-12" />
              <p className="mt-3 text-sm font-medium text-slate-200">Video consultation</p>
              <p className="mx-auto mt-1 max-w-xs text-xs">
                Integration point: mount your provider SDK here (Daily / Twilio / 100ms). Auth, waiting room
                and session summary are already wired via appointments + chat.
              </p>
            </div>
            <span className="absolute left-4 top-4 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">● LIVE</span>
          </div>
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-4 dark:border-white/5">
            {[IoMicOutline, IoVideocamOutline, IoShareOutline].map((Icon, i) => (
              <button key={i} aria-label={['Toggle microphone', 'Toggle camera', 'Share screen'][i]}
                className="rounded-full bg-surface-muted p-3 text-slate-600 hover:bg-slate-200 dark:bg-surface-dark-muted dark:text-slate-300">
                <Icon className="h-5 w-5" />
              </button>
            ))}
            <Button variant="danger" size="sm">End session</Button>
          </div>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader title="Secure chat" subtitle={typing ? `${typing.name} is typing…` : 'Messages are encrypted in transit'} />
          <div className="flex-1 space-y-2 overflow-y-auto p-4" onMouseEnter={markRead}>
            {messages.map((m) => {
              const mine = m.sender_id === profile?.id;
              return (
                <div key={m.id} className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                  mine ? 'ml-auto bg-brand-600 text-white' : 'bg-surface-muted dark:bg-surface-dark-muted')}>
                  {m.body}
                  <span className={cn('mt-0.5 block text-right text-[10px]', mine ? 'text-brand-100' : 'text-slate-400')}>
                    {formatTime(m.created_at)}{mine && othersRead && othersRead >= m.created_at ? ' · Read' : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <form className="flex gap-2 border-t border-slate-100 p-3 dark:border-white/5"
            onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { send.mutate(draft.trim()); setDraft(''); signalTyping(false); } }}>
            <input value={draft} onChange={(e) => { setDraft(e.target.value); signalTyping(true); }}
              placeholder="Type a message…" aria-label="Message"
              className="flex-1 rounded-xl border border-slate-300 bg-surface px-3 py-2 text-sm dark:border-white/15 dark:bg-surface-dark-muted" />
            <Button type="submit" size="sm" aria-label="Send"><IoSendOutline /></Button>
          </form>
        </Card>
      </div>
    </PageTransition>
  );
}
