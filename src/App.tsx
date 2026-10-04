import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FullPageLoader } from '@/components/ui/Spinner';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute, RoleGate } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import { DevRoleSwitcher } from '@/components/dev/DevRoleSwitcher';

const Landing = lazy(() => import('@/pages/public/Landing'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const CitizenDashboard = lazy(() => import('@/pages/roles/citizen/CitizenDashboard'));
const DoctorDashboard = lazy(() => import('@/pages/roles/doctor/DoctorDashboard'));
const HospitalDashboard = lazy(() => import('@/pages/roles/hospital/HospitalDashboard'));
const MyAppointments = lazy(() => import('@/pages/roles/citizen/MyAppointments'));
const BedBooking = lazy(() => import('@/pages/roles/citizen/BedBooking'));
const BedManagement = lazy(() => import('@/pages/roles/hospital/BedManagement'));
const InpatientOperations = lazy(() => import('@/pages/roles/hospital/InpatientOperations'));
const ClinicalQueue = lazy(() => import('@/pages/roles/hospital/ClinicalQueue'));
const DoctorPatients = lazy(() => import('@/pages/roles/doctor/DoctorPatients'));
const DoctorSchedule = lazy(() => import('@/pages/roles/doctor/DoctorSchedule'));
const ConsultationRoom = lazy(() => import('@/pages/telemedicine/ConsultationRoom'));
const TelemedicineLobby = lazy(() => import('@/pages/telemedicine/TelemedicineLobby'));
const OrganDashboard = lazy(() => import('@/pages/services/organ-donation/OrganDashboard'));
const OrganDonation = lazy(() => import('@/pages/roles/citizen/OrganDonation'));
const BloodBankDashboard = lazy(() => import('@/pages/services/blood-bank/BloodBankDashboard'));
const BloodDonation = lazy(() => import('@/pages/roles/citizen/BloodDonation'));
const EmergencySOS = lazy(() => import('@/pages/emergency/EmergencySOS'));
const EmergencyDashboard = lazy(() => import('@/pages/emergency/EmergencyDashboard'));
const GovDashboard = lazy(() => import('@/pages/government/GovDashboard'));
const AdminDashboard = lazy(() => import('@/pages/roles/admin/AdminDashboard'));
const LabDashboard = lazy(() => import('@/pages/services/laboratory/LabDashboard'));
const PharmacyDashboard = lazy(() => import('@/pages/services/pharmacy/PharmacyDashboard'));
const HospitalDirectory = lazy(() => import('@/pages/roles/citizen/HospitalDirectory'));
const MedicalRecords = lazy(() => import('@/pages/roles/citizen/MedicalRecords'));
const ProfileSettings = lazy(() => import('@/pages/common/ProfileSettings'));
const NotFound = lazy(() => import('@/pages/public/NotFound'));

/** Redirects /app to the home dashboard for the signed-in role. */
function RoleHome() {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) return <FullPageLoader />;
  const home: Record<string, string> = {
    citizen: '/app/citizen', doctor: '/app/doctor', hospital: '/app/hospital',
    blood_bank: '/app/blood', organ_authority: '/app/organ',
    emergency_operator: '/app/emergency-dispatch', government: '/app/gov', researcher: '/app/gov',
    laboratory: '/app/laboratory', pharmacy: '/app/pharmacy',
    admin: '/app/admin', super_admin: '/app/admin',
  };
  return <Navigate to={home[profile.role] ?? '/app/citizen'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DevRoleSwitcher />
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route path="/app" element={<RoleHome />} />
                <Route path="/app/citizen" element={<RoleGate allow={['citizen']}><CitizenDashboard /></RoleGate>} />
                <Route path="/app/doctor" element={<RoleGate allow={['doctor']}><DoctorDashboard /></RoleGate>} />
                <Route path="/app/doctor/patients" element={<RoleGate allow={['doctor']}><DoctorPatients /></RoleGate>} />
                <Route path="/app/doctor/schedule" element={<RoleGate allow={['doctor']}><DoctorSchedule /></RoleGate>} />
                <Route path="/app/hospital" element={<RoleGate allow={['hospital', 'admin', 'super_admin']}><HospitalDashboard /></RoleGate>} />
                <Route path="/app/hospital/beds" element={<RoleGate allow={['hospital', 'admin', 'super_admin']}><BedManagement /></RoleGate>} />
                <Route path="/app/hospital/inpatient" element={<RoleGate allow={['hospital', 'admin', 'super_admin']}><InpatientOperations /></RoleGate>} />
                <Route path="/app/hospital/queue" element={<RoleGate allow={['hospital', 'admin', 'super_admin']}><ClinicalQueue /></RoleGate>} />
                <Route path="/app/appointments" element={<RoleGate allow={['citizen']}><MyAppointments /></RoleGate>} />
                <Route path="/app/bed-booking" element={<RoleGate allow={['citizen']}><BedBooking /></RoleGate>} />
                <Route path="/app/consult" element={<RoleGate allow={["citizen", "doctor"]}><TelemedicineLobby /></RoleGate>} />
                <Route path="/app/consult/:appointmentId" element={<RoleGate allow={["citizen", "doctor"]}><ConsultationRoom /></RoleGate>} />
                <Route path="/app/directory" element={<RoleGate allow={['citizen']}><HospitalDirectory /></RoleGate>} />
                <Route path="/app/records" element={<RoleGate allow={['citizen']}><MedicalRecords /></RoleGate>} />
                <Route path="/app/organ" element={<RoleGate allow={['citizen', 'organ_authority', 'hospital', 'admin', 'super_admin']}><OrganDashboard /></RoleGate>} />
                <Route path="/app/organ-registry" element={<RoleGate allow={['citizen']}><OrganDonation /></RoleGate>} />
                <Route path="/app/blood" element={<BloodBankDashboard />} />
                <Route path="/app/blood-network" element={<RoleGate allow={['citizen']}><BloodDonation /></RoleGate>} />
                <Route path="/app/emergency" element={<RoleGate allow={['citizen', 'doctor']}><EmergencySOS /></RoleGate>} />
                <Route path="/app/emergency-dispatch" element={<RoleGate allow={['emergency_operator', 'admin', 'super_admin']}><EmergencyDashboard /></RoleGate>} />
                <Route path="/app/gov" element={<RoleGate allow={['government', 'researcher', 'admin', 'super_admin']}><GovDashboard /></RoleGate>} />
                <Route path="/app/admin" element={<RoleGate allow={['admin', 'super_admin']}><AdminDashboard /></RoleGate>} />
                <Route path="/app/laboratory" element={<RoleGate allow={['laboratory']}><LabDashboard /></RoleGate>} />
                <Route path="/app/pharmacy" element={<RoleGate allow={['pharmacy']}><PharmacyDashboard /></RoleGate>} />
                <Route path="/app/profile" element={<ProfileSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
