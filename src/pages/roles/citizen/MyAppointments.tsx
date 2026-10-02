import { useState, useMemo } from 'react';
import { useMyAppointments, useUpdateAppointmentStatus } from '@/hooks/queries/useAppointmentQueries';
import { Card } from '@/components/ui/Card';
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/transitions/PageTransition';
import { Badge } from '@/components/ui/Badge';
import { formatTime } from '@/lib/utils';
import { CalendarDays, Clock, MapPin, Video, Stethoscope, Hash, XCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '@/types';

export default function MyAppointments() {
  const { data: appointments, isLoading } = useMyAppointments();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const navigate = useNavigate();

  const updateStatus = useUpdateAppointmentStatus();

  const { upcoming, past } = useMemo(() => {
    const all = appointments || [];
    const now = new Date();
    
    return {
      upcoming: all.filter(a => {
        if (a.status === 'cancelled' || a.status === 'completed') return false;
        const aptDate = new Date(a.scheduled_at);
        return aptDate >= now || (aptDate.toDateString() === now.toDateString());
      }),
      past: all.filter(a => {
        if (a.status === 'cancelled' || a.status === 'completed') return true;
        const aptDate = new Date(a.scheduled_at);
        return aptDate < now && aptDate.toDateString() !== now.toDateString();
      })
    };
  }, [appointments]);

  const displayList = activeTab === 'upcoming' ? upcoming : past;

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      updateStatus.mutate({ id, status: 'cancelled', reason: 'Cancelled by patient' });
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl">
        <PageHeader 
          title="My Appointments" 
          subtitle="Manage your upcoming consultations and view past visits" 
        />

        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'upcoming' 
                ? 'border-[#1a4a8d] text-[#1a4a8d] dark:border-brand-400 dark:text-brand-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'past' 
                ? 'border-[#1a4a8d] text-[#1a4a8d] dark:border-brand-400 dark:text-brand-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Past & Cancelled ({past.length})
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
          </div>
        ) : displayList.length === 0 ? (
          <EmptyState 
            title={activeTab === 'upcoming' ? "No upcoming appointments" : "No past appointments"} 
            hint={activeTab === 'upcoming' ? "Book a new consultation from the hospital directory." : "You haven't had any appointments yet."}
          />
        ) : (
          <div className="grid gap-4">
            {displayList.map(apt => (
              <AppointmentCard 
                key={apt.id} 
                appointment={apt} 
                isPast={activeTab === 'past'} 
                onCancel={() => handleCancel(apt.id)}
                onJoin={() => navigate(`/app/consult/${apt.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function AppointmentCard({ appointment: a, isPast, onCancel, onJoin }: { appointment: Appointment, isPast: boolean, onCancel: () => void, onJoin: () => void }) {
  const date = new Date(a.scheduled_at);
  const isToday = date.toDateString() === new Date().toDateString();
  
  const getStatusBadge = () => {
    switch(a.status) {
      case 'cancelled': return <Badge tone="danger"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      case 'completed': return <Badge tone="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'in_progress': return <Badge tone="brand"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'checked_in': return <Badge tone="info"><CheckCircle2 className="w-3 h-3 mr-1" /> Checked In</Badge>;
      default: return <Badge tone="neutral">Booked</Badge>;
    }
  };

  return (
    <Card className="flex flex-col sm:flex-row overflow-hidden border border-slate-200 shadow-sm transition-all hover:shadow-md dark:border-white/10">
      {/* Date/Time Column */}
      <div className="bg-slate-50 dark:bg-surface-dark-muted p-5 sm:w-48 shrink-0 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10 relative">
        {isToday && !isPast && a.status !== 'cancelled' && (
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
        )}
        <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          {formatTime(a.scheduled_at)}
        </div>
        <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" />
          {date.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
      </div>

      {/* Main Details */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
              Dr. {a.doctor_name || 'Unknown'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                <Stethoscope className="w-3.5 h-3.5" />
                {a.specialty || 'General'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                <Hash className="w-3.5 h-3.5" />
                Token #{a.token_number}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            {getStatusBadge()}
          </div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            {a.type === 'video' ? (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Video className="w-4 h-4" /> Video Consult
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <MapPin className="w-4 h-4" /> Clinic Visit
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {!isPast && a.status === 'booked' && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 hover:text-rose-600">
                Cancel
              </Button>
            )}
            
            {a.type === 'video' && !isPast && a.status !== 'cancelled' && (
              <Button size="sm" onClick={onJoin} className="gap-2 bg-[#1a4a8d] hover:bg-[#12366b]">
                <Video className="w-4 h-4" /> Join Call
              </Button>
            )}

            {a.type === 'clinic' && !isPast && a.status !== 'cancelled' && (
              <Button size="sm" variant="secondary" className="gap-2">
                Get Directions <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
