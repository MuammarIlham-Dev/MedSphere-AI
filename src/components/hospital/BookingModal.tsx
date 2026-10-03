import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Clock, Video, MapPin } from 'lucide-react';
import { useDoctorSchedules, useBookAppointment } from '@/hooks/queries/useAppointmentQueries';
import { Button } from '@/components/ui/Button';
import type { SupabaseDoctor } from './DoctorCard';

interface BookingModalProps {
  doctor: SupabaseDoctor;
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ doctor, isOpen, onClose }: BookingModalProps) {
  const { data: schedules, isLoading } = useDoctorSchedules(doctor.id);
  const bookAppointment = useBookAppointment();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [consultType, setConsultType] = useState<'clinic' | 'video'>('clinic');

  // Generate next 14 days
  const upcomingDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  // Find schedule for selected day
  const scheduleForDay = useMemo(() => {
    if (!schedules) return null;
    const weekday = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return schedules.find((s: any) => s.weekday === weekday && s.is_active);
  }, [schedules, selectedDate]);

  // Generate time slots based on schedule
  const timeSlots = useMemo(() => {
    if (!scheduleForDay) return [];
    const slots = [];
    const [startHour, startMin] = scheduleForDay.start_time.split(':').map(Number);
    const [endHour, endMin] = scheduleForDay.end_time.split(':').map(Number);
    
    let current = new Date(selectedDate);
    current.setHours(startHour, startMin, 0, 0);
    
    const end = new Date(selectedDate);
    end.setHours(endHour, endMin, 0, 0);
    
    const slotDuration = scheduleForDay.slot_minutes || 15;

    while (current < end) {
      slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      current = new Date(current.getTime() + slotDuration * 60000);
    }
    return slots;
  }, [scheduleForDay, selectedDate]);

  const handleBook = () => {
    if (!selectedSlot) return;
    
    // Parse time from slot string (e.g. "10:00 AM")
    const match = selectedSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return;
    const h = match[1];
    const m = match[2];
    const modifier = match[3] || 'AM';
    let hour = parseInt(h || '10');
    if (modifier.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (modifier.toUpperCase() === 'AM' && hour === 12) hour = 0;
    
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hour, parseInt(m || '0'), 0, 0);

    bookAppointment.mutate({
      doctor_id: doctor.id,
      hospital_id: doctor.hospital_id || undefined,
      scheduled_at: scheduledAt.toISOString(),
      duration_min: scheduleForDay?.slot_minutes || 15,
      type: consultType,
      reason,
    }, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Date Selection */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-brand-500" /> Select Date
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {upcomingDays.map((date, i) => {
                  const isSelected = selectedDate.toDateString() === date.toDateString();
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                      className={`flex flex-col items-center justify-center shrink-0 w-16 h-20 rounded-xl border transition-all ${
                        isSelected 
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="text-2xl font-bold my-0.5">{date.getDate()}</span>
                      <span className="text-[10px] font-medium opacity-80">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Time Selection */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand-500" /> Select Time
              </h3>
              
              {isLoading ? (
                <div className="flex items-center justify-center p-8 text-slate-500 text-sm">Loading schedule...</div>
              ) : !scheduleForDay ? (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl text-center text-sm text-slate-500">
                  Doctor is not available on {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}s.
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl text-center text-sm text-slate-500">
                  No time slots generated for this day.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timeSlots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 px-1 text-sm font-semibold rounded-lg border transition-all ${
                        selectedSlot === slot
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Consultation Type */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Consultation Type</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setConsultType('clinic')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    consultType === 'clinic'
                      ? 'border-[#1a4a8d] bg-[#1a4a8d]/5 text-[#1a4a8d] dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                      : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span className="font-semibold text-sm">In Clinic</span>
                </button>
                <button
                  onClick={() => setConsultType('video')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    consultType === 'video'
                      ? 'border-[#1a4a8d] bg-[#1a4a8d]/5 text-[#1a4a8d] dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                      : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <Video className="w-5 h-5" />
                  <span className="font-semibold text-sm">Video Call</span>
                </button>
              </div>
            </section>

            {/* Reason */}
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
              <span className="ml-2 font-bold text-slate-900 dark:text-white">৳{doctor.consultation_fee || 500}</span>
            </div>
            <Button
              onClick={handleBook}
              disabled={!selectedSlot || bookAppointment.isPending}
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
