import { PageTransition } from '@/components/transitions/PageTransition';
import { cn, formatTime } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  IoMicOutline, IoMicOffOutline, IoVideocamOutline, IoVideocamOffOutline, 
  IoShareOutline, IoSendOutline, IoCallOutline, IoChatbubblesOutline,
  IoSettingsOutline, IoWifi
} from 'react-icons/io5';
import { useChat } from '@/hooks/queries/useChatQueries';
import { useAuthStore } from '@/stores/authStore';
import { chatService } from '@/services/chat.service';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { Appointment } from '@/types';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { 
  DailyProvider, 
  useDaily, 
  useLocalSessionId, 
  useParticipantIds, 
  useVideoTrack, 
  useAudioTrack,
  useDailyEvent
} from '@daily-co/daily-react';

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
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
          <IoVideocamOffOutline className="w-12 h-12 text-slate-500" />
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
    </>
  );
}

function CallInterface({ otherName, appointmentId }: { otherName: string, appointmentId: string }) {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const remoteId = remoteParticipantIds[0];
  
  const [duration, setDuration] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const navigate = useNavigate();

  const profile = useAuthStore((s) => s.profile);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  
  const { messages, send, typing, signalTyping, markRead, readBy } = useChat(conversationId);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!appointmentId || !profile) return;
    void (async () => {
      const appt = await unwrap<Appointment & { doctors: { profile_id: string } }>(
        supabase.from('appointments').select('*, doctors(profile_id)').eq('id', appointmentId).single()
      );
      const conv = await chatService.forAppointment(appointmentId, [appt.patient_id, appt.doctors.profile_id]);
      setConversationId(conv.id);
    })();
  }, [appointmentId, profile]);

  const toggleMic = () => {
    callObject?.setLocalAudio(!isMicOn);
    setIsMicOn(!isMicOn);
  };

  const toggleCam = () => {
    callObject?.setLocalVideo(!isCamOn);
    setIsCamOn(!isCamOn);
  };

  const leaveCall = async () => {
    await callObject?.leave();
    callObject?.destroy();
    navigate('/app');
  };

  const othersRead = Object.values(readBy).sort().pop();
  
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 p-2 lg:p-6 bg-slate-950">
      {/* Main Video Area */}
      <div className={cn(
        "relative flex-1 flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-500",
        "bg-slate-900 border border-slate-700/50"
      )}>
        {/* Remote Video */}
        {remoteId ? (
          <DailyVideo id={remoteId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center animate-pulse mb-4">
              <IoVideocamOutline className="w-8 h-8" />
            </div>
            <p>Waiting for others to join...</p>
          </div>
        )}

        {/* Top Bar Metadata */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-slate-900/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-mono text-slate-200">
                {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Remote Participant Label */}
        {remoteId && (
          <div className="absolute bottom-24 left-6 z-10 flex items-center gap-3 pointer-events-none">
            <div className="px-4 py-2 rounded-2xl bg-slate-900/70 backdrop-blur-lg border border-white/10 text-white shadow-xl">
              <span className="font-medium">{otherName}</span>
            </div>
          </div>
        )}

        {/* Local PiP Video */}
        {localSessionId && (
          <div className={cn(
            "absolute bottom-24 right-6 z-20 w-32 h-48 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-300",
            isCamOn ? "border-brand-500/50" : "border-slate-700/50"
          )}>
            <DailyVideo id={localSessionId} isLocal />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-slate-900/70 backdrop-blur-md text-[10px] text-white">
              You
            </div>
            {!isMicOn && (
              <div className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/90 text-white">
                <IoMicOffOutline className="w-3 h-3" />
              </div>
            )}
          </div>
        )}

        {/* Bottom Dock Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-3 px-6 py-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl">
            <button onClick={toggleMic} className={cn("p-3.5 rounded-2xl transition-all duration-200", isMicOn ? "bg-slate-700/50 text-white" : "bg-red-500/20 text-red-500")}>
              {isMicOn ? <IoMicOutline className="w-5 h-5" /> : <IoMicOffOutline className="w-5 h-5" />}
            </button>
            <button onClick={toggleCam} className={cn("p-3.5 rounded-2xl transition-all duration-200", isCamOn ? "bg-slate-700/50 text-white" : "bg-red-500/20 text-red-500")}>
              {isCamOn ? <IoVideocamOutline className="w-5 h-5" /> : <IoVideocamOffOutline className="w-5 h-5" />}
            </button>
            <div className="w-px h-8 bg-slate-700/50 mx-2"></div>
            <button onClick={() => setShowChat(!showChat)} className={cn("p-3.5 rounded-2xl lg:hidden", showChat ? "bg-brand-500/20 text-brand-400" : "bg-slate-700/50 text-white")}>
              <IoChatbubblesOutline className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-slate-700/50 mx-2"></div>
            <button onClick={leaveCall} className="px-6 py-3.5 rounded-2xl bg-red-600 text-white font-medium flex items-center gap-2">
              <IoCallOutline className="w-5 h-5 rotate-[135deg]" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secure Chat Panel */}
      {showChat && (
        <div className="w-full lg:w-96 flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <IoChatbubblesOutline className="text-brand-500" /> Session Chat
            </h3>
            <p className="text-xs text-slate-400 mt-1">{typing ? `${typing.name} is typing...` : 'Session chat active'}</p>
          </div>
          
          <div ref={chatScrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-950/50" onMouseEnter={markRead}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                <IoChatbubblesOutline className="w-12 h-12 opacity-20" />
                <p className="text-sm">No messages yet.</p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === profile?.id;
                return (
                  <div key={m.id} className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'ml-auto bg-brand-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm')}>
                    <p className="leading-relaxed">{m.body}</p>
                    <span className={cn('mt-1 block text-right text-[10px]', mine ? 'text-brand-200/70' : 'text-slate-500')}>
                      {formatTime(m.created_at)}
                      {mine && othersRead && othersRead >= m.created_at && ' · Read'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <form className="p-3 bg-slate-900 border-t border-slate-800" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { send.mutate(draft.trim()); setDraft(''); signalTyping(false); } }}>
            <div className="relative flex items-center">
              <input value={draft} onChange={(e) => { setDraft(e.target.value); signalTyping(true); }} placeholder="Type a message..." className="w-full bg-slate-950 border border-slate-800 rounded-full pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-brand-500" />
              <button type="submit" disabled={!draft.trim()} className="absolute right-2 p-2 rounded-full bg-brand-600 text-white disabled:bg-slate-800">
                <IoSendOutline className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ConsultationRoom() {
  const { appointmentId } = useParams();
  const profile = useAuthStore((s) => s.profile);
  
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let co: DailyCall | null = null;

    async function initDaily() {
      try {
        if (!appointmentId) throw new Error("No appointment ID");
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Request real daily.co room URL from Edge Function
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ appointmentId })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to join room");
        }
        
        const { url } = await res.json();

        co = DailyIframe.createCallObject({ url });
        setCallObject(co);
        
        // Auto-join immediately
        await co.join({ url });
      } catch (err: any) {
        console.error("Daily join error", err);
        setError(err.message || "Failed to initialize call");
      }
    }

    initDaily();

    return () => {
      if (co) {
        const safeCo = co;
        safeCo.leave().then(() => safeCo.destroy());
      }
    };
  }, [appointmentId]);

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!callObject) return <div className="p-8 text-center text-slate-400">Initializing secure room...</div>;

  const isDoctor = profile?.role === 'doctor';
  const otherName = isDoctor ? 'Patient' : 'Dr. Smith';

  return (
    <PageTransition>
      <DailyProvider callObject={callObject}>
        <CallInterface otherName={otherName} appointmentId={appointmentId!} />
      </DailyProvider>
    </PageTransition>
  );
}
