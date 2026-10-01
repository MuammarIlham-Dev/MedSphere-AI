import { FullPageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/KpiCard';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { Role } from '@/types';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { status } = useAuthStore();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'signedOut') return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children ?? <Outlet />}</>;
}

export function RoleGate({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { profile } = useAuthStore();
  if (!profile) return <FullPageLoader />;
  if (!allow.includes(profile.role)) {
    return (
      <EmptyState
        title="Access restricted"
        hint={`Your role (${profile.role}) does not have permission to view this module. Contact an administrator if you believe this is an error.`}
      />
    );
  }
  return <>{children}</>;
}
