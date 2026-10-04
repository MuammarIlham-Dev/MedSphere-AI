import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { IoMedkitOutline, IoNavigateOutline, IoCheckmarkCircle, IoLocationOutline, IoFlameOutline, IoCarOutline, IoShieldCheckmarkOutline } from 'react-icons/io5';
import { useSOS, useActiveEmergency, useAmbulanceTrack } from '@/hooks/queries/useEmergencyQueries';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

const STEPS = ['active', 'dispatched', 'on_scene', 'transporting', 'arrived', 'resolved'] as const;

const SCENARIOS = [
  { value: 'medical', label: 'Medical', icon: IoMedkitOutline, hint: 'Illness, injury, urgent medical help' },
  { value: 'accident', label: 'Accident', icon: IoCarOutline, hint: 'Road or other serious accident' },
  { value: 'fire', label: 'Fire', icon: IoFlameOutline, hint: 'Fire or immediate fire danger' },
  { value: 'police', label: 'Police', icon: IoShieldCheckmarkOutline, hint: 'Crime, violence, immediate safety threat' },
] as const;

export default function EmergencySOS() {
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);
  const sos = useSOS();
  const { data: emergency } = useActiveEmergency();
  const ambulanceLocation = useAmbulanceTrack(emergency?.assigned_ambulance_id ?? undefined);
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]['value']>('medical');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const trigger = () => {
    if (emergency) return toast('info', 'You already have an active emergency');
    if (!('geolocation' in navigator)) return toast('error', 'Geolocation unavailable on this device');

    navigator.geolocation.getCurrentPosition(
      (pos) => sos.mutate(
        {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          type: scenario,
          city: profile?.city ?? undefined,
        },
        {
          onSuccess: () => toast(
            'success',
            scenario.charAt(0).toUpperCase() + scenario.slice(1) + ' SOS sent — emergency response has been alerted',
          ),
        },
      ),
      () => toast('error', 'Location permission is required for SOS'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 },
    );
  };

  const currentStep = emergency ? STEPS.indexOf(emergency.status as (typeof STEPS)[number]) : -1;
  const locationAge = ambulanceLocation
    ? Math.max(0, Math.floor((now - Date.parse(ambulanceLocation.at)) / 1000))
    : null;
  const selectedScenario = SCENARIOS.find((item) => item.value === scenario)!;
  const SelectedIcon = selectedScenario.icon;

  return (
    <PageTransition>
      <PageHeader title="Emergency SOS" subtitle="One-action emergency reporting with location-aware response routing." />

      {!emergency && (
        <Card className="mb-6">
          <CardHeader title="What happened?" subtitle="Choose the emergency type before sending SOS." />
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {SCENARIOS.map((item) => {
              const Icon = item.icon;
              const active = item.value === scenario;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setScenario(item.value)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-danger-400 bg-danger-50/70 shadow-sm dark:border-danger-800 dark:bg-danger-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      active ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/60 dark:text-danger-300' : 'bg-slate-100 text-slate-500 dark:bg-surface-dark-muted',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-danger-600 dark:text-danger-400">
            {emergency ? 'Emergency active' : selectedScenario.label + ' SOS'}
          </p>
          <button
            onClick={trigger}
            disabled={sos.isPending || !!emergency}
            aria-label={'Trigger ' + selectedScenario.label + ' emergency SOS'}
            className="flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 animate-sos-ring disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1">
              <SelectedIcon className="h-10 w-10" />
              <span className="text-xl font-bold tracking-widest">{sos.isPending ? 'SENDING…' : 'SOS'}</span>
            </span>
          </button>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Your current GPS position is sent to the authorized emergency dispatch network. For immediate danger, also use the appropriate local emergency telephone service.
          </p>
          {(profile?.emergency_contacts ?? []).length > 0 && (
            <div className="w-full rounded-xl bg-surface-muted p-4 text-left dark:bg-surface-dark-muted">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency contacts</p>
              {profile!.emergency_contacts.map((c, i) => (
                <p key={i} className="mt-1.5 text-sm">
                  {c.name} · {c.relation} · <a className="text-brand-600" href={'tel:' + c.phone}>{c.phone}</a>
                </p>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Response status" subtitle={emergency ? 'Event ' + emergency.id.slice(0, 8) + '…' : 'No active event'} />
          <div className="p-5">
            {!emergency && <EmptyState title="No active emergency" hint="Your SOS status and responder assignment will appear here when a request is active." />}
            {emergency && (
              <>
                <div className="mb-5 rounded-2xl bg-surface-muted p-4 dark:bg-surface-dark-muted">
                  <p className="text-sm font-semibold capitalize">{emergency.type} emergency</p>
                  <p className="mt-1 text-xs text-muted-foreground">The response network may involve multiple agencies depending on the incident type.</p>
                </div>
                <ol className="space-y-4">
                  {STEPS.map((step, i) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                        i <= currentStep ? 'bg-success text-white' : 'bg-slate-100 text-slate-400 dark:bg-surface-dark-muted',
                      )}>
                        {i <= currentStep ? <IoCheckmarkCircle className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className={cn('text-sm capitalize', i <= currentStep ? 'font-medium' : 'text-slate-400')}>
                        {step.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ol>

                {emergency.assigned_ambulance_id && (
                  <div className="mt-5 space-y-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <IoNavigateOutline /> Ambulance assigned
                    </div>
                    {ambulanceLocation ? (
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-950/30">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <IoLocationOutline /> Live GPS
                          <span className="ml-auto font-normal text-slate-500 dark:text-slate-400">
                            {locationAge != null && locationAge < 20 ? 'live' : locationAge != null ? locationAge + 's old' : ''}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs">{ambulanceLocation.lat.toFixed(5)}, {ambulanceLocation.lng.toFixed(5)}</p>
                        <a
                          className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                          href={'https://www.google.com/maps/search/?api=1&query=' + ambulanceLocation.lat + ',' + ambulanceLocation.lng}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open ambulance location
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Waiting for the driver's first GPS sample.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
