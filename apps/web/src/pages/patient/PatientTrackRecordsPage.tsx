import { useMemo, useState } from 'react';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { resolveStoredDocumentPreview } from '../../utils/base64';
import type { Visit } from '../../types';
import { usePatientWorkspaceData } from './usePatientWorkspaceData';
import styles from './PatientTrackRecordsPage.module.css';

function visitTone(
  status: Visit['treatment_status'],
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'completed' || status === 'one_time_complete') {
    return 'success';
  }
  if (status === 'critical') {
    return 'danger';
  }
  if (status === 'active') {
    return 'warning';
  }
  if (status === 'improving') {
    return 'info';
  }
  return 'neutral';
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

export function PatientTrackRecordsPage() {
  const { data, loading, refreshing } = usePatientWorkspaceData();
  const visits = data?.visits ?? [];
  const [doctorRecordSearch, setDoctorRecordSearch] = useState('');
  const [expandedVisits, setExpandedVisits] = useState<Record<string, boolean>>({});
  const [expandedVisitReports, setExpandedVisitReports] = useState<Record<string, boolean>>({});
  const normalizedDoctorSearch = doctorRecordSearch.trim().toLowerCase();

  const filteredVisits = useMemo(() => {
    if (!normalizedDoctorSearch) {
      return visits;
    }

    return visits.filter((visit) => {
      const searchableValues = [
        visit.doctor_name ?? '',
        visit.doctor_uid,
        visit.doctor_phone ?? '',
        visit.hospital_id,
        visit.patient_identifier,
        visit.diagnosis,
        visit.prescription,
        visit.treatment_status,
      ];

      return searchableValues.some((item) => item.toLowerCase().includes(normalizedDoctorSearch));
    });
  }, [visits, normalizedDoctorSearch]);

  function toggleVisit(visitId: string): void {
    setExpandedVisits((previous) => ({
      ...previous,
      [visitId]: !previous[visitId],
    }));
  }

  function toggleVisitReports(visitId: string): void {
    setExpandedVisitReports((previous) => ({
      ...previous,
      [visitId]: !previous[visitId],
    }));
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <DashboardPanel title="Track Records" subtitle="Loading records...">
          <p className={styles.empty}>Loading track records...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.recordsPanel}
        title="Track Records"
        subtitle="Whole-page record explorer for visits, doctor details, and reports."
        actions={<StatusPill label={refreshing ? 'syncing live data...' : 'live data synced'} tone={refreshing ? 'info' : 'success'} />}
      >
        <input
          className={styles.searchInput}
          placeholder="Search by doctor name, UID, hospital, diagnosis, treatment status"
          value={doctorRecordSearch}
          onChange={(event) => setDoctorRecordSearch(event.target.value)}
        />
        {visits.length === 0 ? <p className={styles.empty}>No visits yet.</p> : null}
        {visits.length > 0 && filteredVisits.length === 0 ? (
          <p className={styles.empty}>No track records match your search.</p>
        ) : null}
        <div className={styles.list}>
          {filteredVisits.map((visit) => {
            const reportPreviews = visit.reports_base64
              .map((item, index) => ({
                index,
                ...resolveStoredDocumentPreview(item),
              }))
              .filter((item) => Boolean(item.src));

            return (
              <article className={styles.compactCard} key={visit.id}>
                <button
                  className={styles.cardHeaderButton}
                  type="button"
                  onClick={() => toggleVisit(visit.id)}
                  aria-expanded={Boolean(expandedVisits[visit.id])}
                >
                  <div className={styles.cardHeaderLeft}>
                    <p className={styles.itemTitle}>{visit.diagnosis || 'Diagnosis pending'}</p>
                    <p className={styles.itemMeta}>
                      {visit.doctor_name || visit.doctor_uid} | {formatDateTime(visit.created_at)}
                    </p>
                  </div>
                  <div className={styles.cardHeaderRight}>
                    <StatusPill label={visit.treatment_status} tone={visitTone(visit.treatment_status)} />
                    <span className={styles.expandLabel}>{expandedVisits[visit.id] ? 'Hide' : 'View'}</span>
                  </div>
                </button>

                {expandedVisits[visit.id] ? (
                  <div className={styles.cardBody}>
                    <p className={styles.itemLine}>Doctor: {visit.doctor_name || visit.doctor_uid}</p>
                    <p className={styles.itemLine}>Doctor Contact: {visit.doctor_phone || 'Not provided'}</p>
                    <p className={styles.itemLine}>Hospital: {visit.hospital_id}</p>
                    <p className={styles.itemLine}>Prescription: {visit.prescription || 'N/A'}</p>
                    <p className={styles.itemLine}>Reports Attached: {visit.reports_base64.length}</p>
                    {reportPreviews.length > 0 ? (
                      <div className={styles.fileActions}>
                        <button
                          className={styles.buttonGhost}
                          type="button"
                          onClick={() => toggleVisitReports(visit.id)}
                        >
                          {expandedVisitReports[visit.id] ? 'Hide Reports' : 'View Reports'}
                        </button>
                      </div>
                    ) : null}
                    {expandedVisitReports[visit.id] && reportPreviews.length > 0 ? (
                      <div className={styles.reportGrid}>
                        {reportPreviews.map((report) => (
                          <article className={styles.reportCard} key={`${visit.id}-${report.index}`}>
                            {report.kind === 'image' ? (
                              <img
                                className={styles.reportImage}
                                src={report.src}
                                alt={`Visit report ${report.index + 1}`}
                              />
                            ) : report.kind === 'pdf' ? (
                              <object
                                className={styles.reportFrame}
                                data={report.src}
                                type="application/pdf"
                                aria-label={`Visit report PDF ${report.index + 1}`}
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
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </DashboardPanel>
    </section>
  );
}
