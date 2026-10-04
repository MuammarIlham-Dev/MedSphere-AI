import { ThemeToggle } from '@/components/ui/ToastHost';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/ui/ToastHost';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IoGridOutline, IoCalendarOutline, IoVideocamOutline, IoWaterOutline,
  IoBodyOutline, IoMedkitOutline, IoStatsChartOutline, IoPeopleOutline,
  IoNotificationsOutline, IoMenuOutline, IoLogOutOutline, IoShieldCheckmarkOutline,
  IoBusinessOutline, IoChatbubbleOutline, IoSearchOutline, IoBeakerOutline, IoMedicalOutline, IoDocumentTextOutline, IoBedOutline,
  IoCloseOutline,
} from 'react-icons/io5';
import { MobileBottomNav } from './MobileBottomNav';
import { cn, initials, timeAgo } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useNotifications } from '@/hooks/queries/useNotificationQueries';
import type { Role } from '@/types';

interface NavItem { to: string; label: string; icon: ReactNode }

const NAV: Partial<Record<Role, NavItem[]>> = {
  citizen: [
    { to: '/app/citizen', label: 'Dashboard', icon: <IoGridOutline /> },
    { to: '/app/directory', label: 'Hospital Directory', icon: <IoBusinessOutline /> },
    { to: '/app/appointments', label: 'Doctor Appointments', icon: <IoCalendarOutline /> },
    { to: '/app/bed-booking', label: 'Bed Booking', icon: <IoBedOutline /> },
    { to: '/app/consult', label: 'Telemedicine', icon: <IoVideocamOutline /> },
    { to: '/app/records', label: 'Medical Records', icon: <IoDocumentTextOutline /> },
    { to: '/app/blood', label: 'Blood', icon: <IoWaterOutline /> },
    { to: '/app/organ', label: 'Organ Donation', icon: <IoBodyOutline /> },
    { to: '/app/emergency', label: 'Emergency SOS', icon: <IoMedkitOutline /> },
  ],
  doctor: [
    { to: '/app/doctor', label: 'Dashboard', icon: <IoGridOutline /> },
    { to: '/app/doctor/patients', label: 'Patients', icon: <IoPeopleOutline /> },
    { to: '/app/doctor/schedule', label: 'Schedule', icon: <IoCalendarOutline /> },
    { to: '/app/consult', label: 'Consultations', icon: <IoVideocamOutline /> },
  ],
  hospital: [
    { to: '/app/hospital', label: 'Overview', icon: <IoBusinessOutline /> },
    { to: '/app/hospital/beds', label: 'Bed Management', icon: <IoBedOutline /> },
    { to: '/app/hospital/inpatient', label: 'Inpatient Operations', icon: <IoPeopleOutline /> },
    { to: '/app/organ', label: 'Organ Coordination', icon: <IoBodyOutline /> },
    { to: '/app/blood', label: 'Blood Bank', icon: <IoWaterOutline /> },
  ],
  blood_bank: [{ to: '/app/blood', label: 'Blood Bank', icon: <IoWaterOutline /> }],
  organ_authority: [{ to: '/app/organ', label: 'Matching Engine', icon: <IoBodyOutline /> }],
  emergency_operator: [{ to: '/app/emergency-dispatch', label: 'Emergencies', icon: <IoMedkitOutline /> }],
  laboratory: [{ to: '/app/laboratory', label: 'Laboratory', icon: <IoBeakerOutline /> }],
  pharmacy: [{ to: '/app/pharmacy', label: 'Pharmacy', icon: <IoMedicalOutline /> }],
  government: [{ to: '/app/gov', label: 'Public Health', icon: <IoStatsChartOutline /> }],
  researcher: [{ to: '/app/gov', label: 'Research Data', icon: <IoStatsChartOutline /> }],
  admin: [
    { to: '/app/admin', label: 'Admin', icon: <IoShieldCheckmarkOutline /> },
    { to: '/app/gov', label: 'Analytics', icon: <IoStatsChartOutline /> },
  ],
  super_admin: [
    { to: '/app/admin', label: 'Admin', icon: <IoShieldCheckmarkOutline /> },
    { to: '/app/gov', label: 'Analytics', icon: <IoStatsChartOutline /> },
    { to: '/app/organ', label: 'Organ Network', icon: <IoBodyOutline /> },
  ],
};

function NotificationBell() {
  const { data, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted">
        <IoNotificationsOutline className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-card dark:border-white/10 dark:bg-surface-dark-soft">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/5">Notifications</p>
          <ul className="max-h-80 overflow-y-auto">
            {(data ?? []).slice(0, 12).map((n) => (
              <li key={n.id} className={cn('px-4 py-3 text-sm', !n.read_at && 'bg-brand-50/50 dark:bg-brand-950/30')}>
                <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{timeAgo(n.created_at)}</p>
              </li>
            ))}
            {(data ?? []).length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { profile, signOut } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const navigate = useNavigate();
  const items = useMemo(() => (profile ? (NAV[profile.role] ?? NAV.citizen!) : []), [profile]);

  const renderNav = (onItemClick?: () => void) => (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end onClick={onItemClick}
          className={({ isActive }) => cn(
            'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors [&_svg]:h-5 [&_svg]:w-5',
            isActive
              ? 'bg-brand-600 text-white shadow-lift'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted',
          )}>
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-surface lg:flex dark:border-white/10 dark:bg-surface-dark-soft">
        <div className="flex items-center gap-2.5 px-5">
          <img src="/medshereai.logo.png" alt="MedSphere AI" className="h-24 w-auto object-contain" />
        </div>
        {renderNav()}
        <div className="border-t border-slate-100 p-3 dark:border-white/5">
          <button onClick={() => void signOut().then(() => navigate('/login'))}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted">
            <IoLogOutOutline className="h-5 w-5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface shadow-2xl dark:bg-surface-dark-soft"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-2 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <img src="/medshereai.logo.png" alt="MedSphere AI" className="h-20 w-auto object-contain" />
                </div>
                <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-dark-muted">
                  <IoCloseOutline className="h-5 w-5" />
                </button>
              </div>
              {renderNav(() => setSidebarOpen(false))}
              <div className="border-t border-slate-100 p-4 dark:border-white/5 space-y-2">
                <Link to="/app/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 rounded-xl p-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                    {profile ? initials(profile.full_name) : '…'}
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{profile?.role.replace('_', ' ')}</p>
                  </div>
                </Link>
                <button onClick={() => void signOut().then(() => navigate('/login'))}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                  <IoLogOutOutline className="h-5 w-5" /> Sign out
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-surface/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-surface-dark-soft/80">
          <button className="rounded-xl p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-surface-dark-muted"
            onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <IoMenuOutline className="h-5 w-5" />
          </button>
          <button onClick={() => navigate('/app/appointments')} aria-label="Global search"
            className="hidden items-center gap-2 rounded-xl bg-surface-muted px-3.5 py-2 text-sm text-slate-400 sm:flex sm:w-72 dark:bg-surface-dark-muted">
            <IoSearchOutline /> Search doctors, hospitals, medicines…
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <Link to="/app/profile" className="flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-surface-dark-muted p-1.5 -m-1.5 rounded-xl transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              {profile ? initials(profile.full_name) : '…'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name}</p>
              <p className="text-xs capitalize leading-tight text-slate-400">{profile?.role.replace('_', ' ')}</p>
            </div>
          </Link>
        </header>
        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <ToastHost />
    </div>
  );
}