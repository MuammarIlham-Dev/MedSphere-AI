import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreateMedicationReminder, useDeleteMedicationReminder, useMyMedicationReminders } from '@/hooks/queries/useEhrQueries';
import { Clock3, Plus, Trash2 } from 'lucide-react';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function todayKey() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return year && month && day ? year + '-' + month + '-' + day : new Date().toISOString().slice(0, 10);
}

export function MedicationReminderPanel() {
  const { data: reminders, isLoading } = useMyMedicationReminders();
  const createReminder = useCreateMedicationReminder();
  const deleteReminder = useDeleteMedicationReminder();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [times, setTimes] = useState('08:00,20:00');
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState('');
  const parsedTimes = useMemo(() => Array.from(new Set(times.split(',').map((x) => x.trim()).filter(Boolean))).sort(), [times]);
  const valid = label.trim().length > 0 && parsedTimes.length > 0 && parsedTimes.length <= 8 && parsedTimes.every((x) => TIME_PATTERN.test(x)) && (!endDate || endDate >= startDate);

  return <Card className='p-5'>
    <div className='flex items-start justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4'>
      <div><h2 className='text-lg font-semibold'>Medication Schedule</h2><p className='text-sm text-slate-500 mt-1'>Store medication times and dates for your care routine.</p></div>
      <Button size='sm' onClick={() => setOpen((v) => !v)}><Plus className='w-4 h-4 mr-1' /> Add</Button>
    </div>
    {open && <div className='mt-4 grid gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4 md:grid-cols-2'>
      <label className='text-sm'><span className='mb-1 block font-medium'>Schedule name</span><input value={label} onChange={(e) => setLabel(e.target.value)} className='w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted p-2.5' placeholder='e.g. Morning medicines' /></label>
      <label className='text-sm'><span className='mb-1 block font-medium'>Times</span><input value={times} onChange={(e) => setTimes(e.target.value)} className='w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted p-2.5' placeholder='08:00,20:00' /></label>
      <label className='text-sm'><span className='mb-1 block font-medium'>Start date</span><input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} className='w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted p-2.5' /></label>
      <label className='text-sm'><span className='mb-1 block font-medium'>End date</span><input type='date' min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className='w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted p-2.5' /></label>
      <div className='md:col-span-2 flex justify-end gap-2'><Button variant='ghost' onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!valid || createReminder.isPending} onClick={() => createReminder.mutate({ label: label.trim(), times: parsedTimes, start_date: startDate, end_date: endDate || null, is_active: true }, { onSuccess: () => { setOpen(false); setLabel(''); setTimes('08:00,20:00'); setEndDate(''); } })}>{createReminder.isPending ? 'Saving...' : 'Save Schedule'}</Button></div>
    </div>}
    <div className='mt-4 space-y-3'>
      {isLoading && <div className='text-sm text-slate-500'>Loading schedules...</div>}
      {!isLoading && reminders?.length === 0 && <div className='rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center text-sm text-slate-500'>No medication schedules saved.</div>}
      {reminders?.map((reminder) => <div key={reminder.id} className='flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4'><div><div className='flex items-center gap-2 font-medium'><Clock3 className='w-4 h-4 text-brand-500' />{reminder.label}</div><p className='mt-1 text-sm text-slate-500'>{reminder.times.join(' · ')} · {reminder.start_date}{reminder.end_date ? ' → ' + reminder.end_date : ''}</p></div><Button variant='ghost' size='sm' className='text-rose-600' disabled={deleteReminder.isPending} onClick={() => deleteReminder.mutate(reminder.id)}><Trash2 className='w-4 h-4 mr-1' /> Remove</Button></div>)}
    </div>
  </Card>;
}