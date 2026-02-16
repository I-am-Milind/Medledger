import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Role } from '../types';
import { BrandLogo } from './BrandLogo';
import styles from './AppShell.module.css';

type NavIconName =
  | 'dashboard'
  | 'coverage'
  | 'access'
  | 'records'
  | 'search'
  | 'visit'
  | 'addPatient'
  | 'support'
  | 'profile'
  | 'admin';

type NavItem = {
  to: string;
  label: string;
  icon: NavIconName;
};

const roleNav: Record<Role, NavItem[]> = {
  patient: [
    { to: '/patient/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/patient/coverage', label: 'Doctor Coverage', icon: 'coverage' },
    { to: '/patient/track-records', label: 'Track Records', icon: 'records' },
    { to: '/patient/support', label: 'Report / Help', icon: 'support' },
    { to: '/patient/profile', label: 'Profile', icon: 'profile' },
  ],
  doctor: [
    { to: '/doctor/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/doctor/search', label: 'Patient Search', icon: 'search' },
    { to: '/doctor/access-requests', label: 'Access States', icon: 'access' },
    { to: '/doctor/visit-composer', label: 'Visit Composer', icon: 'visit' },
    { to: '/doctor/add-patient', label: 'Add Patient', icon: 'addPatient' },
    { to: '/doctor/visited-patients', label: 'Visited Patients', icon: 'records' },
    { to: '/doctor/support', label: 'Report / Help', icon: 'support' },
    { to: '/doctor/profile', label: 'Profile', icon: 'profile' },
  ],
  admin: [{ to: '/admin/dashboard', label: 'Admin Dashboard', icon: 'admin' }],
};

