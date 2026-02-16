import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  Database,
  LogOut,
  MailQuestion,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { adminPortalApi } from '../../api/services';
import { BrandLogo } from '../../components/BrandLogo';
import { toastError, toastInfo, toastSuccess } from '../../components/toast';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import { clearStaticAdminSession, getStaticAdminSession } from './staticAdminAuth';
import styles from './AdminPanelPage.module.css';

type AdminTab =
  | 'overview'
  | 'doctorVerification'
  | 'patientVerification'
  | 'doctorDatabase'
  | 'patientDatabase'
  | 'inbox';

type LivePayload = Awaited<ReturnType<typeof adminPortalApi.getLiveData>>;

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'doctorVerification', label: 'Doctor Verification' },
  { id: 'patientVerification', label: 'Patient Verification' },
  { id: 'doctorDatabase', label: 'Doctor Database' },
  { id: 'patientDatabase', label: 'Patient Database' },
  { id: 'inbox', label: 'Reports / Help / Contact' },
];

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }
  return parsed.toLocaleString();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function AdminPanelPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<'all' | 'help' | 'report' | 'contact'>('all');

  const session = useMemo(() => getStaticAdminSession(), []);
  const sessionToken = session?.token ?? '';
  const sessionEmail = session?.email ?? '';
  const liveTimestamp = payload?.timestamp ? formatDateTime(payload.timestamp) : 'Waiting...';

  const loadData = useCallback(
    async (options: { silent?: boolean } = {}): Promise<void> => {
      if (!sessionToken) {
        return;
      }
      if (options.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const next = await adminPortalApi.getLiveData(sessionToken);
        setPayload(next);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load admin live data';
        setError(message);
        if (!options.silent) {
          toastError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void loadData();
    const intervalId = window.setInterval(() => {
      void loadData({ silent: true });
    }, 10_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadData, sessionToken]);

  useLiveSyncRefresh(() => {
    void loadData({ silent: true });
  }, { throttleMs: 1000 });

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  async function handleLogout(): Promise<void> {
    try {
      if (sessionToken) {
        await adminPortalApi.logout(sessionToken);
      }
    } catch {
      // Keep logout best-effort.
    } finally {
      clearStaticAdminSession();
      toastInfo('Admin session ended.');
      navigate('/admin/login', { replace: true });
    }
  }

  async function updateDoctorStatus(
    doctorUid: string,
    status: 'pending' | 'approved' | 'denied',
  ): Promise<void> {
    try {
      await adminPortalApi.verifyDoctor(sessionToken, doctorUid, status);
      await loadData({ silent: true });
      toastSuccess(`Doctor status updated to ${status}.`);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Unable to update doctor verification';
      setError(message);
      toastError(message);
    }
  }

  async function updatePatientStatus(
    patientUid: string,
    status: 'pending' | 'verified' | 'rejected',
  ): Promise<void> {
    try {
      await adminPortalApi.verifyPatient(sessionToken, patientUid, status);
      await loadData({ silent: true });
      toastSuccess(`Patient status updated to ${status}.`);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Unable to update patient verification';
      setError(message);
      toastError(message);
    }
  }

  async function updateInboxStatus(
    requestId: string,
    status: 'open' | 'in_progress' | 'resolved',
  ): Promise<void> {
    try {
      await adminPortalApi.updateSupportRequest(sessionToken, requestId, status);
      await loadData({ silent: true });
      toastSuccess(`Support request marked ${status}.`);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update inbox request';
      setError(message);
      toastError(message);
    }
  }

  const doctorRows = payload?.doctor_database ?? [];
  const patientRows = payload?.patient_database ?? [];
  const inboxRows = payload?.support_inbox ?? [];

  const filteredDoctors = useMemo(() => {
    const needle = normalize(doctorSearch);
    if (!needle) {
      return doctorRows;
    }
    return doctorRows.filter((row) => {
      const values = [
        row.doctor_name,
        row.doctor_email,
        row.doctor_phone,
        row.hospital_id,
        row.uid,
        row.qualification,
        row.license,
        row.approval_status,
        row.specializations.join(' '),
      ];
      return values.some((value) => normalize(value).includes(needle));
    });
  }, [doctorRows, doctorSearch]);

  const filteredPatients = useMemo(() => {
    const needle = normalize(patientSearch);
    if (!needle) {
      return patientRows;
    }
    return patientRows.filter((row) => {
      const values = [
        row.patient_name,
        row.email,
        row.phone,
        row.identifier,
        row.uid,
        row.blood_group,
        row.verification_status,
      ];
      return values.some((value) => normalize(value).includes(needle));
    });
  }, [patientRows, patientSearch]);

  const filteredInbox = useMemo(() => {
    const needle = normalize(inboxSearch);
    return inboxRows.filter((row) => {
      if (inboxCategoryFilter !== 'all' && row.category !== inboxCategoryFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const values = [
        row.actor_name,
        row.actor_email,
        row.actor_phone,
        row.hospital_id,
        row.subject,
        row.message,
        row.category,
        row.status,
      ];
      return values.some((value) => normalize(value).includes(needle));
    });
  }, [inboxRows, inboxCategoryFilter, inboxSearch]);

  const pendingDoctors = payload?.doctor_verifications.filter((row) => row.approval_status === 'pending') ?? [];
  const pendingPatients =
    payload?.patient_verifications.filter((row) => row.verification_status === 'pending') ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <BrandLogo size="md" />
          <div>
            <h1>MedLedger Admin Portal</h1>
            <p>Live control center for verification, database monitoring, and support governance</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.liveBadge}>
            <Activity size={14} />
            {refreshing ? 'Syncing...' : 'Live Data'}
          </span>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => {
              void loadData({ silent: true });
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      <nav className={styles.navbar} aria-label="Admin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`.trim()}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={styles.metaStrip}>
        <p>
          Signed in as <strong>{sessionEmail}</strong>
        </p>
        <p>
          Last sync: <strong>{liveTimestamp}</strong>
        </p>
        <Link className={styles.backLink} to="/">
          Back to Landing
        </Link>
      </section>

      {error ? (
        <section className={styles.errorCard} role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </section>
      ) : null}

      {loading ? (
        <section className={styles.loadingCard}>Loading admin live data...</section>
      ) : null}

      {!loading && payload ? (
        <section className={styles.content}>
          {activeTab === 'overview' ? (
            <>
              <section className={styles.statsGrid}>
                <article className={styles.statCard}>
                  <span className={styles.statIcon}>
                    <UsersRound size={18} />
                  </span>
                  <p className={styles.statLabel}>Total Doctors</p>
                  <p className={styles.statValue}>{payload.summary.total_doctors}</p>
                  <p className={styles.statMeta}>
                    Pending {payload.summary.doctor_pending} | Approved {payload.summary.doctor_approved}
                  </p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon}>
                    <UserRoundCheck size={18} />
                  </span>
                  <p className={styles.statLabel}>Total Patients</p>
                  <p className={styles.statValue}>{payload.summary.total_patients}</p>
                  <p className={styles.statMeta}>
                    Pending {payload.summary.patient_pending} | Verified {payload.summary.patient_verified}
                  </p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon}>
                    <MailQuestion size={18} />
                  </span>
                  <p className={styles.statLabel}>Support Inbox</p>
                  <p className={styles.statValue}>{payload.support_inbox.length}</p>
                  <p className={styles.statMeta}>
                    Open {payload.summary.support_open} | Resolved {payload.summary.support_resolved}
                  </p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon}>
                    <ShieldCheck size={18} />
                  </span>
                  <p className={styles.statLabel}>Governance</p>
                  <p className={styles.statValue}>Active</p>
                  <p className={styles.statMeta}>Verification pipelines online</p>
                </article>
              </section>

              <section className={styles.dualGrid}>
                <article className={styles.panel}>
                  <h2>Doctor Verification Queue</h2>
                  {pendingDoctors.length === 0 ? (
                    <p className={styles.empty}>No pending doctor verifications.</p>
                  ) : (
                    <div className={styles.compactList}>
                      {pendingDoctors.slice(0, 8).map((row) => (
                        <div className={styles.compactItem} key={row.uid}>
                          <div>
                            <p className={styles.itemTitle}>{row.doctor_name || row.uid}</p>
                            <p className={styles.itemMeta}>{row.hospital_id || 'No hospital'} | {row.doctor_email}</p>
                          </div>
                          <span className={`${styles.statusPill} ${styles.statusWarning}`}>pending</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className={styles.panel}>
                  <h2>Patient Verification Queue</h2>
                  {pendingPatients.length === 0 ? (
                    <p className={styles.empty}>No pending patient verifications.</p>
                  ) : (
                    <div className={styles.compactList}>
                      {pendingPatients.slice(0, 8).map((row) => (
                        <div className={styles.compactItem} key={row.uid}>
                          <div>
                            <p className={styles.itemTitle}>{row.patient_name || row.uid}</p>
                            <p className={styles.itemMeta}>{row.identifier} | {row.email}</p>
                          </div>
                          <span className={`${styles.statusPill} ${styles.statusWarning}`}>pending</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            </>
          ) : null}

          {activeTab === 'doctorVerification' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Doctor Verification</h2>
                <div className={styles.searchWrap}>
                  <Database size={14} />
                  <input
                    placeholder="Search doctor, hospital, email, status"
                    value={doctorSearch}
                    onChange={(event) => setDoctorSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.records}>
                {filteredDoctors.map((row) => (
                  <article className={styles.recordCard} key={row.uid}>
                    <div className={styles.recordHeader}>
                      <p className={styles.itemTitle}>{row.doctor_name || row.uid}</p>
                      <span
                        className={`${styles.statusPill} ${
                          row.approval_status === 'approved'
                            ? styles.statusSuccess
                            : row.approval_status === 'denied'
                              ? styles.statusDanger
                              : styles.statusWarning
                        }`.trim()}
                      >
                        {row.approval_status}
                      </span>
                    </div>
                    <p className={styles.itemMeta}>{row.doctor_email} | {row.doctor_phone || 'No phone'}</p>
                    <p className={styles.itemMeta}>Hospital: {row.hospital_id || 'Not linked'}</p>
                    <p className={styles.itemMeta}>
                      Specializations: {row.specializations.length > 0 ? row.specializations.join(', ') : 'None'}
                    </p>
                    <p className={styles.itemMeta}>
                      Qualification: {row.qualification || 'Not provided'} | License: {row.license || 'Not provided'}
                    </p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionApprove} onClick={() => void updateDoctorStatus(row.uid, 'approved')}>
                        Approve
                      </button>
                      <button type="button" className={styles.actionWarning} onClick={() => void updateDoctorStatus(row.uid, 'pending')}>
                        Mark Pending
                      </button>
                      <button type="button" className={styles.actionDeny} onClick={() => void updateDoctorStatus(row.uid, 'denied')}>
                        Deny
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'patientVerification' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Patient Verification</h2>
                <div className={styles.searchWrap}>
                  <UsersRound size={14} />
                  <input
                    placeholder="Search patient, identifier, email, verification status"
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.records}>
                {filteredPatients.map((row) => (
                  <article className={styles.recordCard} key={row.uid}>
                    <div className={styles.recordHeader}>
                      <p className={styles.itemTitle}>{row.patient_name || row.uid}</p>
                      <span
                        className={`${styles.statusPill} ${
                          row.verification_status === 'verified'
                            ? styles.statusSuccess
                            : row.verification_status === 'rejected'
                              ? styles.statusDanger
                              : styles.statusWarning
                        }`.trim()}
                      >
                        {row.verification_status}
                      </span>
                    </div>
                    <p className={styles.itemMeta}>{row.identifier}</p>
                    <p className={styles.itemMeta}>{row.email} | {row.phone || 'No phone'}</p>
                    <p className={styles.itemMeta}>Blood Group: {row.blood_group || 'Not set'}</p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionApprove} onClick={() => void updatePatientStatus(row.uid, 'verified')}>
                        Verify
                      </button>
                      <button type="button" className={styles.actionWarning} onClick={() => void updatePatientStatus(row.uid, 'pending')}>
                        Mark Pending
                      </button>
                      <button type="button" className={styles.actionDeny} onClick={() => void updatePatientStatus(row.uid, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'doctorDatabase' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Doctor Database</h2>
                <div className={styles.searchWrap}>
                  <Building2 size={14} />
                  <input
                    placeholder="Search doctor database"
                    value={doctorSearch}
                    onChange={(event) => setDoctorSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Hospital</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((row) => (
                      <tr key={row.uid}>
                        <td>{row.doctor_name || row.uid}</td>
                        <td>{row.doctor_email}</td>
                        <td>{row.hospital_id || '-'}</td>
                        <td>{row.approval_status}</td>
                        <td>{formatDateTime(row.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === 'patientDatabase' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Patient Database</h2>
                <div className={styles.searchWrap}>
                  <UsersRound size={14} />
                  <input
                    placeholder="Search patient database"
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Identifier</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((row) => (
                      <tr key={row.uid}>
                        <td>{row.patient_name || row.uid}</td>
                        <td>{row.identifier}</td>
                        <td>{row.email}</td>
                        <td>{row.verification_status}</td>
                        <td>{formatDateTime(row.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === 'inbox' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Reports / Help / Contact Inbox</h2>
                <div className={styles.searchWrap}>
                  <MailQuestion size={14} />
                  <input
                    placeholder="Search subject, message, actor, hospital, status"
                    value={inboxSearch}
                    onChange={(event) => setInboxSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.filterRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${inboxCategoryFilter === 'all' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setInboxCategoryFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${inboxCategoryFilter === 'help' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setInboxCategoryFilter('help')}
                >
                  Help
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${inboxCategoryFilter === 'report' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setInboxCategoryFilter('report')}
                >
                  Report
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${inboxCategoryFilter === 'contact' ? styles.filterChipActive : ''}`.trim()}
                  onClick={() => setInboxCategoryFilter('contact')}
                >
                  Contact
                </button>
              </div>
              <div className={styles.records}>
                {filteredInbox.map((row) => (
                  <article className={styles.recordCard} key={row.id}>
                    <div className={styles.recordHeader}>
                      <p className={styles.itemTitle}>{row.subject}</p>
                      <span
                        className={`${styles.statusPill} ${
                          row.status === 'resolved'
                            ? styles.statusSuccess
                            : row.status === 'in_progress'
                              ? styles.statusInfo
                              : styles.statusWarning
                        }`.trim()}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className={styles.itemMeta}>
                      {row.actor_role.toUpperCase()} | {row.actor_name || row.actor_uid} | {row.actor_email}
                    </p>
                    <p className={styles.itemMeta}>
                      {row.hospital_id ? `Hospital: ${row.hospital_id}` : 'General request'} | {row.category}
                    </p>
                    <p className={styles.message}>{row.message}</p>
                    <p className={styles.itemMeta}>Created: {formatDateTime(row.created_at)}</p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionWarning} onClick={() => void updateInboxStatus(row.id, 'open')}>
                        Mark Open
                      </button>
                      <button type="button" className={styles.actionInfo} onClick={() => void updateInboxStatus(row.id, 'in_progress')}>
                        In Progress
                      </button>
                      <button type="button" className={styles.actionApprove} onClick={() => void updateInboxStatus(row.id, 'resolved')}>
                        Resolve
                      </button>
                    </div>
                  </article>
                ))}
                {filteredInbox.length === 0 ? <p className={styles.empty}>No inbox messages found.</p> : null}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
