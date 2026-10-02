import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ToastHost';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IoMedkitOutline, IoShieldCheckmarkOutline, IoPulseOutline, IoPeopleOutline,
  IoMenuOutline, IoCloseOutline, IoBusinessOutline, IoWaterOutline, IoBodyOutline,
  IoVideocamOutline, IoChevronForwardOutline,
} from 'react-icons/io5';

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-surface-soft to-surface-soft dark:from-surface-dark dark:to-surface-dark">
      {/* Top Header */}
      <header className="container relative z-30 flex items-center justify-between px-4 py-4 sm:py-5">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <IoMedkitOutline className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            MedSphere <span className="text-brand-600">AI</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/register"><Button>Get started</Button></Link>
        </nav>

        {/* Mobile Navigation Trigger */}
        <div className="flex sm:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-700 shadow-sm active:scale-95 transition dark:border-white/10 dark:bg-surface-dark-soft dark:text-slate-200"
          >
            {mobileMenuOpen ? <IoCloseOutline className="h-6 w-6" /> : <IoMenuOutline className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col sm:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative mt-auto flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-surface p-6 shadow-2xl pb-safe dark:border-white/10 dark:bg-surface-dark-soft">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <IoMedkitOutline className="h-4 w-4" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">MedSphere AI</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-dark-muted dark:text-slate-300"
                aria-label="Close"
              >
                <IoCloseOutline className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full">
                <Button size="lg" className="w-full justify-center shadow-lift text-base">
                  Get started · Create Health ID
                </Button>
              </Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                <Button size="lg" variant="secondary" className="w-full justify-center text-base">
                  Sign in to your account
                </Button>
              </Link>
            </div>

            {/* Quick Service Links */}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Direct Public Health Services
              </p>
              <div className="space-y-1">
                {[
                  { to: '/app/emergency', label: 'Emergency SOS & Ambulance', icon: <IoPulseOutline className="h-5 w-5 text-red-500" />, badge: 'Live 24/7' },
                  { to: '/app/directory', label: 'Find Hospitals & Doctors', icon: <IoBusinessOutline className="h-5 w-5 text-brand-600" /> },
                  { to: '/app/consult', label: 'Telemedicine Consultation', icon: <IoVideocamOutline className="h-5 w-5 text-indigo-500" /> },
                  { to: '/app/blood', label: 'Blood Donation Network', icon: <IoWaterOutline className="h-5 w-5 text-rose-500" /> },
                  { to: '/app/organ', label: 'Organ Matching Registry', icon: <IoBodyOutline className="h-5 w-5 text-amber-500" /> },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl p-3 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition dark:text-slate-200 dark:hover:bg-surface-dark-muted"
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                          {item.badge}
                        </span>
                      )}
                      <IoChevronForwardOutline className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Healthcare Provider portal */}
            <div className="mt-5 rounded-2xl bg-brand-50/70 p-4 text-center dark:bg-brand-950/40">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Healthcare staff, doctors, and hospitals:
              </p>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Access Provider Portal →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Hero Section */}
      <main className="container px-4 py-12 text-center sm:py-24">
        <Badge tone="brand" className="mx-auto mb-5 sm:mb-6 max-w-full truncate">
          National Public Health & Emergency Response Platform
        </Badge>
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-tight dark:text-white">
          Healthcare that finds you <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">before</span> the emergency does
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
          One digital health ID for appointments, telemedicine, organ matching, blood networks and one-tap emergency response — for every citizen.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-none mx-auto">
          <Link to="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base shadow-lift">
              Create your Health ID
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base">
              I work in healthcare
            </Button>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mx-auto mt-16 sm:mt-20 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: <IoPulseOutline className="h-6 w-6" />, t: 'Emergency-first', d: 'One-tap SOS with live ambulance tracking and hospital capacity routing.' },
            { icon: <IoPeopleOutline className="h-6 w-6" />, t: 'Organ & blood network', d: 'Coordinator-assisted compatibility scoring with full audit trails.' },
            { icon: <IoShieldCheckmarkOutline className="h-6 w-6" />, t: 'Medical-grade security', d: 'Row-level security, MFA, and end-to-end audit logging by default.' },
          ].map((f) => (
            <Card key={f.t} className="p-5 sm:p-6 text-left">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                {f.icon}
              </div>
              <h3 className="font-semibold text-base">{f.t}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.d}</p>
            </Card>
          ))}
        </div>

        <p className="mt-14 sm:mt-16 text-xs text-slate-400 px-4">
          MedSphere AI provides informational tools only and never replaces licensed medical professionals.
        </p>
      </main>
    </div>
  );
}
