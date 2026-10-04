import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { Popover } from '@/components/ui/Popover';
import { formatDateTime } from '@/lib/utils';
import { IoCalendarOutline, IoWaterOutline, IoMedkitOutline, IoDocumentTextOutline, IoHeartOutline, IoBodyOutline, IoBarbellOutline } from 'react-icons/io5';
import { Link } from 'react-router-dom';
import { useMyAppointments } from '@/hooks/queries/useAppointmentQueries';
import { useMyPrescriptions, useMyMedicalRecords, useMyLabReports } from '@/hooks/queries/useEhrQueries';
import { useAuthStore } from '@/stores/authStore';
import { useRef, useState } from 'react';
import { useReveal } from '@/lib/gsap';
import { AiSymptomChecker } from '@/components/intelligence/AiSymptomChecker';
import { Modal } from '@/components/ui/Modal';
import { Sparkles, AlertTriangle, Clock3 } from 'lucide-react';
import { useDonorProfile } from '@/hooks/queries/useBloodQueries';
import { useDonorBloodBroadcasts } from '@/hooks/queries/useBloodBroadcastQueries';

export default function CitizenDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: appointments, isLoading } = useMyAppointments();
  const { data: prescriptions } = useMyPrescriptions();
  const { data: records } = useMyMedicalRecords();
  const { data: labs } = useMyLabReports();
  const [showAiChecker, setShowAiChecker] = useState(false);
  const { data: donor } = useDonorProfile();
  const bloodAlerts = useDonorBloodBroadcasts();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const upcoming = (appointments ?? []).filter((a) => new Date(a.scheduled_at) > new Date() && a.status !== 'cancelled');
  const activePrescriptions = (prescriptions ?? []).filter(p => p.status === 'active').length;
  const docsCount = (records?.length ?? 0) + (labs?.length ?? 0);
  const activeBloodAlerts = bloodAlerts.data ?? [];

  return (
    <PageTransition>
      <div ref={rootRef}>
        <PageHeader title={`Hello, ${profile?.full_name.split(' ')[0] ?? 'there'}`}
          subtitle={`Digital Health ID: ${profile?.digital_health_id ?? '—'}`}
          actions={
            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={() => setShowAiChecker(true)} className="flex-1 sm:flex-initial gap-2 text-brand-600 border-brand-200 bg-brand-50 hover:bg-brand-100">
                <Sparkles className="w-4 h-4" /> AI Symptom Checker
              </Button>
              <Link to="/app/emergency" className="flex-1 sm:flex-initial"><Button variant="danger" className="w-full">Emergency SOS</Button></Link>
            </div>
          } />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Upcoming appointments" value={upcoming.length} icon={<IoCalendarOutline className="h-5 w-5" />} />
          <Link to="/app/blood" className="group">
            <KpiCard label="Blood Donation" value={profile?.blood_group ?? 'Join Network'} icon={<IoWaterOutline className="h-5 w-5 group-hover:text-rose-500 transition-colors" />} />
          </Link>
          <Link to="/app/organ-registry" className="group">
            <KpiCard label="Organ Donor" value="Register Consent" icon={<IoHeartOutline className="h-5 w-5 group-hover:text-rose-500 transition-colors" />} />
          </Link>
          <Link to="/app/records" className="group">
            <KpiCard label="Active prescriptions" value={activePrescriptions} icon={<IoMedkitOutline className="h-5 w-5 group-hover:text-brand-600 transition-colors" />} />
          </Link>
          <Link to="/app/records" className="group">
            <KpiCard label="Health documents" value={docsCount} icon={<IoDocumentTextOutline className="h-5 w-5 group-hover:text-brand-600 transition-colors" />} />
          </Link>
        </div>

        {activeBloodAlerts.length > 0 && donor?.is_eligible && donor?.is_available && (
          <Link to="/app/blood" className="mt-6 block">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300"><AlertTriangle className="h-5 w-5"/><span className="font-bold">Blood help may be needed in your city</span></div>
                  <p className="mt-1 text-sm text-red-700/80 dark:text-red-200/80">{activeBloodAlerts.filter(a=>a.broadcast_mode==='emergency').length ? 'An emergency-compatible blood broadcast is active.' : 'A verified hospital has an active blood donor request.'} Open Blood Network to review the hospital and response window.</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Clock3 className="h-4 w-4"/>{activeBloodAlerts.length} active alert{activeBloodAlerts.length===1?'':'s'}</span>
              </div>
            </div>
          </Link>
        )}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card data-reveal>
            <CardHeader title="Upcoming appointments" subtitle="Your next consultations"
              action={<Link to="/app/directory"><Button size="sm" variant="secondary">Book new</Button></Link>} />
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading && [0, 1, 2].map((i) => <li key={i} className="p-5"><Skeleton className="h-10 w-full" /></li>)}
              {!isLoading && upcoming.length === 0 && (
                <li className="p-5"><EmptyState title="No upcoming appointments" hint="Find a doctor and book your first consultation." /></li>
              )}
              {upcoming.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">{a.doctor_name ?? 'Doctor'} · <span className="text-slate-400">{a.specialty}</span></p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(a.scheduled_at)} · Token #{a.token_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={a.type === 'video' ? 'info' : 'brand'}>{a.type}</Badge>
                    {a.type === 'video' && <Link to={`/app/consult/${a.id}`}><Button size="sm" variant="secondary">Join</Button></Link>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {/* Health Metrics */}
          <Card data-reveal className="flex flex-col">
            <CardHeader title="Health Metrics" subtitle="Calculated from your profile data" />
            <div className="flex-1 p-6 pt-0">
              {(() => {
                const p = profile;
                if (!p?.weight_kg || !p?.height_cm || !p?.dob || !p?.gender || p.gender === 'other') {
                  return (
                    <EmptyState 
                      title="Incomplete Profile" 
                      hint="Please update your weight, height, date of birth, and gender to view your health metrics."
                      action={<Link to="/app/profile"><Button size="sm">Update Profile</Button></Link>}
                    />
                  );
                }
                
                // Calculate age
                const dob = new Date(p.dob);
                const diff = Date.now() - dob.getTime();
                const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                
                // Calculate BMI
                const bmi = p.weight_kg / Math.pow(p.height_cm / 100, 2);
                let bmiTone: 'danger' | 'warning' | 'success' | 'brand' = 'success';
                let bmiLabel = 'Normal weight';
                if (bmi < 18.5) { bmiTone = 'warning'; bmiLabel = 'Underweight'; }
                else if (bmi >= 25 && bmi < 30) { bmiTone = 'warning'; bmiLabel = 'Overweight'; }
                else if (bmi >= 30) { bmiTone = 'danger'; bmiLabel = 'Obese'; }

                // Calculate BMR (Mifflin-St Jeor)
                const bmrBase = (10 * p.weight_kg) + (6.25 * p.height_cm) - (5 * age);
                const bmr = p.gender === 'male' ? bmrBase + 5 : bmrBase - 161;
                
                // Calculate TDEE (Sedentary)
                const tdee = bmr * 1.2;

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-brand-100 p-2 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400">
                          <IoBodyOutline className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">BMI (Body Mass Index)</p>
                            <Popover>
                              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                <p><strong>Body Mass Index</strong> is a measure of body fat based on height and weight.</p>
                                <ul className="space-y-1">
                                  <li>⚠️ Under 18.5: Underweight</li>
                                  <li>✅ 18.5 - 24.9: Healthy Weight</li>
                                  <li>⚠️ 25.0 - 29.9: Overweight</li>
                                  <li>🛑 30.0+: Obese</li>
                                </ul>
                              </div>
                            </Popover>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Healthy range: 18.5 - 24.9</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{bmi.toFixed(1)}</p>
                        <Badge tone={bmiTone} className="mt-1">{bmiLabel}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                          <IoHeartOutline className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">BMR (Basal Metabolic Rate)</p>
                            <Popover>
                              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                <p><strong>BMR</strong> is the number of calories your body burns at complete rest.</p>
                                <p>Your body uses this energy to:</p>
                                <ul className="space-y-1">
                                  <li>❤️ Keep your heart beating</li>
                                  <li>🫁 Breathe</li>
                                  <li>🧠 Maintain brain function</li>
                                  <li>🌡️ Regulate body temperature</li>
                                  <li>🧬 Perform basic cell functions</li>
                                </ul>
                              </div>
                            </Popover>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Calories burned at rest</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.round(bmr)} <span className="text-sm font-normal text-slate-500">kcal</span></p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                          <IoBarbellOutline className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">TDEE</p>
                            <Popover>
                              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                <p><strong>Total Daily Energy Expenditure</strong> is how many calories you burn per day.</p>
                                <p>It is calculated by multiplying your BMR by your activity level.</p>
                                <ul className="space-y-1">
                                  <li>🛋️ <strong>Sedentary:</strong> Little or no exercise</li>
                                  <li>🚶 <strong>Light:</strong> Exercise 1-3 days/week</li>
                                  <li>🏃 <strong>Moderate:</strong> Exercise 3-5 days/week</li>
                                  <li>🏋️ <strong>Active:</strong> Hard exercise 6-7 days/week</li>
                                </ul>
                              </div>
                            </Popover>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Daily energy expenditure (Sedentary)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.round(tdee)} <span className="text-sm font-normal text-slate-500">kcal</span></p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </Card>
        </div>
      </div>
      <Modal open={showAiChecker} onClose={() => setShowAiChecker(false)} title="AI Symptom Checker" wide>
        <AiSymptomChecker />
      </Modal>
    </PageTransition>
  );
}
