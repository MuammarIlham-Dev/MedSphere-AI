import { Button } from '@/components/ui/Button';
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

export default function ConsultationRoom() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(true);
  
  const { messages, send, typing, signalTyping, markRead, readBy } = useChat(conversationId);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  const othersRead = Object.values(readBy).sort().pop();
  const isDoctor = profile?.role === 'doctor';
  const otherName = isDoctor ? 'Patient' : 'Dr. Smith'; // Fallback if we don't fetch the exact name

  return (
    <PageTransition>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 p-2 lg:p-6 bg-slate-950">
        
        {/* Main Video Area */}
        <div className={cn(
          "relative flex-1 flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-500",
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50"
        )}>
          {/* Remote Video (Simulated) */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-30 mix-blend-luminosity"></div>
          
          {/* Subtle animated pulse for active speaker */}
          <div className="absolute inset-0 bg-brand-500/10 animate-pulse mix-blend-overlay"></div>

          {/* Top Bar Metadata */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-slate-900/80 to-transparent">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs font-mono text-slate-200">{formatDuration(duration)}</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs text-slate-200">
                <IoWifi className="text-emerald-400" />
                HD
              </div>
            </div>
          </div>

          {/* Remote Participant Label */}
          <div className="absolute bottom-24 left-6 z-10 flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-slate-900/70 backdrop-blur-lg border border-white/10 text-white shadow-xl">
              <span className="font-medium">{otherName}</span>
            </div>
          </div>

          {/* Local PiP Video */}
          <div className={cn(
            "absolute bottom-24 right-6 z-20 w-32 h-48 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-300",
            isCamOn ? "border-brand-500/50" : "border-slate-700/50"
          )}>
            {isCamOn ? (
              <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <IoVideocamOffOutline className="w-8 h-8 text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-slate-900/70 backdrop-blur-md text-[10px] text-white">
              You
            </div>
            {!isMicOn && (
              <div className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/90 text-white">
                <IoMicOffOutline className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Bottom Dock Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="flex items-center gap-3 px-6 py-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl">
              <button 
                onClick={() => setIsMicOn(!isMicOn)}
                className={cn(
                  "p-3.5 rounded-2xl transition-all duration-200 hover:scale-105",
                  isMicOn ? "bg-slate-700/50 text-white hover:bg-slate-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                )}
              >
                {isMicOn ? <IoMicOutline className="w-5 h-5" /> : <IoMicOffOutline className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={() => setIsCamOn(!isCamOn)}
                className={cn(
                  "p-3.5 rounded-2xl transition-all duration-200 hover:scale-105",
                  isCamOn ? "bg-slate-700/50 text-white hover:bg-slate-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                )}
              >
                {isCamOn ? <IoVideocamOutline className="w-5 h-5" /> : <IoVideocamOffOutline className="w-5 h-5" />}
              </button>

              <div className="w-px h-8 bg-slate-700/50 mx-2"></div>

              <button className="p-3.5 rounded-2xl bg-slate-700/50 text-white hover:bg-slate-700 transition-all duration-200 hover:scale-105">
                <IoShareOutline className="w-5 h-5" />
              </button>
              
              <button className="p-3.5 rounded-2xl bg-slate-700/50 text-white hover:bg-slate-700 transition-all duration-200 hover:scale-105">
                <IoSettingsOutline className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setShowChat(!showChat)}
                className={cn(
                  "p-3.5 rounded-2xl transition-all duration-200 hover:scale-105 lg:hidden",
                  showChat ? "bg-brand-500/20 text-brand-400" : "bg-slate-700/50 text-white"
                )}
              >
                <IoChatbubblesOutline className="w-5 h-5" />
              </button>

              <div className="w-px h-8 bg-slate-700/50 mx-2"></div>

              <button 
                onClick={() => navigate('/app')}
                className="px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:scale-105 flex items-center gap-2 font-medium"
              >
                <IoCallOutline className="w-5 h-5 rotate-[135deg]" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secure Chat Panel */}
        {showChat && (
          <div className="w-full lg:w-96 flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden shrink-0 animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <IoChatbubblesOutline className="text-brand-500" />
                Session Chat
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {typing ? `${typing.name} is typing...` : 'End-to-end encrypted'}
              </p>
            </div>
            
            <div 
              ref={chatScrollRef}
              className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-950/50" 
              onMouseEnter={markRead}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <IoChatbubblesOutline className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No messages yet.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === profile?.id;
                  return (
                    <div 
                      key={m.id} 
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm animate-in fade-in slide-in-from-bottom-2',
                        mine 
                          ? 'ml-auto bg-brand-600 text-white rounded-tr-sm' 
                          : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                      )}
                    >
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

            <form 
              className="p-3 bg-slate-900 border-t border-slate-800"
              onSubmit={(e) => { 
                e.preventDefault(); 
                if (draft.trim()) { 
                  send.mutate(draft.trim()); 
                  setDraft(''); 
                  signalTyping(false); 
                } 
              }}
            >
              <div className="relative flex items-center">
                <input 
                  value={draft} 
                  onChange={(e) => { setDraft(e.target.value); signalTyping(true); }}
                  placeholder="Type a message..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-full pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
                <button 
                  type="submit" 
                  disabled={!draft.trim()}
                  className="absolute right-2 p-2 rounded-full bg-brand-600 text-white disabled:bg-slate-800 disabled:text-slate-600 transition-colors"
                >
                  <IoSendOutline className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