function renderIcon(name: NavIconName) {
  switch (name) {
    case 'coverage':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7.5h11.2M4 12h16M4 16.5h11.2M17.5 5.8l2 2M18.6 16.1l4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'records':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h10M7 9h10M7 13.5h7M6.2 19.5h11.6A2.2 2.2 0 0 0 20 17.3V6.7a2.2 2.2 0 0 0-2.2-2.2H6.2A2.2 2.2 0 0 0 4 6.7v10.6a2.2 2.2 0 0 0 2.2 2.2Z" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.4 4.2a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4Zm0 2a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm6.4 8.98l3 3a1 1 0 0 1-1.42 1.42l-3-3a1 1 0 0 1 1.42-1.42Z" />
        </svg>
      );
    case 'access':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 0 1 9 9v1.4a2.6 2.6 0 0 1-2.6 2.6H18V18a3 3 0 1 1-6 0v-2h-1.6A2.6 2.6 0 0 1 7.8 13.4V12a4.2 4.2 0 1 1 8.4 0v1.4a.6.6 0 0 1-.6.6h-2.8v4a1 1 0 1 0 2 0v-2h3.6A1.4 1.4 0 0 0 19.8 14.6V12A7.8 7.8 0 1 0 4.2 12v7a1 1 0 1 1-2 0v-7A9.8 9.8 0 0 1 12 3Z" />
        </svg>
      );
    case 'visit':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v9h10V6H7Zm4 3h2v2h2v2h-2v2h-2v-2H9v-2h2V9Zm-6 12h14a1 1 0 1 0 0-2H5a1 1 0 1 0 0 2Z" />
        </svg>
      );
    case 'addPatient':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6a3 3 0 0 0 0-6ZM5 19a7 7 0 0 1 14 0a1 1 0 1 1-2 0a5 5 0 0 0-10 0a1 1 0 1 1-2 0Zm14-8a1 1 0 0 1 1-1h1v-1a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 0 1-2 0v-1h-1a1 1 0 0 1-1-1Z" />
        </svg>
      );
    case 'support':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.8a7.2 7.2 0 0 0-7.2 7.2v3.4a2 2 0 0 0 2 2h1.2V11a4 4 0 1 1 8 0v6.4h1.2a2 2 0 0 0 2-2V12A7.2 7.2 0 0 0 12 4.8Zm-2 12.6h4" />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12.4a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm-7 7.1a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'admin':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.8l7.2 3.3v5.2c0 4.1-2.8 7.8-7.2 9-4.4-1.2-7.2-4.9-7.2-9V7.1L12 3.8Zm-2 8.2h4m-2-2v4" />
        </svg>
      );
    case 'dashboard':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 4.5h6.8v6.8H4.5V4.5Zm8.2 0h6.8v4.6h-6.8V4.5Zm0 6h6.8v9h-6.8v-9Zm-8.2 2.2h6.8v6.8H4.5v-6.8Z" />
        </svg>
      );
  }
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const { appUser, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const showImportantNotice = /\/dashboard$/.test(location.pathname);

  const matchedPath =
    appUser?.role === 'doctor' && location.pathname.startsWith('/doctor/lookup/')
      ? '/doctor/visited-patients'
      : location.pathname;

  const navItems = useMemo(() => {
    if (!appUser) {
      return [];
    }
    return roleNav[appUser.role];
  }, [appUser]);
  const activeItem = useMemo(
    () => navItems.find((item) => matchedPath.startsWith(item.to)) ?? null,
    [matchedPath, navItems],
  );
  const activeSection = activeItem?.label ?? 'Workspace';
  const activeIcon = activeItem?.icon ?? 'dashboard';

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`.trim()}>
        <div className={styles.brand}>
          <BrandLogo size="xl" className={styles.logo} />
          <span className={styles.mlpBadge}>MLP</span>
          <p className={styles.brandCaption}>Secure Medical Intelligence Workspace</p>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`.trim()
              }
            >
              <span className={styles.navIcon}>{renderIcon(item.icon)}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.userCard}>
          <div className={styles.userIdentity}>
            <span className={styles.userAvatarIcon}>{renderIcon('profile')}</span>
            <div className={styles.userMeta}>
              <p className={styles.userEmail}>{appUser?.email}</p>
              <p className={styles.userRole}>{appUser?.role.toUpperCase()} PORTAL</p>
            </div>
          </div>
          <button
            className={styles.logout}
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className={styles.contentWrap}>
        <header className={styles.mobileTopbar}>
          <div className={styles.mobileTopbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setIsSidebarOpen((previous) => !previous)}
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {isSidebarOpen ? 'Close' : 'Menu'}
            </button>

            <div className={styles.mobileTitleWrap}>
              <span className={styles.mobileSectionIcon}>{renderIcon(activeIcon)}</span>
              <p className={styles.mobileTitle}>{activeSection}</p>
              <p className={styles.mobileSubtitle}>MedLedger MLP Network</p>
            </div>
          </div>

          <span className={styles.syncBadge}>
            <span className={styles.syncDot} aria-hidden="true" />
            Live Synced
          </span>
        </header>

        {showImportantNotice ? (
          <section className={styles.devNoticeWrap} aria-live="polite">
            <article className={styles.devNoticeCard}>
              <span className={styles.devNoticeDot} aria-hidden="true" />
              <div className={styles.devNoticeText}>
                <p className={styles.devNoticeTitle}>Important Notice</p>
                <ul className={styles.devNoticeList}>
                  <li>MedLedger is in controlled rollout. Verify critical actions before production use.</li>
                  <li>This website is a prototype. UI and workflows may change during validation.</li>
                </ul>
              </div>
            </article>
          </section>
        ) : null}

        <main className={`${styles.main} ${showImportantNotice ? styles.mainWithNotice : ''}`.trim()}>
          {children}
        </main>
      </div>

      <button
        className={`${styles.overlay} ${isSidebarOpen ? styles.overlayVisible : ''}`.trim()}
        type="button"
        tabIndex={isSidebarOpen ? 0 : -1}
        aria-hidden={!isSidebarOpen}
        onClick={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
