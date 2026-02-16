import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  DatabaseZap,
  FileHeart,
  Fingerprint,
  Globe2,
  Hospital,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  UserCircle2,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { BrandLogo } from '../../components/BrandLogo';
import type { Role } from '../../types';
import { getStaticAdminSession } from '../admin/staticAdminAuth';
import styles from './LandingPage.module.css';

type LoaderStage = 'visible' | 'closing' | 'hidden';

type IconCard = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=80';
const CONTINUITY_IMAGE =
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=1600&q=80';
const PREVIEW_IMAGE =
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1800&q=80';

const NETWORK_MODULES: IconCard[] = [
  {
    icon: Fingerprint,
    title: 'Patient Identity Layer',
    text: 'One global identifier for every lifetime medical record.',
  },
  {
    icon: Stethoscope,
    title: 'Doctor Access Requests',
    text: 'Permissioned clinical access approved by the patient.',
  },
  {
    icon: FileHeart,
    title: 'Visit + Prescription Flow',
    text: 'Structured entries for diagnosis, treatment, and reports.',
  },
  {
    icon: ScanLine,
    title: 'QR-Based Lookup',
    text: 'Fast lookup with strict backend identity and role checks.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit + Trust Controls',
    text: 'Every action is logged for traceability and compliance.',
  },
  {
    icon: Globe2,
    title: 'National Data Continuity',
    text: 'Records follow the patient across verified hospitals.',
  },
];

const WORKFLOW_STEPS: IconCard[] = [
  {
    icon: UserCircle2,
    title: 'Patient creates identity',
    text: 'One verified profile initializes the lifetime record.',
  },
  {
    icon: Hospital,
    title: 'Doctor requests access',
    text: 'Hospital-linked requests are validated before access.',
  },
  {
    icon: DatabaseZap,
    title: 'Records grow forever',
    text: 'Every approved visit extends one longitudinal timeline.',
  },
];

const SECURITY_POINTS: IconCard[] = [
  {
    icon: LockKeyhole,
    title: 'Patient-owned permissions',
    text: 'Grant, deny, and revoke access from one control point.',
  },
  {
    icon: Building2,
    title: 'Hospital-verified actors',
    text: 'Only trusted institutions can operate in the network.',
  },
  {
    icon: CheckCircle2,
    title: 'Immutable audit history',
    text: 'Every read and write action is permanently traceable.',
  },
  {
    icon: CalendarClock,
    title: 'Time-ordered medical memory',
    text: 'Visits, reports, and prescriptions stay chronologically clear.',
  },
];

const PREVIEW_BENEFITS = [
  'One patient timeline across hospitals',
  'Role-safe doctor and patient workspaces',
  'Fast lookup with request-state visibility',
  'Export-ready medical history for continuity of care',
];

const TRUST_BADGES = ['Government-ready', 'FHIR-compatible model', 'Audit-first architecture'];

