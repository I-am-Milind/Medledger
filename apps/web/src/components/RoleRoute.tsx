import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '../types';
import { useAuth } from '../auth/AuthProvider';

type RoleRouteProps = PropsWithChildren<{
  allow: Role[];
}>;

function roleDefaultPath(role: Role): string {
  if (role === 'doctor') {
    return '/doctor/dashboard';
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  return '/patient/dashboard';
}

export function RoleRoute({ allow, children }: RoleRouteProps) {
  const { appUser, firebaseUser, loading } = useAuth();

  if (loading) {
    return <div className="fullCenter">Loading role...</div>;
  }

  if (!appUser) {
    return <Navigate to={firebaseUser ? '/verify' : '/access'} replace />;
  }

  if (!allow.includes(appUser.role)) {
    return <Navigate to={roleDefaultPath(appUser.role)} replace />;
  }

  return <>{children}</>;
}
