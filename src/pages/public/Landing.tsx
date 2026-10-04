import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IoMedkitOutline, IoShieldCheckmarkOutline, IoPulseOutline, IoPeopleOutline,
  IoMenuOutline, IoCloseOutline, IoBusinessOutline, IoWaterOutline, IoBodyOutline,
  IoVideocamOutline, IoChevronForwardOutline, IoCalendarOutline, IoDocumentTextOutline,
  IoSearchOutline, IoLocationOutline, IoHeartOutline, IoChatbubbleEllipsesOutline,
  IoFlaskOutline, IoMedicalOutline, IoCarOutline, IoWarningOutline, IoSparklesOutline,
  IoCheckmarkCircleOutline, IoArrowForwardOutline, IoLockClosedOutline,
  IoStatsChartOutline, IoGlobeOutline,
} from 'react-icons/io5';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ToastHost';

const services = [
  { icon: IoSearchOutline, title: 'Find care', description: 'Discover hospitals, doctors and healthcare facilities across the network.', to: '/app/directory', tone: 'brand' },
  { icon: IoCalendarOutline, title: 'Doctor appointments', description: 'Find a suitable doctor and manage appointments from one place.', to: '/app/appointments', tone: 'indigo' },
  { icon: IoVideocamOutline, title: 'Telemedicine', description: 'Connect with your doctor remotely through a dedicated consultation room.', to: '/app/consult', tone: 'violet' },
  { icon: IoBedOutline, title: 'Hospital beds', description: 'Explore hospital bed availability and submit a booking request.', to: '/app/bed-booking', tone: 'cyan' },
  { icon: IoWaterOutline, title: 'Blood network', description: 'Register as a donor, find compatible blood support and coordinate requests.', to: '/app/blood-network', tone: 'rose' },
  { icon: IoBodyOutline, title: 'Organ donation', description: 'Participate in the organ registry and coordinator-led matching workflow.', to: '/app/organ-registry', tone: 'amber' },
  { icon: IoDocumentTextOutline, title: 'Medical records', description: 'Keep your health information organized and available when you need it.', to: '/app/records', tone: 'emerald' },
  { icon: IoMedicalOutline, title: 'Laboratory & pharmacy', description: 'Connect the care journey with laboratory and medicine services.', to: '/login', tone: 'sky' },
];

const roleCards = [
  { icon: IoHeartOutline, title: 'For citizens', description: 'One place for everyday healthcare, records, appointments, donations and emergency support.', to: '/register' },
  { icon: IoMedicalOutline, title: 'For doctors', description: 'Patient care, schedules, consultations and clinical workflows in one professional workspace.', to: '/login' },
  { icon: IoBusinessOutline, title: 'For hospitals', description: 'Coordinate beds, queues, inpatient operations, blood and laboratory workflows.', to: '/login' },
  { icon: IoStatsChartOutline, title: 'For public health', description: 'Turn connected healthcare activity into stronger preparedness and response.', to: '/login' },
];

const trustItems = [
  'Role-based access control',
  'Row-level data security',
  'Audit-ready healthcare workflows',
  'Emergency escalation pathways',
  'AI designed with human oversight',
  'Privacy-conscious health data handling',
];

