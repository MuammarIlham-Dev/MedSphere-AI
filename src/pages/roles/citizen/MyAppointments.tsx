import { useMemo, useState } from 'react';
import {
  useMyAppointments,
  useRescheduleAppointment,
  useUpdateAppointmentStatus,
  useDoctorSlots,
} from '@/hooks/queries/useAppointmentQueries';
import { Card } from '@/components/ui/Card';
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/transitions/PageTransition';
import { Badge } from '@/components/ui/Badge';
import { formatTime } from '@/lib/utils';
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  Stethoscope,
  Hash,
  XCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '@/types';

const formatDhakaDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) throw new Error('Unable to determine date');
  return `${year}-${month}-${day}`;
};

const addDhakaDays = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T12:00:00+06:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDhakaDateKey(d);
};

const slotLabel = (slotAt: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(slotAt));

export default function MyAppointments() {
  const { data: appointments, isLoading } = useMyAppointments();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const navigate = useNavigate();

  const updateStatus = useUpdateAppointmentStatus();

  const { upcoming, past } = useMemo(() => {
    const all = appointments || [];
    const now = new Date();

    return {
      upcoming: all.filter((a) => {
        if (a.status === 'cancelled' || a.status === 'completed' || a.status === 'no_show') return false;
        return new Date(a.scheduled_at) >= now;
      }),
      past: all.filter((a) => {
        if (a.status === 'cancelled' || a.status === 'completed' || a.status === 'no_show') return true;
        return new Date(a.scheduled_at) < now;
      }),
    };
  }, [appointments]);

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      updateStatus.mutate({ id, status: 'cancelled', reason: 'Cancelled by patient' });
    }
  };

  return (
    <>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            title="My Appointments"
            subtitle="Manage upcoming consultations, reschedule when needed, and review completed visits"
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
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Past & Cancelled ({past.length})
            </button>
          </div>

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
            </div>
          ) : displayListPlaceholder(activeTab, upcoming, past).length === 0 ? (
            <EmptyState
              title={activeTab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
              hint={activeTab === 'upcoming' ? 'Book a new consultation from the hospital directory.' : "You haven't had any appointments yet."}
            />
          ) : (
            <div className="grid gap-4">
              {displayListPlaceholder(activeTab, upcoming, past).map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  isPast={activeTab === 'past'}
                  onCancel={() => handleCancel(apt.id)}
                  onReschedule={() => setRescheduleAppointment(apt)}
                  onJoin={() => navigate(`/app/consult/${apt.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </PageTransition>

      {rescheduleAppointment && (
        <RescheduleDialog
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
        />
      )}
    </>
  );
}

function displayListPlaceholder(
  activeTab: 'upcoming' | 'past',
  upcoming: Appointment[],
  past: Appointment[]
) {
  return activeTab === 'upcoming' ? upcoming : past;
}

function AppointmentCard({
  appointment: a,
  isPast,
  onCancel,
  onReschedule,
  onJoin,
}: {
  appointment: Appointment;
  isPast: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onJoin: () => void;
}) {
  const date = new Date(a.scheduled_at);
  const isToday = date.toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' }) ===
    new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' });
  const canManage = !isPast && (a.status === 'booked' || a.status === 'confirmed');
  const canJoin = !isPast && a.type === 'video' && ['confirmed', 'checked_in', 'in_progress'].includes(a.status);

  const getStatusBadge = () => {
    switch (a.status) {
      case 'cancelled':
        return <Badge tone="danger"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      case 'completed':
        return <Badge tone="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'in_progress':
        return <Badge tone="brand"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'checked_in':
        return <Badge tone="info"><CheckCircle2 className="w-3 h-3 mr-1" /> Checked In</Badge>;
      case 'confirmed':
        return <Badge tone="info">Confirmed</Badge>;
      case 'no_show':
        return <Badge tone="danger">No-show</Badge>;
      default:
        return <Badge tone="neutral">Booked</Badge>;
    }
  };

  return (
    <Card className="flex flex-col sm:flex-row overflow-hidden border border-slate-200 shadow-sm transition-all hover:shadow-md dark:border-white/10">
      <div className="bg-slate-50 dark:bg-surface-dark-muted p-5 sm:w-48 shrink-0 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10 relative">
        {isToday && canManage && (
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
        )}
        <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Dhaka' })}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          {formatTime(a.scheduled_at)}
        </div>
        <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" />
          {date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' })}
        </div>
      </div>

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
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between gap-4">
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
            {canManage && (
              <>
                <Button variant="ghost" size="sm" onClick={onReschedule} className="gap-1.5 text-slate-600 hover:text-brand-600">
                  <RotateCcw className="w-4 h-4" /> Reschedule
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 text-slate-500 hover:text-rose-600">
                  <XCircle className="w-4 h-4" /> Cancel
                </Button>
              </>
            )}

            {canJoin && (
              <Button size="sm" onClick={onJoin} className="gap-2 bg-[#1a4a8d] hover:bg-[#12366b]">
                <Video className="w-4 h-4" /> Join Call
              </Button>
            )}

            {a.type === 'clinic' && !isPast && !canManage && a.status !== 'cancelled' && (
              <Button size="sm" variant="secondary" className="gap-2" disabled>
                <MapPin className="w-4 h-4" /> Directions
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function RescheduleDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const todayKey = useMemo(() => formatDhakaDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const reschedule = useRescheduleAppointment();

  const upcomingDays = useMemo(
    () => Array.from({ length: 30 }, (_, i) => addDhakaDays(todayKey, i)),
    [todayKey]
  );

  const { data: slots, isLoading } = useDoctorSlots(
    appointment.doctor_id,
    selectedDateKey,
    appointment.type,
    appointment.id
  );

  const availableSlots = useMemo(
    () => (slots ?? []).filter((slot) => slot.available),
    [slots]
  );

  const handleReschedule = () => {
    if (!selectedSlot) return;
    reschedule.mutate(
      { id: appointment.id, scheduledAt: selectedSlot },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-surface-dark shadow-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reschedule Appointment</h2>
            <p className="text-sm text-slate-500">Choose a new available time with Dr. {appointment.doctor_name || 'your doctor'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full" aria-label="Close reschedule dialog">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[65vh] space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {upcomingDays.map((dateKey) => {
              const date = new Date(`${dateKey}T12:00:00+06:00`);
              const selected = selectedDateKey === dateKey;
              return (
                <button
                  key={dateKey}
                  onClick={() => { setSelectedDateKey(dateKey); setSelectedSlot(null); }}
                  className={`flex flex-col items-center justify-center shrink-0 w-16 h-20 rounded-xl border ${
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">{new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'short' }).format(date)}</span>
                  <span className="text-2xl font-bold">{new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', day: 'numeric' }).format(date)}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Checking live availability...</div>
          ) : availableSlots.length === 0 ? (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/5 text-center text-sm text-slate-500">
              No available times on this date.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.slot_at}
                  onClick={() => setSelectedSlot(slot.slot_at)}
                  className={`py-2 px-1 rounded-lg border text-sm font-semibold ${
                    selectedSlot === slot.slot_at
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {slotLabel(slot.slot_at)}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 p-4 text-sm text-brand-800 dark:text-brand-200">
            Your consultation type and existing fee stay unchanged. The server will re-check the chosen slot before applying the change.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 dark:border-white/5">
          <Button variant="ghost" onClick={onClose}>Keep Current Time</Button>
          <Button onClick={handleReschedule} disabled={!selectedSlot || reschedule.isPending}>
            {reschedule.isPending ? 'Rescheduling...' : 'Confirm New Time'}
          </Button>
        </div>
      </div>
    </div>
  );
}
