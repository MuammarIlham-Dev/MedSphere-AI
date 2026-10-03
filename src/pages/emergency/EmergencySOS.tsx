import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { IoMedkitOutline, IoNavigateOutline, IoCheckmarkCircle } from 'react-icons/io5';
import { useSOS, useActiveEmergency } from '@/hooks/queries/useEmergencyQueries';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

const STEPS = ['active', 'dispatched', 'on_scene', 'transporting', 'arrived', 'resolved'] as const;

export default function EmergencySOS() {
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);
  const sos = useSOS();
  const { data: emergency } = useActiveEmergency();

  const trigger = () => {
    if (emergency) return toast('info', 'You already have an active emergency');
    if (!('geolocation' in navigator)) return toast('error', 'Geolocation unavailable on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => sos.mutate(
        { lat: pos.coords.latitude, lng: pos.coords.longitude, city: profile?.city ?? undefined },
        { onSuccess: () => { toast('success', 'SOS sent — help is being dispatched'); } },
      ),
      () => toast('error', 'Location permission required for SOS'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const currentStep = emergency ? STEPS.indexOf(emergency.status as (typeof STEPS)[number]) : -1;

  return (
    <PageTransition>
      <PageHeader title="Emergency SOS" subtitle="One tap shares your live location with the nearest response network" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center">
          <button onClick={trigger} disabled={sos.isPending || !!emergency}
            aria-label="Trigger emergency SOS"
            className="flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 animate-sos-ring disabled:opacity-60">
            <span className="flex flex-col items-center gap-1">
              <IoMedkitOutline className="h-10 w-10" />
              <span className="text-xl font-bold tracking-widest">{sos.isPending ? 'SENDING…' : 'SOS'}</span>
            </span>
          </button>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Pressing SOS notifies regional emergency operators with your GPS position and medical profile.
          </p>
          {(profile?.emergency_contacts ?? []).length > 0 && (
            <div className="w-full rounded-xl bg-surface-muted p-4 text-left dark:bg-surface-dark-muted">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency contacts</p>
              {profile!.emergency_contacts.map((c, i) => (
                <p key={i} className="mt-1.5 text-sm">{c.name} · {c.relation} · <a className="text-brand-600" href={`tel:${c.phone}`}>{c.phone}</a></p>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Response status" subtitle={emergency ? `Event ${emergency.id.slice(0, 8)}…` : 'No active event'} />
          <div className="p-5">
            {!emergency && <EmptyState title="No active emergency" hint="Your SOS status and ambulance assignment will appear here in real time." />}
            {emergency && (
              <ol className="space-y-4">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      i <= currentStep ? 'bg-success text-white' : 'bg-slate-100 text-slate-400 dark:bg-surface-dark-muted')}>
                      {i <= currentStep ? <IoCheckmarkCircle className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={cn('text-sm capitalize', i <= currentStep ? 'font-medium' : 'text-slate-400')}>
                      {step.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {emergency?.assigned_ambulance_id && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <IoNavigateOutline /> Ambulance assigned — live tracking active on channel
                <code>track:ambulance:{emergency.assigned_ambulance_id.slice(0, 8)}</code>
              </p>
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