function roleHomePath(role: Role): string {
  if (role === 'doctor') {
    return '/doctor/dashboard';
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  return '/patient/dashboard';
}

export function LandingPage() {
  const { appUser, firebaseUser } = useAuth();
  const [loaderStage, setLoaderStage] = useState<LoaderStage>('visible');
  const [adminSessionToken, setAdminSessionToken] = useState(() => getStaticAdminSession()?.token ?? '');

  useEffect(() => {
    AOS.init({
      duration: 560,
      easing: 'ease-out-cubic',
      once: true,
      offset: 30,
    });
  }, []);

  useEffect(() => {
    const closeTimer = window.setTimeout(() => setLoaderStage('closing'), 760);
    const hideTimer = window.setTimeout(() => setLoaderStage('hidden'), 1080);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const syncSession = () => {
      setAdminSessionToken(getStaticAdminSession()?.token ?? '');
    };
    window.addEventListener('storage', syncSession);
    syncSession();
    return () => {
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  const activePortalLink = useMemo(() => {
    if (appUser) {
      return roleHomePath(appUser.role);
    }
    if (firebaseUser) {
      return '/verify';
    }
    if (adminSessionToken) {
      return '/admin/panel';
    }
    return '';
  }, [adminSessionToken, appUser, firebaseUser]);

  const showLoader = loaderStage !== 'hidden';
  const loaderClassName = loaderStage === 'closing' ? `${styles.loader} ${styles.loaderClosing}` : styles.loader;

  return (
    <main className={styles.page}>
      {showLoader ? (
        <section className={loaderClassName} aria-live="polite" aria-label="Loading MedLedger landing page">
          <div className={styles.loaderCard}>
            <BrandLogo size="lg" />
            <p className={styles.loaderTitle}>MedLedger</p>
            <p className={styles.loaderText}>Booting secure healthcare network...</p>
            <span className={styles.loaderBar} aria-hidden="true" />
          </div>
        </section>
      ) : null}

      <header className={styles.topNav}>
        <div className={styles.containerWide}>
          <div className={styles.navBar}>
            <a className={styles.brand} href="#home" aria-label="MedLedger home">
              <BrandLogo size="sm" />
              <span>
                <strong>MedLedger</strong>
                <small>National Cross-Hospital Record Network</small>
              </span>
            </a>

            <nav className={styles.navLinks} aria-label="Main navigation">
              <a href="#network">Network</a>
              <a href="#workflow">Workflow</a>
              <a href="#security">Security</a>
              <a href="#cta">Start</a>
            </nav>

            <div className={styles.navActions}>
              {activePortalLink ? (
                <Link to={activePortalLink} className={styles.navProfile} aria-label="Open your portal">
                  <UserCircle2 size={18} strokeWidth={2.2} />
                </Link>
              ) : (
                <Link to="/admin/login" className={styles.navLogin}>
                  Login
                </Link>
              )}
              <Link to={activePortalLink || '/access'} className={styles.navCta}>
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.heroSection} id="home">
        <div className={`${styles.containerWide} ${styles.heroGrid}`}>
          <article className={styles.heroContent} data-aos="fade-right">
            <p className={styles.kicker}>National Medical Infrastructure</p>
            <h1>One Patient. One Lifetime Record.</h1>
            <p>
              MedLedger keeps health history portable across verified hospitals with patient-owned permissioning,
              role-safe doctor workflows, and auditable medical continuity.
            </p>

            <div className={styles.heroActions}>
              <Link to="/access" className={styles.primaryBtn}>
                Get Started
              </Link>
              <Link to="/access/doctor" className={styles.secondaryBtn}>
                For Hospitals
              </Link>
            </div>

            <div className={styles.badgeRow}>
              {TRUST_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          </article>

          <article className={styles.heroVisual} data-aos="fade-left">
            <img src={HERO_IMAGE} alt="Clinical team using digital patient records" loading="eager" />
            <div className={styles.heroFloatCard}>
              <p>Live access control</p>
              <strong>Patient-approved doctor requests</strong>
            </div>
            <div className={styles.heroFloatCardAlt}>
              <p>National continuity</p>
              <strong>Cross-hospital timeline ready</strong>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.networkSection} id="network">
        <div className={styles.containerWide}>
          <header className={styles.sectionHeading} data-aos="fade-up">
            <p className={styles.sectionKicker}>Platform Modules</p>
            <h2>Purpose-built blocks for secure healthcare exchange</h2>
          </header>

          <div className={styles.networkGrid}>
            {NETWORK_MODULES.map((item) => (
              <article key={item.title} className={styles.networkCard} data-aos="fade-up">
                <div className={styles.iconWrap}>
                  <item.icon size={20} strokeWidth={2.2} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.continuitySection}>
        <div className={`${styles.containerWide} ${styles.continuityGrid}`}>
          <article className={styles.continuityVisual} data-aos="fade-right">
            <img src={CONTINUITY_IMAGE} alt="Doctor discussing treatment continuity with patient" loading="lazy" />
          </article>
          <article className={styles.continuityContent} data-aos="fade-left">
            <p className={styles.sectionKicker}>Problem to Solution</p>
            <h2>End fragmented records and repeated diagnostics</h2>
            <p>
              MedLedger connects verified hospitals so clinicians see complete context before treatment.
              Patients keep control of who can access their timeline.
            </p>
            <Link to="/access" className={styles.lightBtn}>
              Open Access Portal
            </Link>
          </article>
        </div>
      </section>

      <section className={styles.workflowSection} id="workflow">
        <div className={styles.containerWide}>
          <header className={styles.sectionHeading} data-aos="fade-up">
            <p className={styles.sectionKicker}>How It Works</p>
            <h2>Simple journey. Strict permissions.</h2>
          </header>

          <div className={styles.stepRail} aria-hidden="true" />
          <div className={styles.workflowGrid}>
            {WORKFLOW_STEPS.map((step, index) => (
              <article key={step.title} className={styles.stepCard} data-aos="fade-up">
                <span className={styles.stepNo}>{index + 1}</span>
                <div className={styles.iconWrap}>
                  <step.icon size={18} strokeWidth={2.2} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.previewSection}>
        <div className={`${styles.containerWide} ${styles.previewGrid}`}>
          <article className={styles.previewContent} data-aos="fade-right">
            <p className={styles.sectionKicker}>Product Preview</p>
            <h2>Operational clarity for doctor and patient workspaces</h2>
            <ul>
              {PREVIEW_BENEFITS.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={16} strokeWidth={2.3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.previewVisual} data-aos="fade-left">
            <img src={PREVIEW_IMAGE} alt="MedLedger digital health platform preview" loading="lazy" />
          </article>
        </div>
      </section>

      <section className={styles.securitySection} id="security">
        <div className={styles.containerWide}>
          <header className={styles.sectionHeading} data-aos="fade-up">
            <p className={styles.sectionKicker}>Security and Trust</p>
            <h2>Engineered for national-scale healthcare confidence</h2>
          </header>

          <div className={styles.securityGrid}>
            {SECURITY_POINTS.map((item) => (
              <article key={item.title} className={styles.securityCard} data-aos="fade-up">
                <div className={styles.iconWrap}>
                  <item.icon size={19} strokeWidth={2.2} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.splitSection}>
        <div className={`${styles.containerWide} ${styles.splitGrid}`}>
          <article className={styles.doctorCard} data-aos="fade-right">
            <p className={styles.sectionKicker}>For Doctors</p>
            <h3>Search, treat, and export with policy-safe access</h3>
            <ul>
              <li>
                <Stethoscope size={16} />
                <span>Create visits, prescriptions, and report records</span>
              </li>
              <li>
                <DatabaseZap size={16} />
                <span>Track visited patients with structured timelines</span>
              </li>
              <li>
                <ArrowRight size={16} />
                <span>Export medical data to Excel by date range</span>
              </li>
            </ul>
          </article>

          <article className={styles.patientCard} data-aos="fade-left">
            <p className={styles.sectionKicker}>For Patients</p>
            <h3>Own permissions, timeline visibility, and continuity</h3>
            <ul>
              <li>
                <UsersRound size={16} />
                <span>Approve or deny hospital doctor requests</span>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>Monitor access states across hospitals</span>
              </li>
              <li>
                <FileHeart size={16} />
                <span>Keep one longitudinal medical memory for life</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className={styles.ctaSection} id="cta">
        <div className={styles.containerWide}>
          <div className={styles.ctaCard} data-aos="fade-up">
            <h2>Healthcare memory for life.</h2>
            <p>Start MedLedger and build trusted continuity across every hospital interaction.</p>
            <div className={styles.ctaActions}>
              <Link to="/access" className={styles.primaryBtn}>
                Create Free Account
                <ArrowRight size={16} strokeWidth={2.3} />
              </Link>
              <Link to="/access/doctor" className={styles.secondaryBtn}>
                Register Hospital Doctor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.containerWide} ${styles.footerGrid}`}>
          <article className={styles.footerBrand}>
            <BrandLogo size="md" />
            <p>
              Secure national cross-hospital infrastructure for patient-controlled medical continuity.
            </p>
          </article>
          <article>
            <h4>Product</h4>
            <a>Patient Workspace</a>
            <a>Doctor Workspace</a>
            <a>Hospital Coverage</a>
          </article>
          <article>
            <h4>Company</h4>
            <a>About MedLedger</a>
            <a>Clinical Partners</a>
            <a>Support</a>
          </article>
          <article>
            <h4>Legal</h4>
            <a>Privacy</a>
            <a>Terms</a>
            <a>Compliance</a>
          </article>
        </div>
      </footer>
    </main>
  );
}
