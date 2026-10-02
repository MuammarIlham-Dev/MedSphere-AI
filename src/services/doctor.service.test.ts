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

    const times = slots.map((s: any) => {
      const d = new Date(s.start);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    expect(times).toEqual(['09:00', '09:20', '09:40']);
    expect(slots.every((slot: any) => slot.type === 'clinic' && slot.available)).toBe(true);
  });

  it('marks a persisted appointment as unavailable', () => {
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    const initialSlots = generateSlots([clinicSchedule], [], new Date('2099-01-08T00:00:00'));
    const booked = initialSlots[1]?.start ?? '';
    const slots = generateSlots([clinicSchedule], [booked], new Date('2099-01-08T00:00:00'));

    expect(slots[1]?.available).toBe(false);
    expect(slots.filter((slot: any) => slot.available)).toHaveLength(2);
  });
});
