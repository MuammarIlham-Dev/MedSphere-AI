import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Clock, Video, MapPin } from 'lucide-react';
import { useDoctorSchedules, useDoctorSlots, useBookAppointment } from '@/hooks/queries/useAppointmentQueries';
import { Button } from '@/components/ui/Button';
import type { ConsultationType } from '@/types';
import type { SupabaseDoctor } from './DoctorCard';

interface BookingModalProps {
  doctor: SupabaseDoctor;
  isOpen: boolean;
  onClose: () => void;
}

const weekdayIndex = (dateKey: string) => new Date(`${dateKey}T12:00:00+06:00`).getUTCDay();

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

const formatSlotLabel = (slotAt: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(slotAt));

export function BookingModal({ doctor, isOpen, onClose }: BookingModalProps) {
  const todayKey = useMemo(() => formatDhakaDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [consultType, setConsultType] = useState<ConsultationType>('clinic');

  const { data: schedules, isLoading: schedulesLoading } = useDoctorSchedules(doctor.id);
  const { data: slots, isLoading: slotsLoading } = useDoctorSlots(
    doctor.id,
    selectedDateKey,
    consultType
  );
  const bookAppointment = useBookAppointment();

  const upcomingDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDhakaDays(todayKey, i)),
    [todayKey]
  );

  const scheduleForDay = useMemo(() => {
    const weekday = weekdayIndex(selectedDateKey);
    return schedules?.find(
      (s) => s.weekday === weekday && s.type === consultType && s.is_active
    ) ?? null;
  }, [schedules, selectedDateKey, consultType]);

  const availableSlots = useMemo(
    () => (slots ?? []).filter((slot) => slot.available),
    [slots]
  );

  const selectedDate = useMemo(
    () => new Date(`${selectedDateKey}T12:00:00+06:00`),
    [selectedDateKey]
  );

  const handleBook = () => {
    if (!selectedSlot) return;

    bookAppointment.mutate(
      {
        doctor_id: doctor.id,
        hospital_id: doctor.hospital_id || undefined,
        scheduled_at: selectedSlot,
        duration_min: scheduleForDay?.slot_minutes || 15,
        type: consultType,
        reason,
      },
      { onSuccess: onClose }
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Book Appointment</h2>
              <p className="text-sm text-slate-500">with Dr. {doctor.full_name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Close booking"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-brand-500" /> Select Date
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {upcomingDays.map((dateKey) => {
                  const date = new Date(`${dateKey}T12:00:00+06:00`);
                  const isSelected = selectedDateKey === dateKey;

                  return (
                    <button
                      key={dateKey}
                      onClick={() => { setSelectedDateKey(dateKey); setSelectedSlot(null); }}
                      className={`flex flex-col items-center justify-center shrink-0 w-16 h-20 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'short' }).format(date)}
                      </span>
                      <span className="text-2xl font-bold my-0.5">{new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', day: 'numeric' }).format(date)}</span>
                      <span className="text-[10px] font-medium opacity-80">
                        {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: 'short' }).format(date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand-500" /> Select Time
              </h3>

              {schedulesLoading || slotsLoading ? (
                <div className="flex items-center justify-center p-8 text-slate-500 text-sm">Checking live availability...</div>
              ) : !scheduleForDay ? (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl text-center text-sm text-slate-500">
                  Doctor is not available for {consultType === 'video' ? 'video' : 'in-clinic'} consultation on this day.
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl text-center text-sm text-slate-500">
                  All consultation slots are currently booked for this day.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.slot_at}
                      onClick={() => setSelectedSlot(slot.slot_at)}
                      className={`py-2 px-1 text-sm font-semibold rounded-lg border transition-all ${
                        selectedSlot === slot.slot_at
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400'
                      }`}
                    >
                      {formatSlotLabel(slot.slot_at)}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Consultation Type</h3>
              <div className="flex gap-3">
                {(['clinic', 'video'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setConsultType(type); setSelectedSlot(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                      consultType === type
                        ? 'border-[#1a4a8d] bg-[#1a4a8d]/5 text-[#1a4a8d] dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {type === 'clinic' ? <MapPin className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    <span className="font-semibold text-sm">{type === 'clinic' ? 'In Clinic' : 'Video Call'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Reason for Visit (Optional)</h3>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe your symptoms or reason for visit..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted text-sm resize-none h-24 focus:ring-2 focus:ring-brand-500 outline-none transition-all dark:text-white"
              />
            </section>
          </div>

          <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-dark-muted flex items-center justify-between">
            <div className="text-sm">
              <span className="text-slate-500">Consultation Fee:</span>
              <span className="ml-2 font-bold text-slate-900 dark:text-white">৳{doctor.consultation_fee || 0}</span>
            </div>
            <Button
              onClick={handleBook}
              disabled={!selectedSlot || !scheduleForDay || bookAppointment.isPending}
              className="bg-[#1a4a8d] hover:bg-[#12366b] px-8"
            >
              {bookAppointment.isPending ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
