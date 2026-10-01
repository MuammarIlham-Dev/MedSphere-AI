import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { IoBodyOutline, IoGitCompareOutline, IoCheckmarkCircleOutline, IoHourglassOutline, IoPlayOutline } from 'react-icons/io5';
import {
  useEligibleOrganDonors, useOrganMatches, useOrganStats, useRegisterDonor, useRegisterRecipient, useReviewMatch, useRunMatching,
} from '@/hooks/useOrgan';
import { useAuthStore } from '@/stores/authStore';
import { BLOOD_GROUPS, ORGAN_TYPES, URGENCY_LEVELS, type OrganMatch } from '@/types';
import { useUiStore } from '@/stores/uiStore';
import { OrganWaitlistChart, OrganTransplantTimeline, HlaCrossmatchPanel } from '@/components/organ/OrganVisuals';

const donorSchema = z.object({
  blood_group: z.enum(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']),
  organs: z.array(z.string()).min(1, 'Select at least one organ'),
  age: z.coerce.number().min(0).max(120).optional(),
  city: z.string().optional(),
  medical_eligibility: z.string().optional(),
});
const recipientSchema = z.object({
  blood_group: z.enum(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']),
  organ_needed: z.enum(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'cornea', 'bone_marrow']),
  urgency: z.enum(['low', 'standard', 'high', 'critical']),
  age: z.coerce.number().min(0).max(120).optional(),
  city: z.string().optional(),
  diagnosis: z.string().optional(),
});

const scoreTone = (s: number) => (s >= 75 ? 'success' : s >= 50 ? 'warning' : 'danger');

export default function OrganDashboard() {
  const { hasRole } = useAuthStore();
  const coordinator = hasRole('organ_authority', 'hospital', 'admin', 'super_admin');
  const [tab, setTab] = useState<'matches' | 'donor' | 'recipient' | 'analytics'>(coordinator ? 'matches' : 'donor');
  const [statusFilter, setStatusFilter] = useState('proposed');
  const [reviewing, setReviewing] = useState<OrganMatch | null>(null);
  const [notes, setNotes] = useState('');
  const [matchingDonorId, setMatchingDonorId] = useState('');

  const { data: matches, isLoading } = useOrganMatches(coordinator ? statusFilter : undefined);
  const { data: allMatches } = useOrganMatches(undefined);
  const { data: stats } = useOrganStats();
  const { data: eligibleDonors } = useEligibleOrganDonors(coordinator);
  const review = useReviewMatch();
  const runMatching = useRunMatching();
  const registerDonor = useRegisterDonor();
  const registerRecipient = useRegisterRecipient();
  const toast = useUiStore((s) => s.toast);

  const donorForm = useForm<z.infer<typeof donorSchema>>({ resolver: zodResolver(donorSchema), defaultValues: { organs: [] as string[] } });
  const recipientForm = useForm<z.infer<typeof recipientSchema>>({ resolver: zodResolver(recipientSchema), defaultValues: { urgency: 'standard' } });

  return (
    <PageTransition>
      <PageHeader title="Organ donation & matching"
        subtitle="Coordinator-assisted compatibility scoring — clinical decisions always remain with licensed professionals"
        actions={coordinator ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={matchingDonorId} onChange={(event) => { setMatchingDonorId(event.target.value); }} aria-label="Select eligible donor">
              <option value="">Select consented donor</option>
              {(eligibleDonors ?? []).map((donor) => (
                <option key={donor.id} value={donor.id}>{donor.full_name} · {donor.blood_group} · {donor.organs.join(', ')}</option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={() => {
              runMatching.mutate(matchingDonorId, {
                onSuccess: () => { toast('success', 'Matching completed'); },
                onError: (error) => { toast('error', error instanceof Error ? error.message : 'Matching failed'); },
              });
            }} disabled={runMatching.isPending || !matchingDonorId}>
              <IoPlayOutline className="mr-1.5 h-3.5 w-3.5" />
              {runMatching.isPending ? 'Running…' : 'Run matching engine'}
            </Button>
          </div>
        ) : undefined}
      />

      {coordinator && stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Active donors" value={stats.donors} icon={<IoBodyOutline className="h-5 w-5" />} />
          <KpiCard label="Waiting recipients" value={stats.waiting} icon={<IoHourglassOutline className="h-5 w-5" />} />
          <KpiCard label="Proposed matches" value={stats.proposed} icon={<IoGitCompareOutline className="h-5 w-5" />} />
          <KpiCard label="Accepted" value={stats.accepted} icon={<IoCheckmarkCircleOutline className="h-5 w-5" />} />
          <KpiCard label="Transplanted" value={stats.transplanted} icon={<IoCheckmarkCircleOutline className="h-5 w-5" />} />
        </div>
      )}

      <Tabs tabs={[
        ...(coordinator ? [{ id: 'matches' as const, label: 'Match review' }] : []),
        { id: 'donor' as const, label: 'Register donor' },
        { id: 'recipient' as const, label: 'Register recipient' },
        ...(coordinator ? [{ id: 'analytics' as const, label: 'Analytics' }] : []),
      ]} active={tab} onChange={setTab} />

      {tab === 'matches' && coordinator && (
        <Card className="mt-6">
          <CardHeader title="Proposed matches" subtitle="Ranked by explainable compatibility score (blood 40 · HLA ≤36 · proximity ≤12 · priority ≤12)"
            action={
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }} aria-label="Filter by status">
                {['proposed', 'under_review', 'accepted', 'rejected', 'transplanted'].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            } />
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {isLoading && <li className="p-5"><Skeleton className="h-14 w-full" /></li>}
            {(matches ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium capitalize">{m.organ.replace('_', ' ')} — {m.donor_name ?? 'Donor'} → {m.recipient_name ?? 'Recipient'}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <Badge tone={m.blood_compatible ? 'success' : 'danger'}>Blood {m.blood_compatible ? 'compatible' : 'incompatible'}</Badge>
                    <Badge tone="info">HLA {m.hla_score}/36</Badge>
                    {m.distance_km != null && <Badge>{m.distance_km} km</Badge>}
                    {m.recipient_priority != null && <Badge tone="warning">Priority {m.recipient_priority}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={scoreTone(m.compatibility_score)} className="px-3 py-1 text-sm">Score {m.compatibility_score}/100</Badge>
                  {m.status === 'proposed' && <Button size="sm" variant="secondary" onClick={() => { setReviewing(m); setNotes(''); }}>Review</Button>}
                </div>
              </li>
            ))}
            {!isLoading && (matches ?? []).length === 0 && (
              <li className="p-5"><EmptyState title="No matches in this state"
                hint="Run the matching engine after registering a donor to generate assisted proposals." /></li>
            )}
          </ul>
        </Card>
      )}

      {tab === 'analytics' && coordinator && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <OrganWaitlistChart stats={stats} />
          <OrganTransplantTimeline matches={allMatches ?? []} />
        </div>
      )}

      {tab === 'donor' && (
        <Card className="mt-6 max-w-xl p-6">
          <form className="space-y-4" onSubmit={donorForm.handleSubmit((v) => {
            registerDonor.mutate({ ...v, organs: v.organs as Array<'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas' | 'cornea' | 'bone_marrow'>, hla: [] }, { onSuccess: () => { donorForm.reset(); } });
          })}>
            <Select label="Blood group" error={donorForm.formState.errors.blood_group?.message} {...donorForm.register('blood_group')}>
              <option value="">Select…</option>{BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Organs to donate</p>
              <div className="flex flex-wrap gap-2">
                {ORGAN_TYPES.map((o) => (
                  <label key={o} className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm capitalize dark:border-white/10">
                    <input type="checkbox" value={o} {...donorForm.register('organs')} className="accent-brand-600" />
                    {o.replace('_', ' ')}
                  </label>
                ))}
              </div>
              {donorForm.formState.errors.organs && <p role="alert" className="mt-1 text-xs text-danger">{donorForm.formState.errors.organs.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Age" type="number" {...donorForm.register('age')} />
              <Input label="City" {...donorForm.register('city')} />
            </div>
            <Input label="Medical eligibility notes" {...donorForm.register('medical_eligibility')} />
            <p className="rounded-xl bg-surface-muted p-3 text-xs text-slate-500 dark:bg-surface-dark-muted dark:text-slate-400">
              Consent documentation must be uploaded after registration. Donation proceeds only with verified legal consent and clinical review.
            </p>
            <Button type="submit" loading={registerDonor.isPending}>Register as donor</Button>
          </form>
        </Card>
      )}

      {tab === 'recipient' && (
        <Card className="mt-6 max-w-xl p-6">
          <form className="space-y-4" onSubmit={recipientForm.handleSubmit((v) => {
            registerRecipient.mutate(v as Parameters<typeof registerRecipient.mutate>[0], { onSuccess: () => { recipientForm.reset(); } });
          })}>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Blood group" {...recipientForm.register('blood_group')}>
                <option value="">Select…</option>{BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
              <Select label="Organ needed" {...recipientForm.register('organ_needed')}>
                {ORGAN_TYPES.map((o) => <option key={o} value={o} className="capitalize">{o.replace('_', ' ')}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Medical urgency" {...recipientForm.register('urgency')}>
                {URGENCY_LEVELS.map((u) => <option key={u} value={u} className="capitalize">{u}</option>)}
              </Select>
              <Input label="Age" type="number" {...recipientForm.register('age')} />
            </div>
            <Input label="City" {...recipientForm.register('city')} />
            <Input label="Diagnosis (clinical summary)" {...recipientForm.register('diagnosis')} />
            <Button type="submit" loading={registerRecipient.isPending}>Add to waiting list</Button>
          </form>
        </Card>
      )}

      <Modal open={!!reviewing} onClose={() => { setReviewing(null); }} title="Coordinator review">
        {reviewing && (
          <div className="space-y-4">
            <HlaCrossmatchPanel match={reviewing} />
            <p className="text-sm text-slate-500">
              Score {reviewing.compatibility_score}/100 for {reviewing.organ.replace('_', ' ')}. This decision is recorded
              in the immutable audit trail with your identity.
            </p>
            <Input label="Clinical review notes (required)" value={notes} onChange={(e) => { setNotes(e.target.value); }} />
            <div className="flex justify-end gap-2">
              <Button variant="danger" disabled={notes.length < 5 || review.isPending}
                onClick={() => { review.mutate({ id: reviewing.id, approve: false, notes }, { onSuccess: () => { setReviewing(null); } }); }}>
                Reject
              </Button>
              <Button variant="success" disabled={notes.length < 5 || review.isPending || !reviewing.blood_compatible}
                onClick={() => {
                  review.mutate({ id: reviewing.id, approve: true, notes }, {
                    onSuccess: () => { setReviewing(null); toast('info', 'Next: schedule transplant via hospital module.'); },
                  });
                }}>
                Accept & notify
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
}
