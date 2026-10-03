import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDoctorSchedules, useUpdateSchedule } from '@/hooks/queries/useAppointmentQueries';
import { Clock, Calendar, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/KpiCard';

interface ScheduleSettingsProps {
  doctorId: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduleSettings({ doctorId }: ScheduleSettingsProps) {
  const { data: schedules, isLoading } = useDoctorSchedules(doctorId);
  const updateSchedule = useUpdateSchedule();
  
  // Local state to manage edits before saving
  const [localSchedules, setLocalSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (schedules) {
      setLocalSchedules(schedules);
    }
  }, [schedules]);

  const handleUpdate = (weekday: number, field: string, value: any) => {
    setLocalSchedules(prev => {
      const existing = prev.find(s => s.weekday === weekday);
      if (existing) {
        return prev.map(s => s.weekday === weekday ? { ...s, [field]: value } : s);
      } else {
        // Create new
        return [...prev, { doctor_id: doctorId, weekday, start_time: '09:00', end_time: '17:00', slot_minutes: 15, is_active: true, type: 'clinic', [field]: value }];
      }
    });
  };

  const handleToggleActive = (weekday: number, isActive: boolean) => {
    const existing = localSchedules.find(s => s.weekday === weekday);
    if (!existing) {
      handleUpdate(weekday, 'is_active', isActive);
    } else {
      handleUpdate(weekday, 'is_active', isActive);
      // Immediately persist toggle
      updateSchedule.mutate({ ...existing, is_active: isActive });
    }
  };

  const handleSave = (weekday: number) => {
    const schedule = localSchedules.find(s => s.weekday === weekday);
    if (schedule) {
      updateSchedule.mutate(schedule);
    }
  };

  if (isLoading) {
    return <Card className="mt-6"><div className="p-6"><Skeleton className="h-64" /></div></Card>;
  }

  return (
    <Card className="mt-6">
      <CardHeader title="Schedule Settings" subtitle="Define your weekly availability and slot durations" />
      <div className="p-6">
        <div className="space-y-4">
          {WEEKDAYS.map((dayName, index) => {
            const schedule = localSchedules.find(s => s.weekday === index);
            const isActive = schedule?.is_active ?? false;
            const isDirty = schedule && schedules?.find(s => s.weekday === index) !== schedule;

            return (
              <div key={index} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border ${isActive ? 'border-brand-200 bg-brand-50/30 dark:border-brand-900/30 dark:bg-brand-900/10' : 'border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/5'}`}>
                
                {/* Day Toggle */}
                <div className="flex items-center gap-3 w-40 shrink-0">
                  <button 
                    onClick={() => handleToggleActive(index, !isActive)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${isActive ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isActive ? 'left-5' : 'left-1'}`} />
                  </button>
                  <span className={`font-semibold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{dayName}</span>
                </div>

                {/* Settings (Only show if active) */}
                {isActive ? (
                  <div className="flex flex-1 flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <input 
                        type="time" 
                        value={schedule?.start_time?.slice(0, 5) || '09:00'} 
                        onChange={(e) => handleUpdate(index, 'start_time', e.target.value)}
                        className="bg-transparent outline-none text-sm font-medium dark:text-white"
                      />
                      <span className="text-slate-400">-</span>
                      <input 
                        type="time" 
                        value={schedule?.end_time?.slice(0, 5) || '17:00'} 
                        onChange={(e) => handleUpdate(index, 'end_time', e.target.value)}
                        className="bg-transparent outline-none text-sm font-medium dark:text-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                      <span className="text-sm text-slate-500">Slot:</span>
                      <select 
                        value={schedule?.slot_minutes || 15} 
                        onChange={(e) => handleUpdate(index, 'slot_minutes', parseInt(e.target.value))}
                        className="bg-transparent outline-none text-sm font-medium dark:text-white"
                      >
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                        <option value={20}>20 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                      <select 
                        value={schedule?.type || 'clinic'} 
                        onChange={(e) => handleUpdate(index, 'type', e.target.value)}
                        className="bg-transparent outline-none text-sm font-medium dark:text-white"
                      >
                        <option value="clinic">Clinic</option>
                        <option value="video">Video</option>
                      </select>
                    </div>

                    {isDirty && (
                      <Button size="sm" onClick={() => handleSave(index)} disabled={updateSchedule.isPending}>
                        Save
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center">
                    <span className="text-sm text-slate-400 italic">Not available</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
