import { PageTransition } from '@/components/transitions/PageTransition';
import { cn, formatTime } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoMicOutline, IoMicOffOutline, IoVideocamOutline, IoVideocamOffOutline,
  IoCallOutline, IoChatbubblesOutline, IoSendOutline, IoShieldCheckmarkOutline,
} from 'react-icons/io5';
import { useChat } from '@/hooks/queries/useChatQueries';
import { useAuthStore } from '@/stores/authStore';
import { telemedicineService, type TelemedicineJoinContext } from '@/services/telemedicine.service';
import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import { DailyProvider, useDaily, useLocalSessionId, useParticipantIds, useVideoTrack, useAudioTrack } from '@daily-co/daily-react';

function DailyVideo({ id, isLocal }: { id: string; isLocal?: boolean }) {
  const videoTrack = useVideoTrack(id);
  const audioTrack = useAudioTrack(id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && videoTrack?.persistentTrack) {
      videoRef.current.srcObject = new MediaStream([videoTrack.persistentTrack]);
    }
  }, [videoTrack?.persistentTrack]);

  useEffect(() => {
    if (audioRef.current && audioTrack?.persistentTrack && !isLocal) {
      audioRef.current.srcObject = new MediaStream([audioTrack.persistentTrack]);
    }
  }, [audioTrack?.persistentTrack, isLocal]);

  return (
    <>
      {videoTrack?.persistentTrack ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800">
          <IoVideocamOffOutline className="h-12 w-12 text-slate-500" />
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
    </>
  );
}

