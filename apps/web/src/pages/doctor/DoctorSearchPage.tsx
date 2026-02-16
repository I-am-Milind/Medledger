import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import type { AccessRequest, DoctorProfile } from '../../types';
import { loadCachedResource, readCachedResource, writeCachedResource } from '../../utils/resourceCache';
import styles from './DoctorSearchPage.module.css';

type SearchResult = {
  patient_uid: string;
  patient_identifier: string;
  demographics: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
  };
  blood_group: string;
  allergies: string[];
  access_status: 'waiting' | 'approved' | 'denied';
};

type RecentPatient = {
  patient_uid: string;
  patient_identifier: string;
  patient_name: string;
  access_status: SearchResult['access_status'];
  searched_at: string;
};

type PatientVerificationStatus = 'verified' | 'not_verified';

type SearchSort = 'name_asc' | 'name_desc' | 'access';
type AccessFilter = 'all' | 'approved' | 'waiting' | 'denied';

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

function accessTone(status: SearchResult['access_status']): 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'danger';
  return 'warning';
}

function requestTone(status: AccessRequest['status']): 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'danger';
  return 'warning';
}

function verificationTone(status: PatientVerificationStatus | undefined): 'success' | 'danger' | 'neutral' {
  if (status === 'verified') return 'success';
  if (status === 'not_verified') return 'danger';
  return 'neutral';
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
}

function statusRank(status: SearchResult['access_status']): number {
  if (status === 'approved') return 0;
  if (status === 'waiting') return 1;
  return 2;
}

function readVerificationState(key: string): Record<string, PatientVerificationStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PatientVerificationStatus>;
  } catch {
    return {};
  }
}

