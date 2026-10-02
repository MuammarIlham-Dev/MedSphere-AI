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
export function generateSlots(schedules: DoctorSchedule[], taken: string[], date: Date): TimeSlot[] {
  const weekday = date.getDay();
  const slots: TimeSlot[] = [];
  for (const s of schedules.filter((x) => x.weekday === weekday && x.is_active)) {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    let cursor = new Date(date); cursor.setHours(sh ?? 0, sm ?? 0, 0, 0);
    const end = new Date(date); end.setHours(eh ?? 0, em ?? 0, 0, 0);
    while (cursor < end) {
      const slotEnd = new Date(cursor.getTime() + s.slot_minutes * 60_000);
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
        type: s.type,
        available: !taken.some((t) => new Date(t).getTime() === cursor.getTime()) && cursor.getTime() > Date.now(),
      });
      cursor = slotEnd;
    }
  }
  return slots;
}

export const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

