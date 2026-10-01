import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FullPageLoader } from '@/components/ui/Spinner';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute, RoleGate } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import { ToastHost } from '@/components/ui/ToastHost';
import { DevRoleSwitcher } from '@/components/dev/DevRoleSwitcher';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const CitizenDashboard = lazy(() => import('@/pages/citizen/CitizenDashboard'));
const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'));
const HospitalDashboard = lazy(() => import('@/pages/hospital/HospitalDashboard'));
const DoctorSearch = lazy(() => import('@/pages/appointments/DoctorSearch'));
const ConsultationRoom = lazy(() => import('@/pages/telemedicine/ConsultationRoom'));
const OrganDashboard = lazy(() => import('@/pages/organ/OrganDashboard'));
const BloodBankDashboard = lazy(() => import('@/pages/blood/BloodBankDashboard'));
const EmergencySOS = lazy(() => import('@/pages/emergency/EmergencySOS'));
const GovDashboard = lazy(() => import('@/pages/government/GovDashboard'));
const ResearchDashboard = lazy(() => import('@/pages/research/ResearchDashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const LabDashboard = lazy(() => import('@/pages/laboratory/LabDashboard'));
const PharmacyDashboard = lazy(() => import('@/pages/pharmacy/PharmacyDashboard')); 
const NotFound = lazy(() => import('@/pages/NotFound'));
const HospitalDirectory = lazy(() => import('@/pages/citizen/HospitalDirectory').then(m => ({ default: m.HospitalDirectory })));

/** Redirects /app to the home dashboard for the signed-in role. */
function RoleHome() {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) return <FullPageLoader />;
  const home: Record<string, string> = {
    citizen: '/app/citizen', doctor: '/app/doctor', hospital: '/app/hospital',
    laboratory: '/app/laboratory', pharmacy: '/app/pharmacy',
    blood_bank: '/app/blood', organ_authority: '/app/organ',
    emergency_operator: '/app/emergency', government: '/app/gov', researcher: '/app/research',
    admin: '/app/admin', super_admin: '/app/admin',
  };
  return <Navigate to={home[profile.role] ?? '/app/citizen'} replace />;
}

const PremiumOnboarding = lazy(() => import('@/pages/premium/Onboarding'));
const PremiumDiscovery = lazy(() => import('@/pages/premium/DiscoveryDashboard'));
const PremiumConsultation = lazy(() => import('@/pages/premium/ConsultationDetail'));

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => { void init(); }, [init]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Premium Routes */}
              <Route path="/premium/onboarding" element={<PremiumOnboarding />} />
              <Route path="/premium/discover" element={<PremiumDiscovery />} />
              <Route path="/premium/consultation/:id" element={<PremiumConsultation />} />

              <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route path="/app" element={<RoleHome />} />
                <Route path="/app/citizen" element={<RoleGate allow={['citizen']}><CitizenDashboard /></RoleGate>} />
                <Route path="/app/directory" element={<RoleGate allow={['citizen']}><HospitalDirectory /></RoleGate>} />
                <Route path="/app/doctor" element={<RoleGate allow={['doctor']}><DoctorDashboard /></RoleGate>} />
                <Route path="/app/hospital" element={<RoleGate allow={['hospital', 'admin', 'super_admin']}><HospitalDashboard /></RoleGate>} />
                <Route path="/app/laboratory" element={<RoleGate allow={['laboratory', 'admin', 'super_admin']}><LabDashboard /></RoleGate>} />
                <Route path="/app/pharmacy" element={<RoleGate allow={['pharmacy', 'admin', 'super_admin']}><PharmacyDashboard /></RoleGate>} />
                <Route path="/app/appointments" element={<DoctorSearch />} />
                <Route path="/app/consult" element={<ConsultationRoom />} />
                <Route path="/app/consult/:appointmentId" element={<ConsultationRoom />} />
                <Route path="/app/organ" element={<RoleGate allow={['citizen', 'organ_authority', 'hospital', 'admin', 'super_admin']}><OrganDashboard /></RoleGate>} />
                <Route path="/app/blood" element={<BloodBankDashboard />} />
                <Route path="/app/emergency" element={<EmergencySOS />} />
                <Route path="/app/gov" element={<RoleGate allow={['government', 'researcher', 'admin', 'super_admin']}><GovDashboard /></RoleGate>} />
                <Route path="/app/research" element={<RoleGate allow={['researcher', 'government', 'admin', 'super_admin']}><ResearchDashboard /></RoleGate>} />
                <Route path="/app/admin" element={<RoleGate allow={['admin', 'super_admin']}><AdminDashboard /></RoleGate>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ToastHost />
        {import.meta.env.DEV && <DevRoleSwitcher />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
