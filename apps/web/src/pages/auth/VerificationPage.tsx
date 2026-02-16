import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { getFirebaseAuthErrorMessage } from '../../auth/firebaseAuthError';
import { useAuth } from '../../auth/AuthProvider';
import { BrandLogo } from '../../components/BrandLogo';
import { firebaseAuth } from '../../config/firebase';
import { toastError, toastInfo, toastSuccess } from '../../components/toast';
import type { Role } from '../../types';
import styles from './VerificationPage.module.css';

function roleHomePath(role: Role): string {
  if (role === 'doctor') {
    return '/doctor/dashboard';
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  return '/patient/dashboard';
}

export function VerificationPage() {
  const navigate = useNavigate();
  const { firebaseUser, appUser, refreshSession, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  if (!firebaseUser) {
    return <Navigate to="/access" replace />;
  }

  if (appUser) {
    return <Navigate to={roleHomePath(appUser.role)} replace />;
  }

  const emailVerified = firebaseUser.emailVerified;

  async function resendEmail(): Promise<void> {
    const current = firebaseAuth.currentUser;
    if (!current) {
      const message = 'No active session found.';
      setError(message);
      toastError(message);
      return;
    }

    setBusy(true);
    setError('');
    setHint('');
    try {
      await sendEmailVerification(current);
      const message = 'Verification email sent. Open your inbox and click the link.';
      setHint(message);
      toastSuccess(message);
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshVerification(): Promise<void> {
    setBusy(true);
    setError('');
    setHint('');
    try {
      const user = await refreshSession({ reloadFirebaseUser: true });
      if (user) {
        toastSuccess('Email verified. Redirecting to dashboard.');
        navigate(roleHomePath(user.role), { replace: true });
        return;
      }
      const message = 'Verification status refreshed.';
      setHint(message);
      toastInfo(message);
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brandRow}>
          <BrandLogo size="md" />
        </div>
        <h1 className={styles.title}>Verify Your Email</h1>
        <p className={styles.subtitle}>
          Email verification is required before accessing MedLedger dashboards.
        </p>

        <article className={styles.block}>
          <h2>Email Verification</h2>
          <p>Status: {emailVerified ? 'Verified' : 'Pending'}</p>
          {!emailVerified ? (
            <button
              className={styles.button}
              type="button"
              disabled={busy}
              onClick={() => {
                void resendEmail();
              }}
            >
              Resend Verification Email
            </button>
          ) : null}
        </article>

        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => {
              void refreshVerification();
            }}
          >
            I Completed Email Verification
          </button>
          <button
            className={styles.buttonAlt}
            type="button"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
          >
            Logout
          </button>
        </div>

        {hint ? <p className={styles.hint}>{hint}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
