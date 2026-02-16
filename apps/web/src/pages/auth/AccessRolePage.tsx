import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import styles from './AccessRolePage.module.css';

export function AccessRolePage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="access-title">
        <header className={styles.header}>
          <div className={styles.headerTopRow}>
            <Link className={styles.backButton} to="/">
              Back to Home
            </Link>
          </div>
          <div className={styles.brandRow}>
            <BrandLogo size="md" />
          </div>
          <h1 id="access-title" className={styles.title}>
            Choose Your Access Portal
          </h1>
          <p className={styles.subtitle}>
            Select your role first. You will then continue to a dedicated sign-in and registration
            experience.
          </p>
        </header>

        <div className={styles.cards}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Patient Portal</h2>
            <p className={styles.cardText}>
              Own your data, maintain profile details, manage doctor access requests, and share your
              QR identifier securely.
            </p>
            <ul className={styles.points}>
              <li>Profile and hereditary history management</li>
              <li>Access request approvals and denials</li>
              <li>QR preview, print, and download</li>
            </ul>
            <Link className={styles.button} to="/access/patient">
              Continue as Patient
            </Link>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Doctor Portal</h2>
            <p className={styles.cardText}>
              Hospital-attached clinical workspace with patient access-request controls and
              visit authoring.
            </p>
            <ul className={styles.points}>
              <li>Doctor profile and verification submission</li>
              <li>Patient search and access workflow</li>
              <li>Visits, prescription, reports, treatment status</li>
            </ul>
            <Link className={`${styles.button} ${styles.buttonAlt}`} to="/access/doctor">
              Continue as Doctor
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
