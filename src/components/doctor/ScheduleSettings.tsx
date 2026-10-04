import React, { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDoctorSchedules, useUpdateSchedule } from '@/hooks/queries/useAppointmentQueries';
import { Clock, MapPin, Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/KpiCard';
import type { ConsultationType, DoctorSchedule } from '@/types';

interface ScheduleSettingsProps {
  doctorId: string;
}

type LocalSchedule = Omit<DoctorSchedule, 'id'> & { id?: string };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_TYPES: Array<{ type: ConsultationType; label: string }> = [
  { type: 'clinic', label: 'Clinic' },
  { type: 'video', label: 'Video' },
];

const scheduleKey = (weekday: number, type: ConsultationType) => `${weekday}:${type}`;

export function ScheduleSettings({ doctorId }: ScheduleSettingsProps) {
  const { data: schedules, isLoading } = useDoctorSchedules(doctorId);
  const updateSchedule = useUpdateSchedule();
  const [localSchedules, setLocalSchedules] = useState<LocalSchedule[]>([]);

  useEffect(() => {
    if (schedules) setLocalSchedules(schedules);
  }, [schedules]);

  const getLocalSchedule = (weekday: number, type: ConsultationType) =>
    localSchedules.find((s) => s.weekday === weekday && s.type === type);

  const getRemoteSchedule = (weekday: number, type: ConsultationType) =>
    schedules?.find((s) => s.weekday === weekday && s.type === type);

  const handleUpdate = (
    weekday: number,
    type: ConsultationType,
    field: keyof Pick<LocalSchedule, 'start_time' | 'end_time' | 'slot_minutes' | 'is_active'>,
    value: string | number | boolean
  ) => {
    setLocalSchedules((prev) => {
      const existing = prev.find((s) => s.weekday === weekday && s.type === type);

      if (existing) {
        return prev.map((s) =>
          s.weekday === weekday && s.type === type ? { ...s, [field]: value } : s
        );
      }

      return [
        ...prev,
        {
          doctor_id: doctorId,
          weekday,
          start_time: '09:00',
          end_time: '17:00',
          slot_minutes: 15,
          is_active: true,
          type,
          [field]: value,
        },
      ];
    });
  };

  const handleToggleActive = (weekday: number, type: ConsultationType, isActive: boolean) => {
    const existing = getLocalSchedule(weekday, type);

    if (!existing && !isActive) return;

    const next: LocalSchedule = existing
      ? { ...existing, is_active: isActive }
      : {
          doctor_id: doctorId,
          weekday,
          start_time: '09:00',
          end_time: '17:00',
          slot_minutes: 15,
          is_active: true,
          type,
        };

    setLocalSchedules((prev) => {
      const found = prev.some((s) => s.weekday === weekday && s.type === type);
      return found
        ? prev.map((s) => s.weekday === weekday && s.type === type ? next : s)
        : [...prev, next];
    });

    updateSchedule.mutate(next);
  };

  const handleSave = (weekday: number, type: ConsultationType) => {
    const schedule = getLocalSchedule(weekday, type);
    if (schedule) updateSchedule.mutate(schedule);
  };

  const isDirty = (weekday: number, type: ConsultationType) => {
    const local = getLocalSchedule(weekday, type);
    const remote = getRemoteSchedule(weekday, type);

    if (!local) return false;
    if (!remote) return local.is_active;

    return (
      local.start_time.slice(0, 5) !== remote.start_time.slice(0, 5) ||
      local.end_time.slice(0, 5) !== remote.end_time.slice(0, 5) ||
      local.slot_minutes !== remote.slot_minutes ||
      local.is_active !== remote.is_active
    );
  };

  if (isLoading) {
    return (
      <Card className="mt-6">
        <div className="p-6"><Skeleton className="h-64" /></div>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Schedule Settings"
        subtitle="Manage clinic and video availability independently for each day"
      />
      <div className="p-6 space-y-4">
        {WEEKDAYS.map((dayName, weekday) => (
          <div
            key={weekday}
            className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-50 dark:bg-white/5">
              <h3 className="font-semibold text-slate-900 dark:text-white">{dayName}</h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {SCHEDULE_TYPES.map(({ type, label }) => {
                const schedule = getLocalSchedule(weekday, type);
                const isActive = schedule?.is_active ?? false;
                const Icon = type === 'clinic' ? MapPin : Video;

                return (
                  <div key={scheduleKey(weekday, type)} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex items-center gap-3 w-40 shrink-0">
                        <button
                          type="button"
                          aria-label={`${label} availability for ${dayName}`}
                          onClick={() => handleToggleActive(weekday, type, !isActive)}
                          className={`w-10 h-6 rounded-full relative transition-colors ${isActive ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isActive ? 'left-5' : 'left-1'}`} />
                        </button>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400" />
                          <span className={`font-semibold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{label}</span>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <input
                              type="time"
                              value={schedule?.start_time?.slice(0, 5) || '09:00'}
                              onChange={(e) => handleUpdate(weekday, type, 'start_time', e.target.value)}
                              className="bg-transparent outline-none text-sm font-medium dark:text-white"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                              type="time"
                              value={schedule?.end_time?.slice(0, 5) || '17:00'}
                              onChange={(e) => handleUpdate(weekday, type, 'end_time', e.target.value)}
                              className="bg-transparent outline-none text-sm font-medium dark:text-white"
                            />
                          </div>

                          <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                            <span className="text-sm text-slate-500">Slot:</span>
                            <select
                              value={schedule?.slot_minutes || 15}
                              onChange={(e) => handleUpdate(weekday, type, 'slot_minutes', parseInt(e.target.value, 10))}
                              className="bg-transparent outline-none text-sm font-medium dark:text-white"
                            >
                              <option value={10}>10 min</option>
                              <option value={15}>15 min</option>
                              <option value={20}>20 min</option>
                              <option value={30}>30 min</option>
                              <option value={60}>60 min</option>
                            </select>
                          </div>

                          {isDirty(weekday, type) && (
                            <Button
                              size="sm"
                              onClick={() => handleSave(weekday, type)}
                              disabled={updateSchedule.isPending}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 italic">Not available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
