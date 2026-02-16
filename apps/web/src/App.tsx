import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { AccessRolePage } from './pages/auth/AccessRolePage';
import { DoctorAuthPage } from './pages/auth/DoctorAuthPage';
import { PatientAuthPage } from './pages/auth/PatientAuthPage';
import { VerificationPage } from './pages/auth/VerificationPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { PatientCoveragePage } from './pages/patient/PatientCoveragePage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';
import { PatientSupportPage } from './pages/patient/PatientSupportPage';
import { PatientTrackRecordsPage } from './pages/patient/PatientTrackRecordsPage';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorSearchPage } from './pages/doctor/DoctorSearchPage';
import { DoctorAccessPage } from './pages/doctor/DoctorAccessPage';
import { DoctorVisitComposerPage } from './pages/doctor/DoctorVisitComposerPage';
import { DoctorAddPatientPage } from './pages/doctor/DoctorAddPatientPage';
import { DoctorVisitedPatientsPage } from './pages/doctor/DoctorVisitedPatientsPage';
import { DoctorLookupPage } from './pages/doctor/DoctorLookupPage';
import { DoctorProfilePage } from './pages/doctor/DoctorProfilePage';
import { DoctorSupportPage } from './pages/doctor/DoctorSupportPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminPanelPage } from './pages/admin/AdminPanelPage';
import { getStaticAdminSession } from './pages/admin/staticAdminAuth';
import { LandingPage } from './pages/public/LandingPage';
import { ToastViewport } from './components/toast';

function RoleRedirect() {
  const { appUser, loading } = useAuth();

  if (loading) {
    return <div className="fullCenter">Loading role...</div>;
  }

  if (!appUser) {
    return <Navigate to="/access" replace />;
  }

  if (appUser.role === 'doctor') {
    return <Navigate to="/doctor/dashboard" replace />;
  }
  if (appUser.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/patient/dashboard" replace />;
}

function PublicAccessGate() {
  const { appUser, firebaseUser, loading } = useAuth();
  const staticAdminSession = getStaticAdminSession();

  if (loading) {
    return <div className="fullCenter">Loading authentication...</div>;
  }

  if (staticAdminSession) {
    return <Navigate to="/admin/panel" replace />;
  }

  if (appUser) {
    return <RoleRedirect />;
  }

  if (firebaseUser) {
    return <Navigate to="/verify" replace />;
  }

  return <AccessRolePage />;
}

function SecuredLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/access" element={<PublicAccessGate />} />
          <Route path="/access/patient" element={<PatientAuthPage />} />
          <Route path="/access/doctor" element={<DoctorAuthPage />} />
          <Route path="/verify" element={<VerificationPage />} />
          <Route path="/login" element={<Navigate to="/access/patient" replace />} />
          <Route path="/register" element={<Navigate to="/access/patient" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/panel" element={<AdminPanelPage />} />

          <Route element={<SecuredLayout />}>
            <Route
              path="/patient/dashboard"
              element={
                <RoleRoute allow={['patient']}>
                  <PatientDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/profile"
              element={
                <RoleRoute allow={['patient']}>
                  <PatientProfilePage />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/coverage"
              element={
                <RoleRoute allow={['patient']}>
                  <PatientCoveragePage />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/track-records"
              element={
                <RoleRoute allow={['patient']}>
                  <PatientTrackRecordsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/support"
              element={
                <RoleRoute allow={['patient']}>
                  <PatientSupportPage />
                </RoleRoute>
              }
            />

            <Route
              path="/doctor/dashboard"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/profile"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorProfilePage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/search"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorSearchPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/visit-composer"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorVisitComposerPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/add-patient"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorAddPatientPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/access-requests"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorAccessPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/visited-patients"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorVisitedPatientsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/support"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorSupportPage />
                </RoleRoute>
              }
            />
            <Route
              path="/doctor/lookup/:identifier"
              element={
                <RoleRoute allow={['doctor']}>
                  <DoctorLookupPage />
                </RoleRoute>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <RoleRoute allow={['admin']}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastViewport />
      </>
    </AuthProvider>
  );
}