function CallInterface({ context }: { context: TelemedicineJoinContext }) {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: 'remote' });
  const remoteId = remoteIds[0];
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();
  const [duration, setDuration] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [finished, setFinished] = useState(false);
  const { messages, send, typing, signalTyping, markRead, readBy } = useChat(conversationId);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (!context.sessionId) return;
    let cancelled = false;
    void telemedicineService.markJoined(context.sessionId);
    void telemedicineService.conversation(context.appointmentId)
      .then((c) => { if (!cancelled) setConversationId(c.id); });
    const timer = window.setInterval(() => { void telemedicineService.heartbeat(context.sessionId); }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void telemedicineService.leave(context.sessionId);
    };
  }, [context.sessionId, context.appointmentId]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setDuration((d) => d + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  const leaveCall = async () => {
    if (finished) return;
    setFinished(true);
    await telemedicineService.leave(context.sessionId).catch(() => undefined);
    await callObject?.leave();
    callObject?.destroy();
    navigate(context.role === 'doctor' ? '/app/doctor' : '/app/appointments');
  };

  const endConsultation = async () => {
    if (context.role !== 'doctor' || finished) return;
    setFinished(true);
    finalizedRef.current = true;
    await telemedicineService.end(context.sessionId);
    await callObject?.leave();
    callObject?.destroy();
    navigate('/app/doctor');
  };

  const toggleMic = () => {
    callObject?.setLocalAudio(!isMicOn);
    setIsMicOn((v) => !v);
  };

  const toggleCam = () => {
    callObject?.setLocalVideo(!isCamOn);
    setIsCamOn((v) => !v);
  };

  const othersRead = Object.values(readBy).sort().pop();
  const otherLabel = context.otherParticipantName || 'Participant';

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 bg-slate-950 p-2 lg:flex-row lg:p-6">
      <div className="relative flex min-h-[55vh] flex-1 flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900 shadow-2xl">
        {remoteId ? (
          <DailyVideo id={remoteId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-slate-400">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 animate-pulse">
              <IoVideocamOutline className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium text-slate-200">Waiting for {otherLabel}</p>
            <p className="mt-1 max-w-md text-sm">
              You are inside the secure appointment room. The other participant can join from their own MedSphere account.
            </p>
          </div>
        )}

        <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-slate-900/90 to-transparent p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200">
              {context.role === 'doctor' ? 'Doctor' : 'Patient'} · {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
            </span>
            <span className={cn('rounded-full px-3 py-1.5 text-xs', online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300')}>
              {online ? 'Connection available' : 'Network offline'}
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
            <IoShieldCheckmarkOutline /> Secure session
          </span>
        </div>

        {localSessionId && (
          <div className="absolute bottom-24 right-6 z-20 h-48 w-32 overflow-hidden rounded-2xl border-2 border-brand-500/50 bg-slate-800 shadow-2xl md:h-64 md:w-48">
            <DailyVideo id={localSessionId} isLocal />
            <div className="absolute bottom-2 left-2 rounded-lg bg-slate-900/70 px-2 py-1 text-[10px] text-white">You</div>
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/85 px-6 py-4 shadow-2xl backdrop-blur-xl">
            <button onClick={toggleMic} aria-label="Toggle microphone" className={cn('rounded-2xl p-3.5', isMicOn ? 'bg-slate-700/60 text-white' : 'bg-red-500/20 text-red-400')}>
              {isMicOn ? <IoMicOutline /> : <IoMicOffOutline />}
            </button>
            <button onClick={toggleCam} aria-label="Toggle camera" className={cn('rounded-2xl p-3.5', isCamOn ? 'bg-slate-700/60 text-white' : 'bg-red-500/20 text-red-400')}>
              {isCamOn ? <IoVideocamOutline /> : <IoVideocamOffOutline />}
            </button>
            <div className="mx-1 h-8 w-px bg-slate-700" />
            <button onClick={() => setShowChat((v) => !v)} aria-label="Toggle chat" className="rounded-2xl bg-slate-700/60 p-3.5 text-white lg:hidden">
              <IoChatbubblesOutline />
            </button>
            {context.role === 'doctor' ? (
              <button onClick={() => void endConsultation()} className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 font-medium text-white">
                <IoCallOutline className="rotate-[135deg]" />
                <span className="hidden sm:inline">End consultation</span>
              </button>
            ) : (
              <button onClick={() => void leaveCall()} className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 font-medium text-white">
                <IoCallOutline className="rotate-[135deg]" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showChat && (
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 lg:w-96">
          <div className="border-b border-slate-800 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-slate-100"><IoChatbubblesOutline className="text-brand-500" />Session chat</h3>
            <p className="mt-1 text-xs text-slate-400">{typing ? typing.name + ' is typing...' : 'Visible only to this appointment participants'}</p>
          </div>
          <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-950/50 p-4" onMouseEnter={markRead}>
            {messages.map((m) => (
              <div key={m.id} className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.sender_id === profile?.id ? 'ml-auto rounded-tr-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-slate-800 text-slate-200')}>
                <p>{m.body}</p>
                <span className="mt-1 block text-right text-[10px] opacity-60">
                  {formatTime(m.created_at)}
                  {m.sender_id === profile?.id && othersRead && othersRead >= m.created_at ? ' · Read' : ''}
                </span>
              </div>
            ))}
            {messages.length === 0 && <div className="flex h-full items-center justify-center text-sm text-slate-500">No messages yet.</div>}
          </div>
          <form className="border-t border-slate-800 p-3" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { send.mutate(draft.trim()); setDraft(''); signalTyping(false); } }}>
            <div className="relative">
              <input value={draft} onChange={(e) => { setDraft(e.target.value); signalTyping(true); }} placeholder="Type a message…" className="w-full rounded-full border border-slate-800 bg-slate-950 py-3 pl-4 pr-12 text-sm text-slate-200 focus:outline-none focus:border-brand-500" />
              <button type="submit" disabled={!draft.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-brand-600 p-2 text-white disabled:bg-slate-800"><IoSendOutline /></button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ConsultationRoom() {
  const { appointmentId } = useParams();
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [context, setContext] = useState<TelemedicineJoinContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let co: DailyCall | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        if (!appointmentId) throw new Error('A video appointment is required');
        const session = await telemedicineService.join(appointmentId);
        if (cancelled) return;
        setContext(session);
        co = DailyIframe.createCallObject({ url: session.url });
        await co.join({ url: session.url, token: session.token });
        if (!cancelled) setCallObject(co);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to enter telemedicine session');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (co) void co.leave().then(() => co?.destroy());
    };
  }, [appointmentId]);

  if (initializing) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400">Preparing your secure telemedicine room…</div>;
  if (error || !context || !callObject) return <div className="mx-auto max-w-2xl p-8 text-center"><p className="text-lg font-semibold text-slate-900 dark:text-white">Unable to join consultation</p><p className="mt-2 text-sm text-slate-500">{error ?? 'The secure room could not be initialized.'}</p></div>;

  return <PageTransition><DailyProvider callObject={callObject}><CallInterface context={context} /></DailyProvider></PageTransition>;
}
