import { describe, expect, it, vi } from 'vitest';
import { generateSlots } from '@/lib/utils';
import type { DoctorSchedule } from '@/types';
import type { TimeSlot } from './doctor.service';
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
    ], [], '2099-01-08');

    const times = slots.map((s: TimeSlot) => {
      // The start string is formatted as `YYYY-MM-DDTHH:mm:00+06:00`.
      // We can just extract the time part directly from the string to avoid timezone drift in tests.
      return s.start.substring(11, 16);
    });
    expect(times).toEqual(['03:00', '03:20', '03:40']);
    expect(slots.every((slot: TimeSlot) => slot.type === 'clinic' && slot.available)).toBe(true);
  });

  it('marks a persisted appointment as unavailable', () => {
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    const initialSlots = generateSlots([clinicSchedule], [], '2099-01-08');
    const booked = initialSlots[1]?.start ?? '';
    const slots = generateSlots([clinicSchedule], [booked], '2099-01-08');

    expect(slots[1]?.available).toBe(false);
    expect(slots.filter((slot: TimeSlot) => slot.available)).toHaveLength(2);
  });
});
