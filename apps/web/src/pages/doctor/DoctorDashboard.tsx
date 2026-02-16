import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DashboardPanel, DashboardStat, StatusPill } from '../../components/dashboard';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import type { AccessRequest, DoctorProfile } from '../../types';
import { loadCachedResource, readCachedResource } from '../../utils/resourceCache';
import styles from './DoctorDashboardPage.module.css';

type DoctorDashboardCacheData = {
  profile: DoctorProfile | null;
  requests: AccessRequest[];
  syncedAt: number;
};

function resolveImageSource(value: string): string {
  if (!value) {
    return '';
  }
  if (value.startsWith('data:')) {
    return value;
  }
  return `data:image/jpeg;base64,${value}`;
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.2l8 5.33l8-5.33V7H4Zm16 10V9.6l-7.45 4.96a1 1 0 0 1-1.1 0L4 9.6V17h16Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6.6 3h2.3a1 1 0 0 1 .98.8l.53 2.67a1 1 0 0 1-.27.92l-1.3 1.29a14.9 14.9 0 0 0 6.48 6.48l1.29-1.3a1 1 0 0 1 .92-.27l2.67.53a1 1 0 0 1 .8.98v2.3a1.5 1.5 0 0 1-1.61 1.5A17.9 17.9 0 0 1 4.1 4.61A1.5 1.5 0 0 1 5.6 3h1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconHospital() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M10 3h4a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1V8a2 2 0 0 1 2-2h3V4a1 1 0 0 1 1-1Zm1 3v2h2V6h-2Zm-5 2v11h4v-4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v4h4V8h-2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8H6Zm6 11v-4h0v4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPending() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16a8 8 0 0 0 0-16Zm-1 4a1 1 0 1 1 2 0v4.59l2.7 2.7a1 1 0 1 1-1.4 1.42l-3-3A1 1 0 0 1 11 13V8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconApproved() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm4.28 6.78a1 1 0 0 0-1.41-1.41L10.5 11.73L9.13 10.36a1 1 0 0 0-1.41 1.42l2.08 2.07a1 1 0 0 0 1.41 0l5.07-5.07Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconDenied() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm4.7 6.7a1 1 0 0 0-1.4 0L12 12l-3.3-3.3a1 1 0 0 0-1.4 1.4L10.6 13.4l-3.3 3.3a1 1 0 1 0 1.4 1.4L12 14.8l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3 3.3-3.3a1 1 0 0 0 0-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 3a3 3 0 1 1 0 6a3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2a1 1 0 0 0 0-2Zm10 10a3 3 0 1 1 0 6a3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2a1 1 0 0 0 0-2ZM7 8a4 4 0 0 0 4 4h2a2 2 0 1 1 0 4h-1a1 1 0 1 0 0 2h1a4 4 0 1 0 0-8h-2a2 2 0 1 1 0-4h1a1 1 0 1 0 0-2h-1A4 4 0 0 0 7 8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function DoctorDashboard() {
  const { appUser } = useAuth();
  const cacheKey = `doctor-dashboard:${appUser?.uid ?? 'anonymous'}`;
  const cachedData = readCachedResource<DoctorDashboardCacheData>(cacheKey);
  const [profile, setProfile] = useState<DoctorProfile | null>(cachedData?.profile ?? null);
  const [requests, setRequests] = useState<AccessRequest[]>(cachedData?.requests ?? []);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const isDoctorApproved = appUser?.doctorApprovalStatus === 'approved';

  const loadDashboard = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}): Promise<void> => {
      const silent = options.silent ?? false;
      const force = options.force ?? false;
      const hasCached = Boolean(readCachedResource<DoctorDashboardCacheData>(cacheKey));

      if (!silent && !hasCached) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const nextData = await loadCachedResource(
          cacheKey,
          async () => {
            const profileResponse = await doctorApi.getProfile();
            const profileApproval = profileResponse.profile?.approval_status ?? appUser?.doctorApprovalStatus;
            const canLoadAccessRequests = profileApproval === 'approved';
            const requestsResponse = canLoadAccessRequests
              ? await doctorApi.listAccessRequests()
              : { requests: [] };

            return {
              profile: profileResponse.profile,
              requests: requestsResponse.requests,
              syncedAt: Date.now(),
            };
          },
          { maxAgeMs: 20_000, force },
        );

        setProfile(nextData.profile);
        setRequests(nextData.requests);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load doctor dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appUser?.doctorApprovalStatus, cacheKey],
  );

  useEffect(() => {
    const latestCache = readCachedResource<DoctorDashboardCacheData>(cacheKey);
    if (latestCache) {
      setProfile(latestCache.profile);
      setRequests(latestCache.requests);
      setLoading(false);
      void loadDashboard({ silent: true });
      return;
    }

    setProfile(null);
    setRequests([]);
    setLoading(true);
    void loadDashboard();
  }, [cacheKey, loadDashboard]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') {
        void loadDashboard({ silent: true, force: true });
      }
    };

    const intervalId = window.setInterval(sync, 15_000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [loadDashboard]);

  useLiveSyncRefresh(() => {
    void loadDashboard({ silent: true, force: true });
  });

  const waitingRequests = useMemo(
    () => requests.filter((request) => request.status === 'waiting').length,
    [requests],
  );
  const approvedRequests = useMemo(
    () => requests.filter((request) => request.status === 'approved').length,
    [requests],
  );
  const deniedRequests = useMemo(
    () => requests.filter((request) => request.status === 'denied').length,
    [requests],
  );

  const doctorName = profile?.doctor_name || appUser?.displayName || 'Doctor';
  const doctorEmail = profile?.doctor_email || appUser?.email || 'Not provided';
  const doctorPhone = profile?.doctor_phone || appUser?.phone || 'Not provided';
  const hospitalId = profile?.hospital_id || appUser?.hospitalId || 'Not linked';
  const specializations = profile?.specializations?.length
    ? profile.specializations.join(', ')
    : 'Not provided';
  const qualification = profile?.qualification || 'Not provided';
  const license = profile?.license || 'Not provided';
  const approvalStatus = profile?.approval_status ?? 'enabled';
  const profileImageSrc = resolveImageSource(profile?.profile_image_base64 ?? '');

  const initials = doctorName
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'DR';

  if (!appUser || loading) {
    return (
      <section className={styles.dashboard}>
        <DashboardPanel title="Doctor Dashboard" subtitle="Loading workspace...">
          <p className={styles.empty}>Loading doctor dashboard...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.dashboard}>
      <section className={styles.stats}>
        <DashboardStat label="Hospital" value={hospitalId} tone="primary" />
        <DashboardStat label="Waiting Requests" value={waitingRequests} tone="warning" />
        <DashboardStat label="Approved Requests" value={approvedRequests} tone="success" />
        <DashboardStat label="Denied Requests" value={deniedRequests} tone="info" />
      </section>

      <section className={styles.workspaceLayout}>
        <DashboardPanel
          className={styles.snapshotPanel}
          title="Doctor Snapshot"
          subtitle={refreshing ? 'Syncing latest professional profile...' : 'Verified doctor profile attributes.'}
          actions={<StatusPill label={String(approvalStatus)} tone={refreshing ? 'info' : 'success'} />}
        >
          <div className={styles.profileSummary}>
            {profileImageSrc ? (
              <img className={styles.profileImage} src={profileImageSrc} alt={`${doctorName} profile`} />
            ) : (
              <div className={styles.profileImageFallback} aria-hidden="true">
                {initials}
              </div>
            )}
            <div className={styles.profileContent}>
              <p className={styles.profileName}>{doctorName}</p>
              <p className={styles.profileIdentifier}>Hospital: {hospitalId}</p>
              <div className={styles.profileDetailList}>
                <p className={styles.profileDetail}>
                  <span className={styles.icon} aria-hidden="true">
                    <IconMail />
                  </span>
                  {doctorEmail}
                </p>
                <p className={styles.profileDetail}>
                  <span className={styles.icon} aria-hidden="true">
                    <IconPhone />
                  </span>
                  {doctorPhone}
                </p>
                <p className={styles.profileMetaLine}>
                  <strong>Specializations:</strong> {specializations}
                </p>
                <p className={styles.profileMetaLine}>
                  <strong>Qualification:</strong> {qualification}
                </p>
                <p className={styles.profileMetaLine}>
                  <strong>License:</strong> {license}
                </p>
              </div>
            </div>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {!isDoctorApproved ? (
            <p className={styles.error}>
              Doctor account is pending approval. Report / Help and Profile remain available.
            </p>
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          className={styles.quickPanel}
          title="Doctor Workspace Sections"
          subtitle="Open dedicated sections from the sidebar or using quick actions below."
        >
          <div className={styles.quickStats}>
            <article className={styles.quickMetric}>
              <span className={styles.metricIcon} aria-hidden="true">
                <IconHospital />
              </span>
              <div>
                <p className={styles.metricLabel}>Hospital Linked</p>
                <p className={styles.metricValue}>{hospitalId === 'Not linked' ? 0 : 1}</p>
              </div>
            </article>
            <article className={styles.quickMetric}>
              <span className={styles.metricIcon} aria-hidden="true">
                <IconPending />
              </span>
              <div>
                <p className={styles.metricLabel}>Waiting</p>
                <p className={styles.metricValue}>{waitingRequests}</p>
              </div>
            </article>
            <article className={styles.quickMetric}>
              <span className={styles.metricIcon} aria-hidden="true">
                <IconApproved />
              </span>
              <div>
                <p className={styles.metricLabel}>Approved</p>
                <p className={styles.metricValue}>{approvedRequests}</p>
              </div>
            </article>
            <article className={styles.quickMetric}>
              <span className={styles.metricIcon} aria-hidden="true">
                <IconDenied />
              </span>
              <div>
                <p className={styles.metricLabel}>Denied</p>
                <p className={styles.metricValue}>{deniedRequests}</p>
              </div>
            </article>
          </div>

          <div className={styles.actions}>
            <Link className={styles.linkButton} to="/doctor/search">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Patient Search
            </Link>
            <Link className={styles.linkButtonAlt} to="/doctor/visit-composer">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Visit Composer
            </Link>
            <Link className={styles.linkButtonAlt} to="/doctor/add-patient">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Add Patient
            </Link>
            <Link className={styles.linkButtonAlt} to="/doctor/visited-patients">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Visited Patients
            </Link>
            <Link className={styles.linkButtonAlt} to="/doctor/profile">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Profile
            </Link>
          </div>
        </DashboardPanel>
      </section>
    </section>
  );
}
