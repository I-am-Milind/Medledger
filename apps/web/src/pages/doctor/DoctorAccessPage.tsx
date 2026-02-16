import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import type { AccessRequest } from '../../types';
import { loadCachedResource, readCachedResource } from '../../utils/resourceCache';
import styles from './DoctorAccessPage.module.css';

type DoctorAccessCache = {
  requests: AccessRequest[];
  syncedAt: number;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M10.5 3.5a7 7 0 1 1 0 14a7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm7.85 11.44l2.65 2.65a1 1 0 0 1-1.42 1.42l-2.65-2.65a1 1 0 1 1 1.42-1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

function requestTone(status: AccessRequest['status']): 'success' | 'warning' | 'danger' {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'denied') {
    return 'danger';
  }
  return 'warning';
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

export function DoctorAccessPage() {
  const { appUser } = useAuth();
  const isDoctorApproved = appUser?.doctorApprovalStatus === 'approved';
  const cacheKey = `doctor-access-page:${appUser?.uid ?? 'anonymous'}`;
  const cachedData = readCachedResource<DoctorAccessCache>(cacheKey);
  const [requests, setRequests] = useState<AccessRequest[]>(cachedData?.requests ?? []);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}): Promise<void> => {
      if (!isDoctorApproved) {
        setRequests([]);
        setLoading(false);
        setRefreshing(false);
        setError('');
        return;
      }

      const silent = options.silent ?? false;
      const force = options.force ?? false;
      const hasCached = Boolean(readCachedResource<DoctorAccessCache>(cacheKey));

      if (!silent && !hasCached) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await loadCachedResource(
          cacheKey,
          async () => {
            const requestsResponse = await doctorApi.listAccessRequests();
            return {
              requests: requestsResponse.requests,
              syncedAt: Date.now(),
            };
          },
          { maxAgeMs: 15_000, force },
        );
        setRequests(next.requests);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load access states');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, isDoctorApproved],
  );

  useEffect(() => {
    const latestCache = readCachedResource<DoctorAccessCache>(cacheKey);
    if (latestCache) {
      setRequests(latestCache.requests);
      setLoading(false);
      void loadData({ silent: true });
      return;
    }

    setLoading(true);
    void loadData();
  }, [loadData]);

  useLiveSyncRefresh(() => {
    void loadData({ silent: true, force: true });
  });

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') {
        void loadData({ silent: true, force: true });
      }
    };

    const intervalId = window.setInterval(sync, 15_000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [loadData]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRequests = useMemo(() => {
    if (!normalizedSearch) {
      return requests;
    }
    return requests.filter((item) => {
      const values = [
        item.patient_identifier,
        item.patient_uid,
        item.reason,
        item.status,
        item.doctor_hospital_id,
        item.created_at,
      ];
      return values.some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [normalizedSearch, requests]);

  const waitingCount = requests.filter((item) => item.status === 'waiting').length;
  const approvedCount = requests.filter((item) => item.status === 'approved').length;
  const deniedCount = requests.filter((item) => item.status === 'denied').length;

  function toggleRequest(requestId: string): void {
    setExpandedRequests((previous) => ({
      ...previous,
      [requestId]: !previous[requestId],
    }));
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <DashboardPanel title="Access States" subtitle="Loading access states...">
          <p className={styles.empty}>Loading doctor access data...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.requestsPanel}
        title="Access States"
        subtitle={
          isDoctorApproved
            ? 'Track waiting, approved, and denied patient access requests.'
            : 'Doctor approval is pending. Access-state workflow unlocks after approval.'
        }
        actions={<StatusPill label={refreshing ? 'syncing' : 'live synced'} tone={refreshing ? 'info' : 'success'} />}
      >
        {!isDoctorApproved ? (
          <p className={styles.error}>
            Doctor approval is pending. You can use Profile and Report / Help for now.
          </p>
        ) : null}
        <label className={styles.searchLabel} htmlFor="doctor-access-search">
          Request Search
        </label>
        <div className={styles.searchField}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            id="doctor-access-search"
            className={styles.searchInput}
            placeholder="Search by patient identifier, UID, reason, status, date"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className={styles.summaryRow}>
          <p className={styles.summaryLine}>Waiting: {waitingCount}</p>
          <p className={styles.summaryLine}>Approved: {approvedCount}</p>
          <p className={styles.summaryLine}>Denied: {deniedCount}</p>
          <p className={styles.summaryLine}>Total: {filteredRequests.length}</p>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {filteredRequests.length === 0 ? <p className={styles.empty}>No access requests found.</p> : null}

        <div className={styles.list}>
          {filteredRequests.map((request) => (
            <article className={styles.compactCard} key={request.id}>
              <button
                className={styles.cardHeaderButton}
                type="button"
                onClick={() => toggleRequest(request.id)}
                aria-expanded={Boolean(expandedRequests[request.id])}
              >
                <div className={styles.cardHeaderLeft}>
                  <p className={styles.itemTitle}>{request.patient_identifier}</p>
                  <p className={styles.itemMeta}>Request ID: {request.id}</p>
                </div>
                <div className={styles.cardHeaderRight}>
                  <StatusPill label={request.status} tone={requestTone(request.status)} />
                  <span className={styles.expandLabel}>{expandedRequests[request.id] ? 'Hide' : 'View'}</span>
                </div>
              </button>

              {expandedRequests[request.id] ? (
                <div className={styles.cardBody}>
                  <p className={styles.itemLine}>Patient UID: {request.patient_uid}</p>
                  <p className={styles.itemLine}>Hospital: {request.doctor_hospital_id}</p>
                  <p className={styles.itemLine}>Requested At: {formatDateTime(request.created_at)}</p>
                  <p className={styles.itemLine}>Reason: {request.reason}</p>
                  {request.status === 'approved' ? (
                    <Link className={styles.linkButton} to={`/doctor/lookup/${request.patient_identifier}`}>
                      Open Patient Summary
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}
