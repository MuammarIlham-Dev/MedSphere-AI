import { useState } from 'react';
import type { Role } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'citizen',            label: '🧑 Citizen' },
  { value: 'doctor',             label: '👨‍⚕️ Doctor' },
  { value: 'hospital',           label: '🏥 Hospital' },
  { value: 'laboratory',         label: '🧪 Laboratory' },
  { value: 'pharmacy',           label: '💊 Pharmacy' },
  { value: 'blood_bank',         label: '🩸 Blood Bank' },
  { value: 'organ_authority',    label: '🫀 Organ Authority' },
  { value: 'emergency_operator', label: '🚨 Emergency Operator' },
  { value: 'government',         label: '🏛️ Government' },
  { value: 'researcher',         label: '🔬 Researcher' },
  { value: 'admin',              label: '🛡️ Admin' },
  { value: 'super_admin',        label: '⚡ Super Admin' },
];

function getStoredRole(): Role {
  return (localStorage.getItem('dev_role') as Role | null) ?? 'citizen';
}

/** Floating DEV BYPASS panel — shown only in development builds */
export function DevRoleSwitcher() {
  const [role, setRole] = useState<Role>(getStoredRole);
  const [open, setOpen] = useState(false);
  const { init } = useAuthStore();
  const bypassed = localStorage.getItem('dev_bypass') === '1';

  const activate = async (r: Role) => {
    localStorage.setItem('dev_bypass', '1');
    localStorage.setItem('dev_role', r);
    await init();         // re-inits with mock profile
    window.location.href = '/app';
  };

  const deactivate = () => {
    localStorage.removeItem('dev_bypass');
    localStorage.removeItem('dev_role');
    window.location.href = '/login';
  };

  const switchRole = async (r: Role) => {
    setRole(r);
    localStorage.setItem('dev_role', r);
    await init();         // hot-swap mock profile
    window.location.href = '/app';
  };

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); }}
        className="fixed bottom-4 right-4 lg:right-auto lg:left-4 z-[9999] flex items-center gap-1.5 sm:gap-2 rounded-full border border-amber-400 bg-amber-50/95 px-2.5 py-1.5 sm:px-3 text-[11px] sm:text-xs font-bold text-amber-700 shadow-lg backdrop-blur transition active:scale-95 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/90 dark:text-amber-300"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <span className="hidden sm:inline">DEV</span> {bypassed ? `· ${role}` : '· bypass'}
      </button>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-4 right-4 lg:right-auto lg:left-4 z-[9999] w-[calc(100vw-2rem)] max-w-xs rounded-2xl border border-amber-400/60 bg-white p-4 shadow-2xl backdrop-blur-md dark:border-amber-600/40 dark:bg-slate-900">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Dev Bypass</span>
        </div>
        <button onClick={() => { setOpen(false); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      {/* Role picker */}
      <label className="mb-1 block text-xs font-medium text-slate-500">Login as role</label>
      <select
        value={role}
        onChange={(e) => { setRole(e.target.value as Role); }}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {/* Actions */}
      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={() => void activate(role)}
          className="w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
        >
          ⚡ Bypass Login & Enter
        </button>
        {bypassed && (
          <>
            <button
              onClick={() => void switchRole(role)}
              className="w-full rounded-xl bg-brand-600 py-2 text-xs font-bold text-white hover:bg-brand-700 transition-colors"
            >
              🔄 Switch to {role}
            </button>
            <button
              onClick={deactivate}
              className="w-full rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 transition-colors"
            >
              ✕ Disable bypass
            </button>
          </>
        )}
      </div>

      <p className="mt-3 text-[10px] text-slate-400 text-center">
        Only visible in <code className="font-mono">npm run dev</code>
      </p>
    </div>
  );
}
