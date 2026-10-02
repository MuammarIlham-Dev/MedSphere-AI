import { describe, expect, it, vi } from 'vitest';
import { generateSlots } from '@/lib/utils';
import type { DoctorSchedule } from '@/types';

const clinicSchedule: DoctorSchedule = {
  id: 'schedule-1',
  doctor_id: 'doctor-1',
  weekday: 4,
  start_time: '09:00:00',
  end_time: '10:00:00',
  slot_minutes: 20,
  type: 'clinic',
  is_active: true,
};

describe('generateSlots', () => {
  it('uses configured intervals and excludes other weekdays', () => {
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    const slots = generateSlots([
      clinicSchedule,
      { ...clinicSchedule, id: 'other-day', weekday: 5, type: 'video' },
    ], [], new Date('2099-01-08T00:00:00'));

    expect(slots.map((slot: any) => slot.start.slice(11, 16))).toEqual(['09:00', '09:20', '09:40']);
    expect(slots.every((slot: any) => slot.type === 'clinic' && slot.available)).toBe(true);
  });

  it('marks a persisted appointment as unavailable', () => {
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    const booked = new Date('2099-01-08T09:20:00').toISOString();
    const slots = generateSlots([clinicSchedule], [booked], new Date('2099-01-08T00:00:00'));

    expect(slots.find((slot: any) => slot.start.includes('09:20'))?.available).toBe(false);
    expect(slots.filter((slot: any) => slot.available)).toHaveLength(2);
  });
});
