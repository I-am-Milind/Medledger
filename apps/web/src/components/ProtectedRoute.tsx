import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { loading, firebaseUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="fullCenter">Loading session...</div>;
  }

  if (!firebaseUser) {
    return <Navigate to="/access" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
