import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DoctorSchedule, TimeSlot } from '@/types';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Build bookable slots for a date from schedules minus taken start-times. */
export function generateSlots(schedules: DoctorSchedule[], taken: string[], dateInput: Date | string): TimeSlot[] {
  const dateISO = typeof dateInput === 'string' ? dateInput : dateInput.toISOString().split('T')[0];
  const [year, month, day] = dateISO!.split('-').map(Number);
  const d = new Date(year!, month! - 1, day!, 12, 0, 0);
  const weekday = d.getDay(); 

  const slots: TimeSlot[] = [];
  for (const s of schedules.filter((x) => x.weekday === weekday && x.is_active)) {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    
    let cursorTime = new Date(`${dateISO}T${sh?.toString().padStart(2, '0')}:${sm?.toString().padStart(2, '0')}:00+06:00`).getTime();
    const endTime = new Date(`${dateISO}T${eh?.toString().padStart(2, '0')}:${em?.toString().padStart(2, '0')}:00+06:00`).getTime();

    while (cursorTime < endTime) {
      const slotEnd = cursorTime + s.slot_minutes * 60_000;
      slots.push({
        start: new Date(cursorTime).toISOString(),
        end: new Date(slotEnd).toISOString(),
        type: s.type,
        available: !taken.some((t) => new Date(t).getTime() === cursorTime) && cursorTime > Date.now(),
      });
      cursorTime = slotEnd;
    }
  }
  return slots;
}

export const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