function ServiceIcon({ icon: Icon, tone }: { icon: typeof IoSearchOutline; tone: string }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  };
  return <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone] ?? tones.brand}`}><Icon className="h-6 w-6" /></div>;
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 dark:bg-surface-dark dark:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark/90">
        <div className="container flex h-16 items-center justify-between px-4 sm:h-[72px]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
              <IoMedkitOutline className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight">MedSphere <span className="text-brand-600">AI</span></span>
              <span className="hidden pl-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:inline">Connected Healthcare</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <a href="#services" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5">Services</a>
            <a href="#emergency" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5">Emergency</a>
            <a href="#ecosystem" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5">Ecosystem</a>
            <a href="#trust" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5">Trust & security</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/register" className="hidden sm:block"><Button>Get started</Button></Link>
            <button onClick={() => setMobileMenuOpen((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white" aria-label="Open navigation">
              {mobileMenuOpen ? <IoCloseOutline className="h-5 w-5" /> : <IoMenuOutline className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white p-4 lg:hidden dark:border-white/10 dark:bg-surface-dark">
            <div className="grid gap-1">
              {['services', 'emergency', 'ecosystem', 'trust'].map((id) => (
                <a key={id} href={`#${id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold capitalize hover:bg-slate-50 dark:hover:bg-white/5">{id.replace('-', ' ')}</a>
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
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white dark:from-brand-950/30 dark:via-surface-dark dark:to-surface-dark">
          <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-brand-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="container relative px-4 pb-16 pt-12 sm:pb-24 sm:pt-20 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
              <div>
                <Badge tone="brand" className="mb-5">A connected national healthcare platform</Badge>
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl sm:leading-[1.05] lg:text-7xl dark:text-white">
                  One health platform for <span className="bg-gradient-to-r from-brand-500 via-brand-600 to-cyan-500 bg-clip-text text-transparent">every moment of care.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-8 dark:text-slate-300">
                  MedSphere AI connects citizens, doctors, hospitals, emergency responders and public-health teams through a unified digital healthcare ecosystem.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/register"><Button size="lg" className="w-full px-7 shadow-lift sm:w-auto">Create your Health ID <IoArrowForwardOutline className="ml-2 h-5 w-5" /></Button></Link>
                  <Link to="/app/emergency"><Button size="lg" variant="secondary" className="w-full px-7 sm:w-auto"><IoWarningOutline className="mr-2 h-5 w-5 text-red-500" /> Emergency SOS</Button></Link>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><IoCheckmarkCircleOutline className="h-4 w-4 text-emerald-500" /> Citizen-first</span>
                  <span className="flex items-center gap-1.5"><IoCheckmarkCircleOutline className="h-4 w-4 text-emerald-500" /> Multi-role ecosystem</span>
                  <span className="flex items-center gap-1.5"><IoCheckmarkCircleOutline className="h-4 w-4 text-emerald-500" /> Human-led care</span>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-inner">
                    <div className="flex items-center justify-between">
                      <div><p className="text-xs font-semibold text-slate-400">MEDSPHERE HEALTH NETWORK</p><p className="mt-1 text-lg font-bold">Your care, connected.</p></div>
                      <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400"><IoShieldCheckmarkOutline className="h-5 w-5" /></div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {[
                        ['24/7', 'Emergency support', IoPulseOutline],
                        ['Live', 'Care coordination', IoPeopleOutline],
                        ['AI', 'Health assistance', IoSparklesOutline],
                        ['Secure', 'Health records', IoLockClosedOutline],
                      ].map(([value, label, Icon]) => (
                        <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <Icon className="h-5 w-5 text-brand-400" />
                          <p className="mt-3 text-lg font-bold">{value}</p>
                          <p className="text-[11px] text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500"><IoPulseOutline className="h-5 w-5" /></div><div><p className="text-sm font-bold">Emergency access</p><p className="text-xs text-slate-400">SOS • ambulance • hospital coordination</p></div><IoChevronForwardOutline className="ml-auto h-5 w-5 text-slate-500" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick access rail */}
            <div className="mt-10 grid gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-5 dark:border-white/10 dark:bg-white/5">
              {[
                ['Find a doctor', IoMedicalOutline, '/app/directory'],
                ['Find a hospital', IoBusinessOutline, '/app/directory'],
                ['Book appointment', IoCalendarOutline, '/app/appointments'],
                ['Telemedicine', IoVideocamOutline, '/app/consult'],
                ['Blood support', IoWaterOutline, '/app/blood'],
              ].map(([label, Icon, to]) => (
                <Link key={String(label)} to={String(to)} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold hover:bg-brand-50 dark:hover:bg-white/10">
                  <Icon className="h-5 w-5 text-brand-600" /><span>{label}</span><IoChevronForwardOutline className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="scroll-mt-20 bg-white py-16 sm:py-24 dark:bg-surface-dark">
          <div className="container px-4">
            <div className="max-w-2xl">
              <Badge tone="brand">Healthcare services</Badge>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">Everything important, in one connected place.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">From routine care to life-saving coordination, MedSphere AI brings the major parts of the healthcare journey together.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map(({ icon, title, description, to, tone }) => (
                <Link key={title} to={to} className="group">
                  <Card className="h-full p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                    <ServiceIcon icon={icon} tone={tone} />
                    <h3 className="mt-5 font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                    <div className="mt-5 flex items-center text-sm font-semibold text-brand-600">Explore <IoArrowForwardOutline className="ml-1.5 h-4 w-4 transition group-hover:translate-x-1" /></div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Emergency */}
        <section id="emergency" className="scroll-mt-20 border-y border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 py-16 sm:py-24 dark:border-red-900/20 dark:from-red-950/20 dark:via-surface-dark dark:to-orange-950/10">
          <div className="container px-4">
            <div className="grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <Badge tone="danger">Emergency response</Badge>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">When every second matters, remove the friction.</h2>
                <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">A dedicated emergency pathway connects SOS activation with dispatch, ambulance operations, responder coordination and hospital-side workflows.</p>
                <Link to="/app/emergency" className="mt-7 inline-block"><Button size="lg">Open Emergency SOS <IoArrowForwardOutline className="ml-2 h-5 w-5" /></Button></Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [IoPulseOutline, 'One-tap SOS', 'Start an emergency request without navigating through the normal care journey.'],
                  [IoCarOutline, 'Ambulance coordination', 'Support dispatch and driver workflows from a connected response network.'],
                  [IoLocationOutline, 'Location-aware response', 'Coordinate the response around the patient location and destination.'],
                  [IoBusinessOutline, 'Hospital handoff', 'Connect emergency response with hospital-side operational workflows.'],
                ].map(([Icon, title, text]) => (
                  <Card key={String(title)} className="border-red-100 bg-white/90 p-5 dark:border-red-900/20 dark:bg-white/5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"><Icon className="h-5 w-5" /></div>
                    <h3 className="mt-4 font-bold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section id="ecosystem" className="scroll-mt-20 bg-slate-50 py-16 sm:py-24 dark:bg-surface-dark-soft">
          <div className="container px-4">
            <div className="text-center">
              <Badge tone="brand">One ecosystem, many roles</Badge>
              <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">Built around the people who make healthcare work.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">Each role gets a purpose-built workspace while the underlying platform keeps the care journey connected.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {roleCards.map(({ icon: Icon, title, description, to }) => (
                <Link key={title} to={to}>
                  <Card className="h-full p-6 transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400"><Icon className="h-6 w-6" /></div>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                    <span className="mt-5 flex items-center text-sm font-semibold text-brand-600">Access workspace <IoArrowForwardOutline className="ml-1.5 h-4 w-4" /></span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* AI + records */}
        <section className="bg-white py-16 sm:py-24 dark:bg-surface-dark">
          <div className="container px-4">
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-7 text-white lg:col-span-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><IoSparklesOutline className="h-6 w-6" /></div>
                <h2 className="mt-6 max-w-2xl text-3xl font-extrabold sm:text-4xl">AI that supports healthcare — not replaces the clinician.</h2>
                <p className="mt-4 max-w-2xl leading-7 text-brand-50">MedSphere AI can help users navigate health information and services while keeping professional medical judgment at the center of care.</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {['Health guidance', 'RAG-based knowledge', 'Safety-first responses', 'Human oversight'].map((x) => <span key={x} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">{x}</span>)}
                </div>
              </Card>
              <Card className="p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"><IoDocumentTextOutline className="h-6 w-6" /></div>
                <h3 className="mt-6 text-2xl font-extrabold">Your health record, organized.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Keep important medical information accessible across the connected care journey.</p>
                <Link to="/app/records" className="mt-6 inline-flex items-center text-sm font-bold text-brand-600">Open medical records <IoArrowForwardOutline className="ml-1.5 h-4 w-4" /></Link>
              </Card>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-16 sm:py-24 dark:border-white/10 dark:bg-surface-dark-soft">
          <div className="container px-4">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <Badge tone="brand">Trust by design</Badge>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">Healthcare needs more than a beautiful interface.</h2>
                <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">The platform is designed around controlled access, auditable workflows, clear role boundaries and responsible AI.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {trustItems.map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold shadow-sm dark:border-white/10 dark:bg-white/5"><IoCheckmarkCircleOutline className="h-5 w-5 shrink-0 text-emerald-500" />{item}</div>)}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white py-16 sm:py-24 dark:bg-surface-dark">
          <div className="container px-4">
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-center text-white shadow-2xl sm:px-12 sm:py-16">
              <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
              <div className="relative">
                <IoGlobeOutline className="mx-auto h-8 w-8 text-brand-400" />
                <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold sm:text-5xl">Healthcare should feel connected.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-slate-300">Create your MedSphere Health ID and enter a healthcare ecosystem designed to grow with the needs of citizens and care providers.</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register"><Button size="lg" className="w-full sm:w-auto">Create Health ID</Button></Link><Link to="/login"><Button size="lg" variant="secondary" className="w-full sm:w-auto">Sign in</Button></Link></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-surface-dark-soft">
        <div className="container px-4 py-12">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><IoMedkitOutline className="h-5 w-5" /></div><span className="font-extrabold">MedSphere <span className="text-brand-600">AI</span></span></div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">A connected healthcare platform bringing citizens, clinicians, hospitals, emergency services and public-health operations closer together.</p>
            </div>
            <div><p className="font-bold">Care</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/app/directory" className="hover:text-brand-600">Find care</Link><Link to="/app/appointments" className="hover:text-brand-600">Appointments</Link><Link to="/app/consult" className="hover:text-brand-600">Telemedicine</Link><Link to="/app/records" className="hover:text-brand-600">Medical records</Link></div></div>
            <div><p className="font-bold">Networks</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/app/blood" className="hover:text-brand-600">Blood network</Link><Link to="/app/organ" className="hover:text-brand-600">Organ network</Link><Link to="/app/emergency" className="hover:text-brand-600">Emergency SOS</Link><Link to="/login" className="hover:text-brand-600">Provider portal</Link></div></div>
            <div><p className="font-bold">Platform</p><div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400"><Link to="/register" className="hover:text-brand-600">Create Health ID</Link><Link to="/login" className="hover:text-brand-600">Sign in</Link><a href="#trust" className="hover:text-brand-600">Trust & security</a><a href="#services" className="hover:text-brand-600">Services</a></div></div>
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
