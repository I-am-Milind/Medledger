import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { MediaIconButton, MediaViewerModal } from '../../components/media';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import type { PatientProfile, Visit } from '../../types';
import { resolveStoredDocumentPreview } from '../../utils/base64';
import { loadCachedResource, readCachedResource } from '../../utils/resourceCache';
import styles from './DoctorVisitedPatientsPage.module.css';

type VisitedPatientSummary = {
  patient_uid: string;
  patient_identifier: string;
  patient_name: string;
  visit_count: number;
  latest_visit_at: string;
  latest_treatment_status: Visit['treatment_status'];
  latest_diagnosis: string;
  latest_hospital_id: string;
  hospital_ids: string[];
};

type PatientLookupDetails = {
  patient: PatientProfile | null;
  visits: Visit[];
};

type DetailState = {
  loading: boolean;
  error: string;
  details: PatientLookupDetails | null;
};

type ReportPreview = {
  id: string;
  src: string;
  kind: 'image' | 'pdf' | 'other';
  visitId: string;
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

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

export function DoctorVisitedPatientsPage() {
  const { appUser } = useAuth();
  const visitedCacheKey = `doctor-visited-patients:${appUser?.uid ?? 'anonymous'}`;
  const [visitedPatients, setVisitedPatients] = useState<VisitedPatientSummary[]>(
    readCachedResource<VisitedPatientSummary[]>(visitedCacheKey) ?? [],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [detailsByIdentifier, setDetailsByIdentifier] = useState<Record<string, DetailState>>({});
  const [loading, setLoading] = useState(visitedPatients.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reportsModal, setReportsModal] = useState<{
    patientIdentifier: string;
    reports: ReportPreview[];
  } | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    src: string;
    kind: 'image' | 'pdf' | 'other';
    title: string;
  } | null>(null);
  const isDoctorApproved = appUser?.doctorApprovalStatus === 'approved';

  const loadVisitedPatients = useCallback(async (): Promise<void> => {
    if (!isDoctorApproved) {
      setVisitedPatients([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const hasCached = Boolean(readCachedResource<VisitedPatientSummary[]>(visitedCacheKey));
    if (!hasCached) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const nextPatients = await loadCachedResource(
        visitedCacheKey,
        async () => {
          const response = await doctorApi.listVisitedPatients();
          return response.patients;
        },
        { maxAgeMs: 15_000 },
      );
      setVisitedPatients(nextPatients);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visited patients.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDoctorApproved, visitedCacheKey]);

  useEffect(() => {
    void loadVisitedPatients();
  }, [loadVisitedPatients]);

  useLiveSyncRefresh(() => {
    void loadVisitedPatients();
  });

  const filteredVisitedPatients = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return visitedPatients;
    }

    return visitedPatients.filter((item) => {
      const values = [
        item.patient_identifier,
        item.patient_uid,
        item.patient_name,
        item.latest_hospital_id,
        item.latest_diagnosis,
        item.latest_treatment_status,
        item.hospital_ids.join(' '),
      ];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [searchTerm, visitedPatients]);

  async function loadLookup(identifier: string): Promise<void> {
    setDetailsByIdentifier((previous) => ({
      ...previous,
      [identifier]: {
        loading: true,
        error: '',
        details: previous[identifier]?.details ?? null,
      },
    }));

    try {
      const response = await doctorApi.lookupPatient(identifier);
      setDetailsByIdentifier((previous) => ({
        ...previous,
        [identifier]: {
          loading: false,
          error: '',
          details: {
            patient: response.patient,
            visits: response.visits,
          },
        },
      }));
    } catch (err) {
      setDetailsByIdentifier((previous) => ({
        ...previous,
        [identifier]: {
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load patient lookup.',
          details: previous[identifier]?.details ?? null,
        },
      }));
    }
  }

  function toggleCard(identifier: string): void {
    setExpandedCards((previous) => {
      const nextExpanded = !previous[identifier];
      if (nextExpanded && !detailsByIdentifier[identifier]) {
        void loadLookup(identifier);
      }

      return {
        ...previous,
        [identifier]: nextExpanded,
      };
    });
  }

  function openReportsModal(identifier: string): void {
    const detail = detailsByIdentifier[identifier]?.details;
    if (!detail || !appUser?.uid) {
      return;
    }

    const doctorScopedVisits = detail.visits.filter((visit) => visit.doctor_uid === appUser.uid);
    const previews: ReportPreview[] = doctorScopedVisits.flatMap((visit) =>
      visit.reports_base64.map((report, index) => {
        const preview = resolveStoredDocumentPreview(report);
        return {
          id: `${visit.id}-${index}`,
          src: preview.src,
          kind: preview.kind,
          visitId: visit.id,
        };
      }),
    );

    setReportsModal({
      patientIdentifier: identifier,
      reports: previews,
    });
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <DashboardPanel title="Visited Patients" subtitle="Loading visited patient records...">
          <p className={styles.empty}>Loading visited patients...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.panel}
        title="Visited Patients"
        subtitle={
          isDoctorApproved
            ? 'Patients with at least one visit created by you.'
            : 'Doctor approval is pending. Visited-patient timeline unlocks after approval.'
        }
        actions={<StatusPill label={refreshing ? 'syncing' : 'live synced'} tone={refreshing ? 'info' : 'success'} />}
      >
        {!isDoctorApproved ? (
          <p className={styles.error}>
            You can use Profile and Report / Help now. Clinical timeline pages activate after admin approval.
          </p>
        ) : null}
        <label className={styles.searchLabel} htmlFor="doctor-visited-search">
          Patient Track Search
        </label>
        <div className={styles.searchField}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            id="doctor-visited-search"
            className={styles.searchInput}
            placeholder="Search patient identifier, name, UID, hospital, diagnosis"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <p className={styles.summaryLine}>Visited Patients: {filteredVisitedPatients.length}</p>
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.list}>
          {filteredVisitedPatients.length === 0 ? <p className={styles.empty}>No visited patients found.</p> : null}
          {filteredVisitedPatients.map((item) => {
            const detailState = detailsByIdentifier[item.patient_identifier];
            const detailVisits = detailState?.details?.visits ?? [];
            const latestMyVisit = detailVisits
              .filter((visit) => visit.doctor_uid === appUser?.uid)
              .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];

            return (
              <article className={styles.compactCard} key={`${item.patient_identifier}-${item.patient_uid}`}>
                <button
                  className={styles.cardHeaderButton}
                  type="button"
                  onClick={() => toggleCard(item.patient_identifier)}
                  aria-expanded={Boolean(expandedCards[item.patient_identifier])}
                >
                  <div className={styles.cardHeaderLeft}>
                    <p className={styles.itemTitle}>{item.patient_identifier}</p>
                    <p className={styles.itemMeta}>
                      {item.patient_name} | Visits by you: {item.visit_count}
                    </p>
                  </div>
                  <span className={styles.expandLabel}>
                    {expandedCards[item.patient_identifier] ? 'Hide' : 'View'}
                  </span>
                </button>

                {expandedCards[item.patient_identifier] ? (
                  <div className={styles.cardBody}>
                    {detailState?.loading ? <p className={styles.itemLine}>Loading patient lookup...</p> : null}
                    {detailState?.error ? <p className={styles.error}>{detailState.error}</p> : null}
                    <p className={styles.itemLine}>Patient UID: {item.patient_uid}</p>
                    <p className={styles.itemLine}>Hospitals in your records: {item.hospital_ids.join(', ')}</p>
                    <p className={styles.itemLine}>Latest hospital: {item.latest_hospital_id}</p>
                    <p className={styles.itemLine}>Latest visit: {formatDateTime(item.latest_visit_at)}</p>
                    <p className={styles.itemLine}>Latest status: {item.latest_treatment_status}</p>
                    <p className={styles.itemLine}>
                      Quick Summary: {latestMyVisit?.diagnosis || item.latest_diagnosis || 'Not available'}
                    </p>
                    <div className={styles.actions}>
                      <Link className={styles.linkButton} to={`/doctor/lookup/${item.patient_identifier}`}>
                        Open Full Medical History
                      </Link>
                      <button
                        className={styles.buttonGhost}
                        type="button"
                        onClick={() => openReportsModal(item.patient_identifier)}
                      >
                        Quick Summary Reports
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </DashboardPanel>

      {reportsModal ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setReportsModal(null)}>
          <article
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Quick summary reports"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Quick Summary Reports</h3>
            <p className={styles.modalSubtitle}>{reportsModal.patientIdentifier}</p>

            {reportsModal.reports.length === 0 ? (
              <p className={styles.empty}>No reports created by you for this patient.</p>
            ) : (
              <div className={styles.reportGrid}>
                {reportsModal.reports.map((report) => (
                  <article className={styles.reportCard} key={report.id}>
                    {report.kind === 'image' ? (
                      <img className={styles.reportImage} src={report.src} alt={`Report ${report.id}`} />
                    ) : report.kind === 'pdf' ? (
                      <object
                        className={styles.reportFrame}
                        data={report.src}
                        type="application/pdf"
                        aria-label={`Report ${report.id}`}
                      >
                        <a href={report.src} target="_blank" rel="noreferrer">
                          Open PDF
                        </a>
                      </object>
                    ) : (
                      <a className={styles.reportLink} href={report.src} target="_blank" rel="noreferrer">
                        Open report
                      </a>
                    )}
                    <div className={styles.reportMetaRow}>
                      <p className={styles.reportMeta}>Visit: {report.visitId}</p>
                      <MediaIconButton
                        type="view"
                        label={`View report ${report.id}`}
                        onClick={() =>
                          setPreviewModal({
                            src: report.src,
                            kind: report.kind,
                            title: `Report ${report.id} | ${reportsModal.patientIdentifier}`,
                          })
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className={styles.actions}>
              <button className={styles.buttonDanger} type="button" onClick={() => setReportsModal(null)}>
                Cancel
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <MediaViewerModal
        isOpen={Boolean(previewModal)}
        title={previewModal?.title ?? 'Report preview'}
        src={previewModal?.src ?? ''}
        kind={previewModal?.kind ?? 'other'}
        onClose={() => setPreviewModal(null)}
      />
    </section>
  );
}
