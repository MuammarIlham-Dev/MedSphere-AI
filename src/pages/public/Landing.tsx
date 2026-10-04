import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IoArrowForwardOutline, IoBedOutline, IoBodyOutline, IoBusinessOutline,
  IoCalendarOutline, IoCarOutline, IoCheckmarkCircleOutline, IoChevronForwardOutline,
  IoCloseOutline, IoDocumentTextOutline, IoGlobeOutline, IoHeartOutline,
  IoLocationOutline, IoLockClosedOutline, IoMedkitOutline, IoMedicalOutline,
  IoMenuOutline, IoPeopleOutline, IoPulseOutline, IoSearchOutline,
  IoShieldCheckmarkOutline, IoSparklesOutline, IoStatsChartOutline,
  IoVideocamOutline, IoWarningOutline, IoWaterOutline,
} from 'react-icons/io5';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ToastHost';

const intentCards = [
  { icon: IoMedicalOutline, title: 'Find a doctor', description: 'Discover care by specialty and move into appointment scheduling.', to: '/app/directory', tone: 'brand', tag: 'CARE' },
  { icon: IoBusinessOutline, title: 'Find a hospital', description: 'Explore hospitals, services and connected operational care.', to: '/app/directory', tone: 'indigo', tag: 'FACILITIES' },
  { icon: IoCalendarOutline, title: 'Book a doctor', description: 'Move from finding the right clinician to a confirmed visit.', to: '/app/appointments', tone: 'violet', tag: 'APPOINTMENTS' },
  { icon: IoBedOutline, title: 'Find a bed', description: 'See citizen-visible hospital capacity and request a bed.', to: '/app/bed-booking', tone: 'cyan', tag: 'CAPACITY' },
  { icon: IoWaterOutline, title: 'Blood support', description: 'Enter the donor and request network when blood is needed.', to: '/app/blood-network', tone: 'rose', tag: 'LIFESAVING' },
  { icon: IoBodyOutline, title: 'Organ donation', description: 'Join the registry and coordinator-led matching workflow.', to: '/app/organ-registry', tone: 'amber', tag: 'LIFESAVING' },
];

const journey = [
  ['01', 'Discover', 'Find the right doctor, hospital, service or emergency pathway.'],
  ['02', 'Decide', 'Compare options, availability and the next appropriate action.'],
  ['03', 'Connect', 'Book appointments, consult remotely or begin a care workflow.'],
  ['04', 'Coordinate', 'Keep patients, clinicians and operational teams aligned.'],
  ['05', 'Continue', 'Carry important health information forward through the journey.'],
];

const networkRoles = [
  { icon: IoHeartOutline, title: 'Citizens', text: 'Care discovery, records, appointments, donations and emergency access.', to: '/register' },
  { icon: IoMedicalOutline, title: 'Doctors', text: 'Schedules, patients, consultations and professional clinical workflows.', to: '/login' },
  { icon: IoBusinessOutline, title: 'Hospitals', text: 'Beds, queues, inpatient operations, laboratory and blood workflows.', to: '/login' },
  { icon: IoStatsChartOutline, title: 'Public health', text: 'Connected signals, preparedness and population-level intelligence.', to: '/login' },
];

const trustItems = [
  ['Access control', 'Role-aware boundaries for citizens, clinicians, facilities and operators.'],
  ['Data security', 'RLS-backed data access with explicit workflow boundaries.'],
  ['Responsible AI', 'AI supports understanding and navigation while clinical judgment stays human.'],
  ['Emergency pathways', 'Dedicated escalation flows instead of burying lifesaving actions inside the normal journey.'],
];

const iconTones: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
};

