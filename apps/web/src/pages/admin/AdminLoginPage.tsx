import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, LogIn, Mail } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { adminPortalApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import type { Role } from '../../types';
import { toastError, toastSuccess } from '../../components/toast';
import {
  createStaticAdminSession,
  getStaticAdminSession,
} from './staticAdminAuth';
import styles from './AdminLoginPage.module.css';

function roleHomePath(role: Role): string {
  if (role === 'doctor') {
    return '/doctor/dashboard';
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  return '/patient/dashboard';
}

export function AdminLoginPage() {
  const { loading, firebaseUser, appUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingSession = useMemo(() => getStaticAdminSession(), []);

  if (loading) {
    return <div className="fullCenter">Loading authentication...</div>;
  }

  if (existingSession) {
    return <Navigate to="/admin/panel" replace />;
  }

  if (appUser) {
    return <Navigate to={roleHomePath(appUser.role)} replace />;
  }

  if (firebaseUser) {
    return <Navigate to="/verify" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await adminPortalApi.login({ email, password });
      createStaticAdminSession({
        email: response.session.email,
        token: response.session.token,
        expiresAt: response.session.expires_at,
      });
      toastSuccess('Admin login successful.');
      navigate('/admin/panel', { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to sign in.';
      setError(message);
      toastError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.loginCard}>
        <header className={styles.header}>
          <BrandLogo size="lg" />
          <h1>Admin Login</h1>
          <p>Restricted MedLedger control panel access</p>
        </header>

        {error ? (
          <div className={styles.error} role="alert" aria-live="assertive">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            <span>Email</span>
            <div className={styles.inputWrap}>
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label className={styles.label}>
            <span>Password</span>
            <div className={styles.inputWrap}>
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
            <LogIn size={16} />
            <span>{isSubmitting ? 'Signing in...' : 'Login to Admin Panel'}</span>
          </button>
        </form>

        <Link to="/" className={styles.backLink}>
          Back to Landing Page
        </Link>
      </section>
    </main>
  );
}
