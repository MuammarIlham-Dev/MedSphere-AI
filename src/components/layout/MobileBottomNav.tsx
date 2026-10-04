import { useState, useMemo } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  IoGridOutline, IoCalendarOutline, IoBusinessOutline, IoDocumentTextOutline,
  IoMedkitOutline, IoEllipsisHorizontalOutline, IoCloseOutline, IoVideocamOutline,
  IoWaterOutline, IoBodyOutline, IoPersonOutline, IoLogOutOutline,
  IoShieldCheckmarkOutline, IoStatsChartOutline, IoBeakerOutline, IoMedicalOutline, IoPeopleOutline,
  IoCarOutline,
} from 'react-icons/io5';
import { useAuthStore } from '@/stores/authStore';
import { cn, initials } from '@/lib/utils';
import type { Role } from '@/types';

interface BottomTab {
  to: string;
  label: string;
  icon: React.ReactNode;
  isEmergency?: boolean;
}

export function MobileBottomNav() {
  const { profile, signOut } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const role = profile?.role ?? 'citizen';

  // Primary bottom tabs tailored to the role
  const primaryTabs: BottomTab[] = useMemo(() => {
    switch (role) {
      case 'citizen':
        return [
          { to: '/app/citizen', label: 'Home', icon: <IoGridOutline className="h-5 w-5" /> },
          { to: '/app/directory', label: 'Directory', icon: <IoBusinessOutline className="h-5 w-5" /> },
          { to: '/app/emergency', label: 'SOS', icon: <IoMedkitOutline className="h-6 w-6" />, isEmergency: true },
          { to: '/app/appointments', label: 'Appts', icon: <IoCalendarOutline className="h-5 w-5" /> },
        ];
      case 'doctor':
        return [
          { to: '/app/doctor', label: 'Dashboard', icon: <IoGridOutline className="h-5 w-5" /> },
          { to: '/app/doctor/patients', label: 'Patients', icon: <IoPeopleOutline className="h-5 w-5" /> },
          { to: '/app/consult', label: 'Consults', icon: <IoVideocamOutline className="h-5 w-5" /> },
          { to: '/app/emergency', label: 'SOS', icon: <IoMedkitOutline className="h-6 w-6" />, isEmergency: true },
          { to: '/app/profile', label: 'Profile', icon: <IoPersonOutline className="h-5 w-5" /> },
        ];
      case 'hospital':
        return [
          { to: '/app/hospital', label: 'Overview', icon: <IoBusinessOutline className="h-5 w-5" /> },
          { to: '/app/hospital/blood', label: 'Blood Req', icon: <IoWaterOutline className="h-5 w-5" /> },
          { to: '/app/organ', label: 'Organ', icon: <IoBodyOutline className="h-5 w-5" /> },
          { to: '/app/profile', label: 'Profile', icon: <IoPersonOutline className="h-5 w-5" /> },
        ];
      case 'emergency_operator':
        return [
          { to: '/app/emergency-dispatch', label: 'Dispatch', icon: <IoMedkitOutline className="h-5 w-5" /> },
          { to: '/app/profile', label: 'Profile', icon: <IoPersonOutline className="h-5 w-5" /> },
        ];
      case 'ambulance_driver':
        return [
          { to: '/app/ambulance', label: 'Response', icon: <IoCarOutline className="h-5 w-5" /> },
          { to: '/app/profile', label: 'Profile', icon: <IoPersonOutline className="h-5 w-5" /> },
        ];
      default:
        return [
          { to: '/app', label: 'Home', icon: <IoGridOutline className="h-5 w-5" /> },
          { to: '/app/profile', label: 'Profile', icon: <IoPersonOutline className="h-5 w-5" /> },
        ];
    }
  }, [role]);

  // Secondary items in the "More" bottom sheet
  const moreServices = useMemo(() => {
    if (role === 'citizen') {
      return [
        { to: '/app/records', label: 'Medical Records & EHR', desc: 'Prescriptions, lab reports & vaccines', icon: <IoDocumentTextOutline className="h-5 w-5 text-brand-600" /> },
        { to: '/app/consult', label: 'Telemedicine Consultation', desc: 'Secure HD video consultation', icon: <IoVideocamOutline className="h-5 w-5 text-indigo-500" /> },
        { to: '/app/blood', label: 'Blood Bank Network', desc: 'Find donors & reserve blood units', icon: <IoWaterOutline className="h-5 w-5 text-rose-500" /> },
        { to: '/app/organ', label: 'Organ Donation Registry', desc: 'Donor pledges & matching status', icon: <IoBodyOutline className="h-5 w-5 text-amber-500" /> },
      ];
    }
    if (role === 'doctor') {
      return [
        { to: '/app/doctor/schedule', label: 'Clinical Schedule', desc: 'Clinic and video availability', icon: <IoCalendarOutline className="h-5 w-5 text-brand-600" /> },
        { to: '/app/appointments', label: 'Appointment Schedules', desc: 'Patient booking roster', icon: <IoCalendarOutline className="h-5 w-5 text-brand-600" /> },
        { to: '/app/directory', label: 'Hospital Directory', desc: 'Regional hospital network', icon: <IoBusinessOutline className="h-5 w-5 text-blue-500" /> },
      ];
    }
    if (role === 'hospital' || role === 'admin' || role === 'super_admin') {
      return [
        ...(role === 'hospital' ? [
          { to: '/app/hospital/queue', label: 'Clinical Queue', desc: 'Today’s hospital appointments', icon: <IoCalendarOutline className="h-5 w-5 text-brand-600" /> },
          { to: '/app/hospital/inpatient', label: 'Inpatient Operations', desc: 'Admissions, transfers & discharge', icon: <IoPeopleOutline className="h-5 w-5 text-indigo-500" /> },
          { to: '/app/hospital/laboratory', label: 'Laboratory Coordination', desc: 'Diagnostic workflow & report status', icon: <IoBeakerOutline className="h-5 w-5 text-indigo-500" /> },
          { to: '/app/hospital/blood', label: 'Blood Requisition', desc: 'Request blood from verified banks', icon: <IoWaterOutline className="h-5 w-5 text-rose-500" /> },
        ] : []),
        { to: '/app/admin', label: 'Administrative Console', desc: 'User audits & compliance logs', icon: <IoShieldCheckmarkOutline className="h-5 w-5 text-brand-600" /> },
        { to: '/app/gov', label: 'Epidemiology Analytics', desc: 'Disease outbreak monitoring', icon: <IoStatsChartOutline className="h-5 w-5 text-emerald-500" /> },
        { to: '/app/laboratory', label: 'Laboratory Service', desc: 'Diagnostic work orders', icon: <IoBeakerOutline className="h-5 w-5 text-indigo-500" /> },
        { to: '/app/pharmacy', label: 'Pharmacy Dispensary', desc: 'Rx fulfillment pipeline', icon: <IoMedicalOutline className="h-5 w-5 text-teal-500" /> },
      ];
    }
    return [];
  }, [role]);

  return (
    <>
      {/* Bottom Bar Fixed Container */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)] lg:hidden dark:border-white/10 dark:bg-surface-dark-soft/95"
      >
        <div className="flex h-16 items-center justify-around px-2">
          {primaryTabs.map((tab) => {
            if (tab.isEmergency) {
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="relative -top-2 flex flex-col items-center group touch-manipulation"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/35 transition-transform active:scale-95 group-hover:scale-105">
                    {tab.icon}
                  </div>
                  <span className="mt-0.5 text-[10px] font-extrabold tracking-wider text-red-600 dark:text-red-400">
                    {tab.label}
                  </span>
                </NavLink>
              );
            }

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-all touch-manipulation',
                    isActive
                      ? 'text-brand-600 dark:text-brand-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      {tab.icon}
                      {isActive && (
                        <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-600 dark:bg-brand-400" />
                      )}
                    </div>
                    <span className="leading-none">{tab.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* "More" Sheet Trigger */}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More services"
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-all touch-manipulation',
              moreOpen
                ? 'text-brand-600 dark:text-brand-400 font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <div className="relative">
              <IoEllipsisHorizontalOutline className="h-5 w-5" />
            </div>
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* "More" Bottom Sheet Overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Modal */}
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-surface p-5 pb-safe shadow-2xl dark:border-white/10 dark:bg-surface-dark-soft animate-fade-up">
            {/* Sheet grab handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            {/* Profile summary header */}
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                  {profile ? initials(profile.full_name) : '…'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                    {profile?.full_name ?? 'User'}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {profile?.role.replace('_', ' ')} · ID: {profile?.digital_health_id ?? 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-dark-muted dark:text-slate-300"
                aria-label="Close sheet"
              >
                <IoCloseOutline className="h-5 w-5" />
              </button>
            </div>

            {/* Secondary Services List */}
            {moreServices.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Services & Modules
                </p>
                <div className="space-y-1">
                  {moreServices.map((svc) => (
                    <Link
                      key={svc.to}
                      to={svc.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 rounded-2xl p-3 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition dark:text-slate-200 dark:hover:bg-surface-dark-muted"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-surface-dark-muted">
                        {svc.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight text-slate-900 dark:text-white">
                          {svc.label}
                        </p>
                        <p className="truncate text-xs text-slate-400 mt-0.5">{svc.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Settings & Sign Out Actions */}
            <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
              <Link
                to="/app/profile"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition dark:text-slate-200 dark:hover:bg-surface-dark-muted"
              >
                <IoPersonOutline className="h-5 w-5 text-slate-500" />
                <span>Account & Profile Settings</span>
              </Link>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  void signOut().then(() => navigate('/login'));
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <IoLogOutOutline className="h-5 w-5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
