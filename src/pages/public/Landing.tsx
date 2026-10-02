import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ToastHost';
import { Link } from 'react-router-dom';
import { IoMedkitOutline, IoShieldCheckmarkOutline, IoPulseOutline, IoPeopleOutline } from 'react-icons/io5';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-surface-soft to-surface-soft dark:from-surface-dark dark:to-surface-dark">
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <IoMedkitOutline className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">MedSphere <span className="text-brand-600">AI</span></span>
        </div>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/register"><Button>Get started</Button></Link>
        </nav>
      </header>

      <main className="container py-16 text-center sm:py-24">
        <Badge tone="brand" className="mx-auto mb-6">National Public Health & Emergency Response Platform</Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
          Healthcare that finds you <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">before</span> the emergency does
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-500 dark:text-slate-400">
          One digital health ID for appointments, telemedicine, organ matching, blood networks and one-tap emergency response — for every citizen.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/register"><Button size="lg">Create your Health ID</Button></Link>
          <Link to="/login"><Button size="lg" variant="secondary">I work in healthcare</Button></Link>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: <IoPulseOutline className="h-6 w-6" />, t: 'Emergency-first', d: 'One-tap SOS with live ambulance tracking and hospital capacity routing.' },
            { icon: <IoPeopleOutline className="h-6 w-6" />, t: 'Organ & blood network', d: 'Coordinator-assisted compatibility scoring with full audit trails.' },
            { icon: <IoShieldCheckmarkOutline className="h-6 w-6" />, t: 'Medical-grade security', d: 'Row-level security, MFA, and end-to-end audit logging by default.' },
          ].map((f) => (
            <Card key={f.t} className="p-6 text-left">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">{f.icon}</div>
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.d}</p>
            </Card>
          ))}
        </div>
        <p className="mt-16 text-xs text-slate-400">
          MedSphere AI provides informational tools only and never replaces licensed medical professionals.
        </p>
      </main>
    </div>
  );
}
