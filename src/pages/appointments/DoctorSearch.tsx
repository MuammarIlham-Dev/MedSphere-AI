import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { cn, formatTime, initials } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { IoVideocamOutline, IoLocationOutline, IoStar } from 'react-icons/io5';
import { useDoctorSearch, useDoctorSlots } from '@/hooks/useDoctors';
import { useBookAppointment } from '@/hooks/useAppointments';
import { SPECIALTIES, LANGUAGES, type DoctorCard, type ConsultationType } from '@/types';
import { useUiStore } from '@/stores/uiStore';

export default function DoctorSearch() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [language, setLanguage] = useState('');
  const [type, setType] = useState<ConsultationType | ''>('');
  const [selected, setSelected] = useState<DoctorCard | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const filters = useMemo(() => ({
    query: query || undefined, specialty: specialty || undefined,
    language: language || undefined, type: (type || undefined),
  }), [query, specialty, language, type]);

  const { data: doctors, isLoading } = useDoctorSearch(filters);
  const { data: slots } = useDoctorSlots(selected?.id, date);
  const book = useBookAppointment();
  const toast = useUiStore((s) => s.toast);

  return (
    <PageTransition>
      <PageHeader title="Find a doctor" subtitle="Search by specialty, language, consultation type and availability" />
      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Doctor name…" value={query} onChange={(e) => { setQuery(e.target.value); }} aria-label="Search by name" />
        <Select value={specialty} onChange={(e) => { setSpecialty(e.target.value); }} aria-label="Specialty">
          <option value="">All specialties</option>
          {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={language} onChange={(e) => { setLanguage(e.target.value); }} aria-label="Language">
          <option value="">Any language</option>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <Select value={type} onChange={(e) => { setType(e.target.value as ConsultationType | ''); }} aria-label="Consultation type">
          <option value="">Video or clinic</option>
          <option value="video">Video consultation</option>
          <option value="clinic">In-clinic visit</option>
        </Select>
      </Card>

      {isLoading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {!isLoading && (doctors ?? []).length === 0 && <EmptyState title="No doctors match your filters" hint="Try widening the search criteria." />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(doctors ?? []).map((d) => (
          <Card key={d.id} className="flex flex-col p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                {initials(d.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.full_name}</p>
                <p className="text-sm text-brand-600">{d.specialty}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <IoLocationOutline /> {d.hospital_name ?? 'Independent'}{d.hospital_city ? ` · ${d.hospital_city}` : ''}
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-amber-500"><IoStar /> {d.rating_avg.toFixed(1)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {d.video_enabled && <Badge tone="info"><IoVideocamOutline /> Video</Badge>}
              {d.clinic_enabled && <Badge tone="brand">Clinic</Badge>}
              <Badge>{d.experience_years}y exp</Badge>
              {d.languages.slice(0, 2).map((l) => <Badge key={l}>{l}</Badge>)}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="text-sm font-semibold">৳{d.consultation_fee}</p>
              <Button size="sm" onClick={() => { setSelected(d); }}>Book</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => { setSelected(null); }} title={`Book — Dr. ${selected?.full_name ?? ''}`} wide>
        <Input label="Date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDate(e.target.value); }} />
        <div className="mt-4 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {(slots ?? []).map((s) => (
            <button key={s.start} disabled={!s.available || book.isPending}
              onClick={() => {
                if (!selected) return;
                book.mutate(
                  { doctor_id: selected.id, hospital_id: selected.hospital_id, scheduled_at: s.start, type: s.type },
                  { onSuccess: () => { setSelected(null); }, onError: (e) => { toast('error', e.message); } },
                );
              }}
              className={cn('rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
                s.available
                  ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300'
                  : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 dark:border-white/5 dark:bg-surface-dark-muted dark:text-slate-600')}>
              {formatTime(s.start)}<span className="block text-[10px] font-normal">{s.type}</span>
            </button>
          ))}
          {(slots ?? []).length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-400">No slots on this date — try another day.</p>}
        </div>
      </Modal>
    </PageTransition>
  );
}
