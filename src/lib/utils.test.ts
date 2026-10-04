import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo, generateSlots, initials } from './utils';

describe('utils', () => {
  describe('timeAgo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-03T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "just now" for times under 60 seconds', () => {
      expect(timeAgo('2026-10-03T11:59:30.000Z')).toBe('just now');
    });

    it('returns minutes for times under an hour', () => {
      expect(timeAgo('2026-10-03T11:45:00.000Z')).toBe('15m ago');
    });

    it('returns hours for times under a day', () => {
      expect(timeAgo('2026-10-03T09:00:00.000Z')).toBe('3h ago');
    });

    it('returns days for older times', () => {
      expect(timeAgo('2026-10-01T12:00:00.000Z')).toBe('2d ago');
    });
  });

  describe('initials', () => {
    it('returns initials for full name', () => {
      expect(initials('John Doe')).toBe('JD');
    });

    it('handles single name', () => {
      expect(initials('John')).toBe('J');
    });
  });

  describe('generateSlots', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set system time to very early so 10:00 local is always in the future
      const early = new Date();
      early.setHours(0, 0, 0, 0);
      vi.setSystemTime(early);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('generates bookable slots correctly for a schedule', () => {
      const targetDate = new Date('2026-10-04T10:00:00+06:00');

      const schedules = [
        {
          id: '1',
          doctor_id: 'd1',
          weekday: targetDate.getDay(),
          start_time: '10:00',
          end_time: '11:00',
          slot_minutes: 30,
          type: 'video' as const,
          is_active: true,
          created_at: '',
          updated_at: ''
        }
      ];

      const takenSlot = new Date(targetDate);
      const taken = [takenSlot.toISOString()]; 
      
      const slots = generateSlots(schedules, taken, targetDate);

      expect(slots).toHaveLength(2);
      
      const expectedEnd = new Date(targetDate);
      expectedEnd.setMinutes(30);

      // First slot is taken
      expect(slots[0]!.start).toBe(targetDate.toISOString());
      expect(slots[0]!.end).toBe(expectedEnd.toISOString());
      expect(slots[0]!.available).toBe(false);

      // Second slot is available (it's in the future and not taken)
      const secondSlotStart = new Date('2026-10-04T10:30:00+06:00');
      const secondSlotEnd = new Date('2026-10-04T11:00:00+06:00');

      expect(slots[1]!.start).toBe(secondSlotStart.toISOString());
      expect(slots[1]!.end).toBe(secondSlotEnd.toISOString());
      expect(slots[1]!.available).toBe(true);
    });

    it('marks past slots as unavailable', () => {
        const now = new Date('2026-10-04T04:45:00.000Z');
        vi.setSystemTime(now); // 10:45 Asia/Dhaka; first two slots are past

        const targetDate = new Date('2026-10-04T10:00:00+06:00');

        const schedules = [
          {
            id: '1',
            doctor_id: 'd1',
            weekday: targetDate.getDay(), 
            start_time: '10:00',
            end_time: '11:30',
            slot_minutes: 30,
            type: 'clinic' as const,
            is_active: true,
            created_at: '',
            updated_at: ''
          }
        ];
  
        const slots = generateSlots(schedules, [], targetDate);
  
        expect(slots).toHaveLength(3);
        expect(slots[0]!.available).toBe(false); // 10:00 is past
        expect(slots[1]!.available).toBe(false); // 10:30 is past
        expect(slots[2]!.available).toBe(true);  // 11:00 is future
    });
  });
});