function IconBox({ icon: Icon, tone = 'brand', large = false }: { icon: typeof IoSearchOutline; tone?: string; large?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl ${large ? 'h-14 w-14' : 'h-11 w-11'} ${iconTones[tone] ?? iconTones.brand}`}>
      <Icon className={large ? 'h-7 w-7' : 'h-5 w-5'} />
    </div>
  );
}

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-lift transition group-hover:-rotate-3">
        <IoMedkitOutline className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[17px] font-black tracking-tight text-slate-950 dark:text-white">MedSphere <span className="text-brand-600">AI</span></div>
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Connected healthcare</div>
      </div>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, text, align = 'left' }: { eyebrow: string; title: string; text: string; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <Badge tone="brand">{eyebrow}</Badge>
      <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl dark:text-white">{title}</h2>
      <p className="mt-4 text-[15px] leading-7 text-slate-600 sm:text-base dark:text-slate-300">{text}</p>
    </div>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfdfe] text-slate-900 dark:bg-surface-dark dark:text-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#fbfdfe]/90 backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark/90">
        <div className="container flex h-[72px] items-center justify-between px-4">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            <a href="#care" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">Care</a>
            <a href="#lifesaving" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">Lifesaving</a>
            <a href="#intelligence" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">AI</a>
            <a href="#network" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">Network</a>
            <a href="#trust" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">Trust</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/register" className="hidden sm:block"><Button>Get started</Button></Link>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileMenuOpen ? <IoCloseOutline className="h-5 w-5" /> : <IoMenuOutline className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-[#fbfdfe] p-4 lg:hidden dark:border-white/10 dark:bg-surface-dark">
            <div className="grid gap-1">
              {[
                ['care', 'Care'],
                ['lifesaving', 'Lifesaving'],
                ['intelligence', 'AI'],
                ['network', 'Network'],
                ['trust', 'Trust'],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-white dark:hover:bg-white/5">{label}</a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                <Link to="/login"><Button variant="secondary" className="w-full">Sign in</Button></Link>
                <Link to="/register"><Button className="w-full">Get started</Button></Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-slate-200/70 bg-white dark:border-white/10 dark:bg-surface-dark">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(6,182,212,.13),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(14,116,144,.10),transparent_26%)]" />
          <div className="pointer-events-none absolute -right-24 top-36 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />

          <div className="container relative px-4 pb-12 pt-12 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.04fr_.96fr] xl:gap-20">
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge tone="brand"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Connected healthcare platform</Badge>
                  <span className="text-xs font-semibold text-slate-400">Built for real-world care coordination</span>
                </div>

                <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[5rem] dark:text-white">
                  Healthcare should work like a <span className="text-brand-600">network.</span>
                </h1>

                <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 dark:text-slate-300">
                  MedSphere AI brings care discovery, appointments, medical records, telemedicine, hospital capacity, blood and organ coordination, and emergency response into one connected experience.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/register"><Button size="lg" className="w-full px-7 sm:w-auto">Create your Health ID <IoArrowForwardOutline /></Button></Link>
                  <Link to="/login"><Button size="lg" variant="secondary" className="w-full px-7 sm:w-auto">Enter the care network</Button></Link>
                </div>

                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {['Citizen-first', 'Role-aware', 'Emergency-ready', 'Human-led care'].map((item) => (
                    <span key={item} className="flex items-center gap-1.5"><IoCheckmarkCircleOutline className="h-4 w-4 text-emerald-500" />{item}</span>
                  ))}
                </div>
              </div>

              <div className="relative lg:pl-4">
                <div className="rounded-[2rem] border border-slate-200/80 bg-slate-50 p-2 shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-white/[.04]">
                  <div className="overflow-hidden rounded-[1.65rem] bg-slate-950 p-5 text-white sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">MedSphere Health Command Center</p>
                        <h2 className="mt-2 text-xl font-extrabold tracking-tight">What do you need right now?</h2>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2.5"><IoShieldCheckmarkOutline className="h-5 w-5 text-emerald-400" /></div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-3">
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <IoSearchOutline className="h-5 w-5" />
                        <span>Search doctors, hospitals, services…</span>
                        <span className="ml-auto rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">SMART SEARCH</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {[
                        [IoMedicalOutline, 'Find a doctor', '/app/directory'],
                        [IoBusinessOutline, 'Find a hospital', '/app/directory'],
                        [IoCalendarOutline, 'Book appointment', '/app/appointments'],
                        [IoBedOutline, 'Find a bed', '/app/bed-booking'],
                      ].map(([Icon, label, to]) => (
                        <Link key={String(label)} to={String(to)} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3.5 transition hover:-translate-y-0.5 hover:bg-white/[.07]">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300"><Icon className="h-5 w-5" /></div>
                          <span className="text-sm font-semibold">{label}</span>
                          <IoChevronForwardOutline className="ml-auto h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5" />
                        </Link>
                      ))}
                    </div>

                    <Link to="/app/emergency" className="mt-3 flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 transition hover:bg-red-500/15">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,.12)]"><IoPulseOutline className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold">Emergency SOS</p>
                        <p className="mt-0.5 text-xs text-slate-400">SOS • ambulance • responders • hospital handoff</p>
                      </div>
                      <IoArrowForwardOutline className="ml-auto h-5 w-5 shrink-0 text-red-300" />
                    </Link>

                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Care</p><p className="mt-1 text-xs font-semibold">Discover → book</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lifesaving</p><p className="mt-1 text-xs font-semibold">Blood • organ • SOS</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Intelligence</p><p className="mt-1 text-xs font-semibold">AI-assisted</p></div>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:flex dark:border-white/10 dark:bg-surface-dark-soft">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><IoLockClosedOutline className="h-4 w-4" /></div>
                  <div><p className="text-xs font-bold">Safety by design</p><p className="text-[10px] text-slate-400">Controlled access • human oversight</p></div>
                </div>
              </div>
            </div>

            <div className="mt-16 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/[.035]">
              <div className="grid gap-2 md:grid-cols-5">
                {journey.map(([num, title, text], i) => (
                  <div key={num} className="group rounded-2xl bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/[.035]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-[0.2em] text-brand-600">{num}</span>
                      {i < journey.length - 1 && <IoChevronForwardOutline className="hidden h-4 w-4 text-slate-300 md:block dark:text-slate-600" />}
                    </div>
                    <h3 className="mt-4 text-sm font-extrabold">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Intent-first care discovery */}
        <section id="care" className="scroll-mt-20 bg-[#f6fafb] py-16 sm:py-24 dark:bg-surface-dark-soft">
          <div className="container px-4">
            <SectionHeading
              eyebrow="Start with intent"
              title="The homepage should answer one question first: what are you trying to do?"
              text="Instead of making people scan a catalogue of features, MedSphere AI puts the most common healthcare actions at the point of entry."
            />

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {intentCards.map(({ icon: Icon, title, description, to, tone, tag }) => (
                <Link key={title} to={to} className="group">
                  <Card className="h-full overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <IconBox icon={Icon} tone={tone} large />
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black tracking-[0.16em] text-slate-400 dark:bg-white/5">{tag}</span>
                      </div>
                      <h3 className="mt-6 text-lg font-extrabold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm font-bold text-brand-700 dark:border-white/5 dark:text-brand-300">
                      Explore pathway <IoArrowForwardOutline className="transition group-hover:translate-x-1" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
              <Link to="/app/consult" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-lg dark:border-white/10 dark:bg-surface-dark">
                <IconBox icon={IoVideocamOutline} tone="violet" />
                <div><p className="font-extrabold">Need care from home?</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter telemedicine and continue through a dedicated consultation room.</p></div>
                <IoArrowForwardOutline className="ml-auto text-brand-600 transition group-hover:translate-x-1" />
              </Link>
              <Link to="/app/records" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-lg dark:border-white/10 dark:bg-surface-dark">
                <IconBox icon={IoDocumentTextOutline} tone="emerald" />
                <div><p className="font-extrabold">Continue your health record</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep important information organized across connected care.</p></div>
                <IoArrowForwardOutline className="ml-auto text-brand-600 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* Lifesaving */}
        <section id="lifesaving" className="scroll-mt-20 border-y border-red-100 bg-white py-16 sm:py-24 dark:border-red-900/20 dark:bg-surface-dark">
          <div className="container px-4">
            <div className="grid items-start gap-10 lg:grid-cols-[.86fr_1.14fr] lg:gap-16">
              <div className="lg:sticky lg:top-28">
                <Badge tone="danger">Lifesaving network</Badge>
                <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">When the situation is urgent, the interface must become simpler.</h2>
                <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">
                  MedSphere AI separates lifesaving pathways from routine care so SOS, ambulance coordination, hospital handoff, blood support and organ coordination are easy to reach when pressure is high.
                </p>
                <Link to="/app/emergency" className="mt-7 inline-flex"><Button size="lg" variant="danger">Open Emergency SOS <IoArrowForwardOutline /></Button></Link>
                <div className="mt-7 rounded-2xl border border-red-100 bg-red-50/70 p-4 dark:border-red-900/20 dark:bg-red-950/20">
                  <div className="flex gap-3">
                    <IoWarningOutline className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-xs leading-5 text-red-800 dark:text-red-200">Emergency access is designed as a dedicated path; informational AI is not a substitute for emergency services or professional medical care.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [IoPulseOutline, 'Emergency SOS', 'Start the emergency pathway and move into dispatch, responder and hospital coordination.', '/app/emergency', 'danger'],
                  [IoCarOutline, 'Ambulance response', 'Support driver and operator workflows around an active emergency journey.', '/app/emergency', 'brand'],
                  [IoWaterOutline, 'Blood network', 'Connect donor registration, live lifesaving requests and authorized fulfillment workflows.', '/app/blood-network', 'rose'],
                  [IoBodyOutline, 'Organ coordination', 'Support registry and coordinator-led matching across the organ network.', '/app/organ-registry', 'amber'],
                  [IoBedOutline, 'Hospital capacity', 'Make citizen-visible bed availability and booking requests easier to reach.', '/app/bed-booking', 'cyan'],
                  [IoLocationOutline, 'Location-aware response', 'Use the response journey to keep patient location and destination context together.', '/app/emergency', 'indigo'],
                ].map(([Icon, title, text, to, tone], i) => (
                  <Link key={String(title)} to={String(to)} className="group">
                    <Card className={`h-full p-5 transition hover:-translate-y-1 hover:shadow-xl ${i === 0 ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/15' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <IconBox icon={Icon} tone={String(tone)} />
                        <IoArrowForwardOutline className="mt-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-1 dark:text-slate-600" />
                      </div>
                      <h3 className="mt-5 font-extrabold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Intelligence */}
        <section id="intelligence" className="scroll-mt-20 bg-slate-950 py-16 text-white sm:py-24">
          <div className="container px-4">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
              <div>
                <Badge tone="neutral" className="bg-white/10 text-cyan-200">MedSphere AI</Badge>
                <h2 className="mt-5 text-3xl font-black tracking-[-0.03em] sm:text-5xl">Intelligence that helps people understand the next step.</h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                  The AI layer is positioned as a safety-oriented assistant around the healthcare network: helping users navigate information, understand context and prepare for professional care.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    ['RAG-based knowledge', IoDocumentTextOutline],
                    ['Safety-first answers', IoShieldCheckmarkOutline],
                    ['Human oversight', IoPeopleOutline],
                    ['Care navigation', IoArrowForwardOutline],
                  ].map(([label, Icon]) => (
                    <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.045] p-4">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[.045] p-2 shadow-2xl">
                <div className="rounded-[1.6rem] bg-[#111a27] p-5 sm:p-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300"><IoSparklesOutline className="h-5 w-5" /></div>
                    <div><p className="text-sm font-bold">MedSphere AI Assistant</p><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Safety-oriented guidance</p></div>
                    <div className="ml-auto flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,.12)]" />
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-white/10 p-3.5 text-sm leading-6 text-slate-200">I have a new health concern. What should I do next?</div>
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/10 bg-slate-950/70 p-4">
                      <p className="text-sm leading-6 text-slate-300">I can help you understand available care pathways and prepare questions for a clinician. I will not diagnose or replace professional medical judgment.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400">Knowledge context</span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400">Safety boundary</span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400">Clinician handoff</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Network */}
        <section id="network" className="scroll-mt-20 bg-[#f6fafb] py-16 sm:py-24 dark:bg-surface-dark-soft">
          <div className="container px-4">
            <SectionHeading
              eyebrow="One network, many workspaces"
              title="Every role gets the tools it needs without losing the bigger picture."
              text="The public experience leads with the citizen journey; behind it, each healthcare role receives a dedicated operational workspace."
              align="center"
            />

            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {networkRoles.map(({ icon: Icon, title, text, to }) => (
                <Link key={title} to={to} className="group">
                  <Card className="h-full p-6 transition hover:-translate-y-1 hover:shadow-xl">
                    <IconBox icon={Icon} large />
                    <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                    <div className="mt-6 flex items-center text-sm font-bold text-brand-700 dark:text-brand-300">Open workspace <IoArrowForwardOutline className="ml-1.5 transition group-hover:translate-x-1" /></div>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-[2rem] bg-white shadow-card dark:bg-surface-dark">
              <div className="grid lg:grid-cols-[1.2fr_.8fr]">
                <div className="p-7 sm:p-9">
                  <Badge tone="brand">Connected operations</Badge>
                  <h3 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Care can move between people without becoming fragmented.</h3>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      [IoCalendarOutline, 'Appointments', 'Schedule → consult → follow-up'],
                      [IoDocumentTextOutline, 'Records', 'Capture → access → continue care'],
                      [IoBusinessOutline, 'Facilities', 'Beds → queue → operations'],
                    ].map(([Icon, title, text]) => (
                      <div key={String(title)} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                        <Icon className="h-5 w-5 text-brand-600" />
                        <p className="mt-3 text-sm font-extrabold">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative overflow-hidden bg-brand-700 p-7 text-white sm:p-9">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />
                  <div className="pointer-events-none absolute -right-7 -top-7 h-32 w-32 rounded-full border border-white/10" />
                  <IoGlobeOutline className="h-8 w-8 text-cyan-200" />
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100">Platform direction</p>
                  <p className="mt-2 text-2xl font-black">Built to grow into a national connected healthcare network.</p>
                  <p className="mt-3 text-sm leading-6 text-cyan-50/80">Start with useful, local care journeys and connect more providers, services and public-health capabilities over time.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="scroll-mt-20 bg-white py-16 sm:py-24 dark:bg-surface-dark">
          <div className="container px-4">
            <div className="grid gap-10 lg:grid-cols-[.86fr_1.14fr] lg:items-center">
              <div>
                <Badge tone="success">Trust & safety</Badge>
                <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">A healthcare interface has to earn confidence.</h2>
                <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">Security, role boundaries, auditable workflows and responsible AI should be visible in the experience—not hidden as implementation details.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {trustItems.map(([title, text], i) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[.035]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/5"><span className="text-xs font-black text-brand-700 dark:text-brand-300">0{i + 1}</span></div>
                      <h3 className="font-extrabold">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[.035]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"><IoLockClosedOutline /></div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">Health information should stay within the right workflow.</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">The platform is designed around explicit role-based access rather than treating healthcare data like ordinary social content.</p>
                </div>
                <Link to="/register" className="md:ml-auto"><Button variant="secondary">Create Health ID <IoArrowForwardOutline /></Button></Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#f6fafb] py-16 sm:py-24 dark:bg-surface-dark-soft">
          <div className="container px-4">
            <div className="relative overflow-hidden rounded-[2.25rem] bg-slate-950 px-6 py-14 text-center text-white shadow-2xl sm:px-12 sm:py-18">
              <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><IoHeartOutline className="h-6 w-6 text-cyan-200" /></div>
                <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black tracking-[-0.03em] sm:text-5xl">One place to start. A network to carry the journey.</h2>
                <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Create your MedSphere Health ID and enter a connected healthcare experience built around care, coordination and lifesaving response.</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link to="/register"><Button size="lg" className="w-full sm:w-auto">Create Health ID <IoArrowForwardOutline /></Button></Link>
                  <Link to="/login"><Button size="lg" variant="secondary" className="w-full sm:w-auto">Sign in</Button></Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-surface-dark">
        <div className="container px-4 py-12">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">A connected healthcare platform bringing citizens, clinicians, hospitals, emergency services and public-health operations closer together.</p>
            </div>
            <div><p className="font-bold">Care</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/app/directory" className="hover:text-brand-600">Find care</Link><Link to="/app/appointments" className="hover:text-brand-600">Appointments</Link><Link to="/app/consult" className="hover:text-brand-600">Telemedicine</Link><Link to="/app/records" className="hover:text-brand-600">Medical records</Link></div></div>
            <div><p className="font-bold">Lifesaving</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/app/blood-network" className="hover:text-brand-600">Blood network</Link><Link to="/app/organ-registry" className="hover:text-brand-600">Organ registry</Link><Link to="/app/emergency" className="hover:text-brand-600">Emergency SOS</Link><Link to="/app/bed-booking" className="hover:text-brand-600">Hospital beds</Link></div></div>
            <div><p className="font-bold">Platform</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/register" className="hover:text-brand-600">Create Health ID</Link><Link to="/login" className="hover:text-brand-600">Provider portal</Link><a href="#trust" className="hover:text-brand-600">Trust & security</a><a href="#network" className="hover:text-brand-600">Network</a></div></div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p>© {new Date().getFullYear()} MedSphere AI. All rights reserved.</p>
            <p className="max-w-xl">MedSphere AI provides informational and coordination tools. It does not replace diagnosis, treatment or advice from licensed healthcare professionals.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