function writeVerificationState(key: string, value: Record<string, PatientVerificationStatus>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

export function DoctorSearchPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const searchCacheKey = `doctor-search-results:${appUser?.uid ?? 'anonymous'}`;
  const accessCacheKey = `doctor-access-requests:${appUser?.uid ?? 'anonymous'}`;
  const profileCacheKey = `doctor-profile-summary:${appUser?.uid ?? 'anonymous'}`;
  const recentPatientsCacheKey = `doctor-recent-patients:${appUser?.uid ?? 'anonymous'}`;
  const verificationStorageKey = `doctor-patient-verification:${appUser?.uid ?? 'anonymous'}`;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>(
    readCachedResource<SearchResult[]>(searchCacheKey) ?? [],
  );
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>(
    readCachedResource<AccessRequest[]>(accessCacheKey) ?? [],
  );
  const [profile, setProfile] = useState<DoctorProfile | null>(
    readCachedResource<DoctorProfile | null>(profileCacheKey) ?? null,
  );
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>(
    readCachedResource<RecentPatient[]>(recentPatientsCacheKey) ?? [],
  );
  const [verificationState, setVerificationState] = useState<Record<string, PatientVerificationStatus>>(
    () => readVerificationState(verificationStorageKey),
  );
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [sortBy, setSortBy] = useState<SearchSort>('access');
  const [requestFilter, setRequestFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isHospitalLinked = Boolean((profile?.hospital_id || appUser?.hospitalId)?.trim());
  const isDoctorApproved = (profile?.approval_status ?? appUser?.doctorApprovalStatus) === 'approved';
  const canUseClinicalWorkflows = isHospitalLinked && isDoctorApproved;
  const doctorSummary = useMemo(
    () => ({
      name: profile?.doctor_name || appUser?.displayName || 'Doctor',
      hospital: profile?.hospital_id || appUser?.hospitalId || 'Not linked',
      specializations:
        profile?.specializations && profile.specializations.length > 0
          ? profile.specializations.join(', ')
          : 'Not provided',
    }),
    [appUser?.displayName, appUser?.hospitalId, profile],
  );

  const accessSummary = useMemo(
    () => ({
      waiting: accessRequests.filter((item) => item.status === 'waiting').length,
      approved: accessRequests.filter((item) => item.status === 'approved').length,
      denied: accessRequests.filter((item) => item.status === 'denied').length,
    }),
    [accessRequests],
  );

  useEffect(() => {
    void loadCachedResource(
      profileCacheKey,
      async () => {
        const response = await doctorApi.getProfile();
        return response.profile;
      },
      { maxAgeMs: 60_000 },
    ).then(setProfile);
  }, [profileCacheKey]);

  const loadAccessRequests = useCallback(
    async (options: { force?: boolean; silent?: boolean } = {}): Promise<void> => {
      if (!isDoctorApproved) {
        setAccessRequests([]);
        setRefreshing(false);
        return;
      }
      const force = options.force ?? false;
      const silent = options.silent ?? false;
      if (silent) setRefreshing(true);
      try {
        const nextRequests = await loadCachedResource(
          accessCacheKey,
          async () => {
            const response = await doctorApi.listAccessRequests();
            return response.requests;
          },
          { maxAgeMs: 15_000, force },
        );
        setAccessRequests(nextRequests);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh access states');
      } finally {
        setRefreshing(false);
      }
    },
    [accessCacheKey, isDoctorApproved],
  );

  useEffect(() => {
    void loadAccessRequests({ silent: true });
  }, [loadAccessRequests]);

  useEffect(() => {
    if (!isDoctorApproved) {
      setAccessRequests([]);
    }
  }, [isDoctorApproved]);

  useLiveSyncRefresh(() => {
    void loadAccessRequests({ force: true, silent: true });
  });

  function rememberPatients(items: SearchResult[]): void {
    if (items.length === 0) return;
    setRecentPatients((previous) => {
      const merged = [...previous];
      items.forEach((item) => {
        const patientName = `${item.demographics.first_name} ${item.demographics.last_name}`.trim();
        const nextEntry: RecentPatient = {
          patient_uid: item.patient_uid,
          patient_identifier: item.patient_identifier,
          patient_name: patientName || item.patient_uid,
          access_status: item.access_status,
          searched_at: new Date().toISOString(),
        };
        const existingIndex = merged.findIndex((entry) => entry.patient_identifier === item.patient_identifier);
        if (existingIndex >= 0) merged.splice(existingIndex, 1);
        merged.unshift(nextEntry);
      });
      const trimmed = merged.slice(0, 20);
      writeCachedResource<RecentPatient[]>(recentPatientsCacheKey, trimmed);
      return trimmed;
    });
  }

  async function runSearch(rawQuery: string): Promise<void> {
    if (!canUseClinicalWorkflows) {
      setError('Doctor approval is pending. You can use Report / Help now; clinical search unlocks after approval.');
      return;
    }
    const query = rawQuery.trim();
    if (!query) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await doctorApi.searchPatients(query);
      setSearchResults(result.results);
      writeCachedResource<SearchResult[]>(searchCacheKey, result.results);
      rememberPatients(result.results);
      await loadAccessRequests({ silent: true, force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch(): Promise<void> {
    await runSearch(searchQuery);
  }

  async function requestAccess(identifier: string): Promise<void> {
    if (!canUseClinicalWorkflows) {
      setError('Doctor approval is pending. Access requests are available after approval.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await doctorApi.createAccessRequest({
        patient_identifier: identifier,
        reason: 'Clinical evaluation required for active treatment.',
      });
      setMessage(`Access requested for ${identifier}`);
      await loadAccessRequests({ force: true, silent: true });
      if (searchQuery.trim()) {
        await runSearch(searchQuery);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access request failed');
    } finally {
      setBusy(false);
    }
  }

  function setPatientVerification(patientIdentifier: string, status: PatientVerificationStatus): void {
    setVerificationState((previous) => {
      const next = { ...previous, [patientIdentifier]: status };
      writeVerificationState(verificationStorageKey, next);
      return next;
    });
  }

  const filteredResults = useMemo(() => {
    const statusFiltered =
      accessFilter === 'all'
        ? searchResults
        : searchResults.filter((item) => item.access_status === accessFilter);
    const sorted = [...statusFiltered];
    if (sortBy === 'name_asc') {
      sorted.sort((left, right) => {
        const leftName = `${left.demographics.first_name} ${left.demographics.last_name}`.trim().toLowerCase();
        const rightName = `${right.demographics.first_name} ${right.demographics.last_name}`.trim().toLowerCase();
        return leftName.localeCompare(rightName);
      });
    } else if (sortBy === 'name_desc') {
      sorted.sort((left, right) => {
        const leftName = `${left.demographics.first_name} ${left.demographics.last_name}`.trim().toLowerCase();
        const rightName = `${right.demographics.first_name} ${right.demographics.last_name}`.trim().toLowerCase();
        return rightName.localeCompare(leftName);
      });
    } else {
      sorted.sort((left, right) => {
        const statusDiff = statusRank(left.access_status) - statusRank(right.access_status);
        if (statusDiff !== 0) return statusDiff;
        return left.patient_identifier.localeCompare(right.patient_identifier);
      });
    }
    return sorted;
  }, [accessFilter, searchResults, sortBy]);

  const filteredAccessRequests = useMemo(() => {
    const normalized = requestFilter.trim().toLowerCase();
    if (!normalized) return accessRequests;
    return accessRequests.filter((item) => {
      const values = [
        item.patient_identifier,
        item.patient_uid,
        item.status,
        item.reason,
        item.doctor_hospital_id,
        item.created_at,
      ];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [accessRequests, requestFilter]);

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.searchPanel}
        title="Patient Search"
        subtitle="Professional lookup and access-state management for clinical workflows."
        actions={
          <button
            className={styles.button}
            type="button"
            disabled={busy || !canUseClinicalWorkflows}
            onClick={() => void handleSearch()}
          >
            Search
          </button>
        }
      >
        <label className={styles.searchLabel} htmlFor="doctor-patient-search">
          Search by UID / email / phone / MLP identifier
        </label>
        <div className={styles.searchField}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            id="doctor-patient-search"
            className={styles.searchInput}
            placeholder="Enter UID / email / phone / MLP identifier"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSearch();
              }
            }}
          />
        </div>

        <div className={styles.searchScrollArea}>
          {!canUseClinicalWorkflows ? (
            <p className={styles.error}>
              Doctor approval is pending. You can still use Report / Help. Patient Search activates after approval.
            </p>
          ) : null}
          <div className={styles.topMeta}>
            <p className={styles.metaLine}>
              Doctor: {doctorSummary.name} | Hospital: {doctorSummary.hospital}
            </p>
            <p className={styles.metaLine}>Specializations: {doctorSummary.specializations}</p>
          </div>

          <section className={styles.recentSection}>
            <p className={styles.recentTitle}>Recent Patients</p>
            {recentPatients.length === 0 ? (
              <p className={styles.empty}>No recent patient searches.</p>
            ) : (
              <div className={styles.recentList}>
                {recentPatients.map((item) => (
                  <button
                    className={styles.recentChip}
                    key={`${item.patient_identifier}-${item.searched_at}`}
                    type="button"
                    onClick={() => {
                      setSearchQuery(item.patient_identifier);
                      void runSearch(item.patient_identifier);
                    }}
                  >
                    <span>{item.patient_name}</span>
                    <small>{item.patient_identifier}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>Search Results</p>
              <span className={styles.resultCount}>{filteredResults.length}</span>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.filterRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${accessFilter === 'all' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setAccessFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${accessFilter === 'approved' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setAccessFilter('approved')}
                >
                  Approved
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${accessFilter === 'waiting' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setAccessFilter('waiting')}
                >
                  Waiting
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${accessFilter === 'denied' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setAccessFilter('denied')}
                >
                  Denied
                </button>
              </div>
              <label className={styles.sortField}>
                Sort
                <select
                  className={styles.select}
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SearchSort)}
                >
                  <option value="access">Access Priority</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
              </label>
            </div>

            {filteredResults.length === 0 ? <p className={styles.empty}>No search results yet.</p> : null}
            <div className={styles.list}>
              {filteredResults.map((item) => {
                const patientVerification = verificationState[item.patient_identifier];
                return (
                  <article className={styles.item} key={item.patient_uid}>
                    <div className={styles.itemHeader}>
                      <p className={styles.itemTitle}>
                        {item.demographics.first_name} {item.demographics.last_name}
                      </p>
                      <StatusPill label={item.access_status} tone={accessTone(item.access_status)} />
                    </div>
                    <p className={styles.itemLine}>Identifier: {item.patient_identifier}</p>
                    <p className={styles.itemLine}>Blood Group: {item.blood_group || 'Not set'}</p>
                    <p className={styles.itemLine}>
                      Allergies: {item.allergies.length === 0 ? 'None' : item.allergies.join(', ')}
                    </p>
                    {item.access_status === 'approved' ? (
                      <p className={styles.itemLine}>
                        Verification Status:{' '}
                        <StatusPill label={patientVerification ?? 'pending'} tone={verificationTone(patientVerification)} />
                      </p>
                    ) : null}
                    <div className={styles.actions}>
                      {item.access_status === 'approved' ? (
                        <>
                          <button
                            className={styles.button}
                            type="button"
                            onClick={() => {
                              rememberPatients([item]);
                              navigate(`/doctor/visit-composer?patient=${encodeURIComponent(item.patient_identifier)}`);
                            }}
                          >
                            Open Visit Composer
                          </button>
                          <button
                            className={styles.buttonSuccess}
                            type="button"
                            onClick={() => {
                              setPatientVerification(item.patient_identifier, 'verified');
                            }}
                          >
                            Verify Patient
                          </button>
                          <button
                            className={styles.buttonDanger}
                            type="button"
                            onClick={() => {
                              setPatientVerification(item.patient_identifier, 'not_verified');
                            }}
                          >
                            Don&apos;t Verify
                          </button>
                          <Link className={styles.linkButton} to={`/doctor/lookup/${item.patient_identifier}`}>
                            Medical History
                          </Link>
                        </>
                      ) : (
                        <button
                          className={styles.buttonAlt}
                          type="button"
                          disabled={!canUseClinicalWorkflows}
                          onClick={() => {
                            void requestAccess(item.patient_identifier);
                            rememberPatients([item]);
                          }}
                        >
                          Request Access
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>Access States</p>
              {refreshing ? <StatusPill label="syncing" tone="info" /> : null}
            </div>
            <div className={styles.summaryRow}>
              <p className={styles.summaryLine}>Waiting: {accessSummary.waiting}</p>
              <p className={styles.summaryLine}>Approved: {accessSummary.approved}</p>
              <p className={styles.summaryLine}>Denied: {accessSummary.denied}</p>
            </div>

            <div className={styles.searchField}>
              <span className={styles.searchIcon}>
                <SearchIcon />
              </span>
              <input
                className={styles.searchInput}
                placeholder="Filter access states by patient, status, hospital, date"
                value={requestFilter}
                onChange={(event) => setRequestFilter(event.target.value)}
              />
            </div>

            {filteredAccessRequests.length === 0 ? (
              <p className={styles.empty}>No access requests found.</p>
            ) : (
              <div className={styles.accessStatesList}>
                {filteredAccessRequests.map((request) => (
                  <article className={styles.accessStateItem} key={request.id}>
                    <div className={styles.itemHeader}>
                      <p className={styles.itemTitle}>{request.patient_identifier}</p>
                      <StatusPill label={request.status} tone={requestTone(request.status)} />
                    </div>
                    <p className={styles.itemLine}>Hospital: {request.doctor_hospital_id}</p>
                    <p className={styles.itemLine}>Requested: {formatDateTime(request.created_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {message ? <p className={styles.hint}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </DashboardPanel>
    </section>
  );
}
