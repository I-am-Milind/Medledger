import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { MediaIconButton, MediaViewerModal } from '../../components/media';
import type { PatientProfile, Visit } from '../../types';
import { resolveStoredDocumentPreview } from '../../utils/base64';
import styles from './DoctorLookupPage.module.css';

type SortMode = 'time_desc' | 'time_asc' | 'diagnosis_asc' | 'diagnosis_desc';
type HospitalFilterMode = 'all' | string;
type PreviewModalState = {
  src: string;
  kind: 'image' | 'pdf' | 'other';
  title: string;
};

function toneFromStatus(status: Visit['treatment_status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'completed' || status === 'one_time_complete') return 'success';
  if (status === 'critical') return 'danger';
  if (status === 'active') return 'warning';
  if (status === 'improving') return 'info';
  return 'neutral';
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
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

function reportTypeLabel(kind: 'image' | 'pdf' | 'other'): string {
  if (kind === 'image') return 'Image';
  if (kind === 'pdf') return 'PDF';
  return 'File';
}

function resolveVisitAttachments(visit: Visit): {
  prescription: string;
  clinicalReports: string[];
} {
  const explicitPrescription = visit.paper_prescription_image_base64?.trim() ?? '';
  const explicitClinical = (visit.clinical_reports_base64 ?? []).filter((item) => item.trim().length > 0);
  if (explicitPrescription || explicitClinical.length > 0) {
    return {
      prescription: explicitPrescription,
      clinicalReports: explicitClinical,
    };
  }

  const fallback = (visit.reports_base64 ?? []).filter((item) => item.trim().length > 0);
  return {
    prescription: fallback[0] ?? '',
    clinicalReports: fallback.slice(1),
  };
}

function parsePrescriptionContent(raw: string): {
  prescriptionForLine: string;
  notes: string;
  vitalsLine: string;
} {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const prescriptionForLine =
    lines.find((line) => line.toLowerCase().startsWith('prescription for:')) ?? '';
  const vitalsLine = lines.find((line) => line.toLowerCase().startsWith('vitals snapshot')) ?? '';
  const noteLines = lines.filter((line) => line !== prescriptionForLine && line !== vitalsLine);

  return {
    prescriptionForLine,
    notes: noteLines.join('\n'),
    vitalsLine,
  };
}

export function DoctorLookupPage() {
  const { identifier = '' } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('time_desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState<HospitalFilterMode>('all');
  const [expandedVisits, setExpandedVisits] = useState<Record<string, boolean>>({});
  const [expandedHospitals, setExpandedHospitals] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

  useEffect(() => {
    if (!identifier) {
      return;
    }

    setLoading(true);
    setError('');
    void doctorApi
      .lookupPatient(identifier)
      .then((result) => {
        setPatient(result.patient);
        setVisits(result.visits);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Lookup failed');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [identifier]);

  const filteredVisits = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    const filtered = visits.filter((visit) => {
      const values = [
        visit.treatment_status,
        visit.diagnosis,
        visit.prescription,
        visit.doctor_name ?? '',
        visit.doctor_phone ?? '',
        visit.doctor_uid,
        visit.hospital_id,
        visit.created_at,
        visit.updated_at,
      ];
      const matchesSearch = normalized ? values.some((value) => value.toLowerCase().includes(normalized)) : true;
      if (!matchesSearch) return false;
      if (hospitalFilter !== 'all' && visit.hospital_id !== hospitalFilter) return false;

      const createdMs = new Date(visit.created_at).getTime();
      if (Number.isNaN(createdMs)) return false;
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      return true;
    });

    filtered.sort((left, right) => {
      if (sortMode === 'time_asc') {
        return left.created_at.localeCompare(right.created_at);
      }
      if (sortMode === 'diagnosis_asc') {
        return left.diagnosis.toLowerCase().localeCompare(right.diagnosis.toLowerCase());
      }
      if (sortMode === 'diagnosis_desc') {
        return right.diagnosis.toLowerCase().localeCompare(left.diagnosis.toLowerCase());
      }
      return right.created_at.localeCompare(left.created_at);
    });

    return filtered;
  }, [dateFrom, dateTo, hospitalFilter, searchTerm, sortMode, visits]);

  const uniqueHospitals = useMemo(() => {
    return [...new Set(visits.map((visit) => visit.hospital_id).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [visits]);

  const hospitalSummary = useMemo(() => {
    const grouped = new Map<string, { hospital_id: string; visit_count: number; latest_visit: string }>();
    visits.forEach((visit) => {
      const previous = grouped.get(visit.hospital_id);
      if (!previous) {
        grouped.set(visit.hospital_id, {
          hospital_id: visit.hospital_id,
          visit_count: 1,
          latest_visit: visit.created_at,
        });
        return;
      }
      grouped.set(visit.hospital_id, {
        hospital_id: previous.hospital_id,
        visit_count: previous.visit_count + 1,
        latest_visit:
          previous.latest_visit.localeCompare(visit.created_at) >= 0
            ? previous.latest_visit
            : visit.created_at,
      });
    });
    return [...grouped.values()].sort((a, b) => b.latest_visit.localeCompare(a.latest_visit));
  }, [visits]);

  const timelineSummary = useMemo(() => {
    return {
      total: visits.length,
      active: visits.filter(
        (visit) => visit.treatment_status !== 'completed' && visit.treatment_status !== 'one_time_complete',
      ).length,
      completed: visits.filter(
        (visit) => visit.treatment_status === 'completed' || visit.treatment_status === 'one_time_complete',
      ).length,
    };
  }, [visits]);

  const patientName = `${patient?.demographics.first_name ?? ''} ${patient?.demographics.last_name ?? ''}`
    .trim() || 'Not provided';
  const patientPhone = patient?.contact.phone || 'Not provided';

  const allergySummary = useMemo(() => {
    if (!patient?.allergies?.length) return 'No known allergies';
    return patient.allergies.join(', ');
  }, [patient?.allergies]);

  const hereditarySummary = useMemo(() => {
    const entries = patient?.hereditary_history ?? [];
    if (entries.length === 0) {
      return {
        conditionText: 'No hereditary illness recorded',
        detailsText: 'No hereditary records uploaded.',
      };
    }

    const uniqueConditions = [...new Set(entries.map((entry) => entry.condition.trim()).filter(Boolean))];
    const peopleCount = entries.reduce(
      (sum, entry) => sum + (typeof entry.affected_people_count === 'number' ? entry.affected_people_count : 0),
      0,
    );
    const conditionText = uniqueConditions.length
      ? uniqueConditions.slice(0, 4).join(', ')
      : 'Hereditary records available';
    const detailsText = `${entries.length} record(s)${peopleCount > 0 ? ` | Affected people: ${peopleCount}` : ''}`;

    return { conditionText, detailsText };
  }, [patient?.hereditary_history]);

  const ongoingTreatments = useMemo(
    () =>
      visits
        .filter(
          (visit) => visit.treatment_status !== 'completed' && visit.treatment_status !== 'one_time_complete',
        )
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [visits],
  );

  const ongoingSummary = useMemo(() => {
    if (ongoingTreatments.length === 0) {
      return {
        headline: 'No ongoing treatment',
        detail: 'All recorded treatments are completed.',
      };
    }
    const latest = ongoingTreatments[0];
    if (!latest) {
      return {
        headline: 'No ongoing treatment',
        detail: 'All recorded treatments are completed.',
      };
    }
    return {
      headline: `${ongoingTreatments.length} ongoing treatment(s)`,
      detail: `Latest: ${latest.diagnosis || 'General consultation'} (${formatDateTime(latest.created_at)})`,
    };
  }, [ongoingTreatments]);

  const groupedVisits = useMemo(() => {
    const grouped = new Map<string, Visit[]>();
    filteredVisits.forEach((visit) => {
      const hospitalId = visit.hospital_id?.trim() || 'Unknown Hospital';
      const current = grouped.get(hospitalId) ?? [];
      current.push(visit);
      grouped.set(hospitalId, current);
    });

    return [...grouped.entries()]
      .map(([hospitalId, hospitalVisits]) => {
        const latestVisit = [...hospitalVisits].sort((left, right) =>
          right.created_at.localeCompare(left.created_at),
        )[0];
        const activeCount = hospitalVisits.filter(
          (visit) =>
            visit.treatment_status !== 'completed' && visit.treatment_status !== 'one_time_complete',
        ).length;
        const completedCount = hospitalVisits.filter(
          (visit) =>
            visit.treatment_status === 'completed' || visit.treatment_status === 'one_time_complete',
        ).length;
        return {
          hospitalId,
          visits: hospitalVisits,
          latestVisit,
          activeCount,
          completedCount,
        };
      })
      .sort((left, right) => {
        const leftTime = left.latestVisit?.created_at ?? '';
        const rightTime = right.latestVisit?.created_at ?? '';
        return rightTime.localeCompare(leftTime);
      });
  }, [filteredVisits]);

  useEffect(() => {
    setExpandedHospitals((previous) => {
      const next: Record<string, boolean> = {};
      groupedVisits.forEach((group, index) => {
        next[group.hospitalId] = previous[group.hospitalId] ?? (hospitalFilter !== 'all' || index === 0);
      });
      return next;
    });
  }, [groupedVisits, hospitalFilter]);

  function toggleVisit(visitId: string): void {
    setExpandedVisits((previous) => ({
      ...previous,
      [visitId]: !previous[visitId],
    }));
  }

  function toggleHospital(hospitalId: string): void {
    setExpandedHospitals((previous) => ({
      ...previous,
      [hospitalId]: !previous[hospitalId],
    }));
  }

  async function handleExportExcel(): Promise<void> {
    if (!identifier) return;
    setExporting(true);
    setError('');
    try {
      const blob = await doctorApi.exportPatientExcel(identifier, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `medledger-${identifier}-${dateSuffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export patient Excel file');
    } finally {
      setExporting(false);
    }
  }

  function openPreview(
    preview: { src: string; kind: 'image' | 'pdf' | 'other' },
    title: string,
  ): void {
    setPreviewModal({
      src: preview.src,
      kind: preview.kind,
      title,
    });
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <DashboardPanel title="Patient Medical History" subtitle="Loading timeline records...">
          <p className={styles.empty}>Loading patient timeline...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.patientPanel}
        title="Patient Medical History"
        subtitle="Complete timeline across prescriptions, reports, and treatment status."
        actions={
          <div className={styles.patientActions}>
            <button className={styles.backButton} type="button" onClick={() => navigate(-1)}>
              Back
            </button>
            <button
              className={styles.exportButton}
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <StatusPill label={identifier} tone="info" />
          </div>
        }
      >
        <div className={styles.patientSummary}>
          <p className={styles.name}>{patientName}</p>
          <p className={styles.metaLine}>Identifier: {identifier}</p>
          <p className={styles.metaLine}>
            Date of Birth: {patient?.demographics.date_of_birth || 'Not provided'} | Gender:{' '}
            {patient?.demographics.gender || 'Not provided'}
          </p>
          <p className={styles.metaLine}>
            Contact: {patient?.contact.phone || 'Not provided'} | {patient?.contact.email || 'Not provided'}
          </p>
          <p className={styles.metaLine}>
            Blood Group: {patient?.blood_group || 'Not set'} | Allergies:{' '}
            {patient?.allergies.length ? patient.allergies.join(', ') : 'None'}
          </p>
          <div className={styles.clinicalGrid}>
            <article className={styles.clinicalCard}>
              <p className={styles.clinicalLabel}>Allergy Alerts</p>
              <p className={styles.clinicalValue}>{allergySummary}</p>
            </article>
            <article className={styles.clinicalCard}>
              <p className={styles.clinicalLabel}>Hereditary Illness</p>
              <p className={styles.clinicalValue}>{hereditarySummary.conditionText}</p>
              <p className={styles.clinicalMeta}>{hereditarySummary.detailsText}</p>
            </article>
            <article className={styles.clinicalCard}>
              <p className={styles.clinicalLabel}>Ongoing Treatment</p>
              <p className={styles.clinicalValue}>{ongoingSummary.headline}</p>
              <p className={styles.clinicalMeta}>{ongoingSummary.detail}</p>
            </article>
          </div>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </DashboardPanel>

      <DashboardPanel
        className={styles.timelinePanel}
        title="Patient Medical History"
        subtitle="Hospital-wise history view across all visits, treatments, and attachments."
      >
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Total Visits</p>
              <p className={styles.summaryValue}>{timelineSummary.total}</p>
            </article>
            <article className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Active Treatments</p>
              <p className={styles.summaryValue}>{timelineSummary.active}</p>
            </article>
            <article className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Completed</p>
              <p className={styles.summaryValue}>{timelineSummary.completed}</p>
            </article>
            <article className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Hospitals</p>
              <p className={styles.summaryValue}>{uniqueHospitals.length}</p>
            </article>
          </div>
          <label className={styles.searchLabel} htmlFor="doctor-lookup-filter">
            Timeline Search
          </label>
          <input
            id="doctor-lookup-filter"
            className={styles.searchInput}
            placeholder="Search illness/problem, prescription, doctor, hospital, status"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className={styles.filtersGrid}>
            <label className={styles.filterField}>
              Sort By
              <select
                className={styles.searchInput}
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="time_desc">Time (Newest)</option>
                <option value="time_asc">Time (Oldest)</option>
                <option value="diagnosis_asc">Illness (A-Z)</option>
                <option value="diagnosis_desc">Illness (Z-A)</option>
              </select>
            </label>
            <label className={styles.filterField}>
              Hospital
              <select
                className={styles.searchInput}
                value={hospitalFilter}
                onChange={(event) => setHospitalFilter(event.target.value)}
              >
                <option value="all">All hospitals</option>
                {uniqueHospitals.map((hospitalId) => (
                  <option key={hospitalId} value={hospitalId}>
                    {hospitalId}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterField}>
              Date From
              <input
                className={styles.searchInput}
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label className={styles.filterField}>
              Date To
              <input
                className={styles.searchInput}
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
          </div>
        {hospitalSummary.length > 0 ? (
          <section className={styles.hospitalSection}>
            <p className={styles.blockTitle}>Hospital Coverage</p>
          <div className={styles.hospitalList}>
            <button
              className={`${styles.hospitalItem} ${styles.hospitalItemAll} ${
                hospitalFilter === 'all' ? styles.hospitalItemActive : ''
              }`}
              key="all-hospitals"
              type="button"
              onClick={() => setHospitalFilter('all')}
            >
              <p className={styles.hospitalName}>All Hospitals</p>
              <p className={styles.hospitalMeta}>Hospitals: {hospitalSummary.length}</p>
              <p className={styles.hospitalMeta}>Total Visits: {visits.length}</p>
              <p className={styles.hospitalMeta}>
                {hospitalFilter === 'all' ? 'Showing all hospitals' : 'Tap to show all hospitals'}
              </p>
            </button>
            {hospitalSummary.map((hospital) => (
              <button
                className={`${styles.hospitalItem} ${
                  hospitalFilter === hospital.hospital_id ? styles.hospitalItemActive : ''
                }`}
                key={hospital.hospital_id}
                type="button"
                onClick={() =>
                  setHospitalFilter((previous) =>
                    previous === hospital.hospital_id ? 'all' : hospital.hospital_id,
                  )
                }
              >
                <p className={styles.hospitalName}>{hospital.hospital_id}</p>
                <p className={styles.hospitalMeta}>Visits: {hospital.visit_count}</p>
                <p className={styles.hospitalMeta}>Latest: {formatDateTime(hospital.latest_visit)}</p>
                <p className={styles.hospitalMeta}>
                  {hospitalFilter === hospital.hospital_id ? 'Showing this hospital only' : 'Tap to filter'}
                </p>
              </button>
            ))}
          </div>
          </section>
        ) : null}
        {groupedVisits.length === 0 ? <p className={styles.empty}>No medical records found.</p> : null}
        <div className={styles.hospitalHistoryList}>
          {groupedVisits.map((group, groupIndex) => {
            const isHospitalExpanded =
              hospitalFilter !== 'all' ? true : (expandedHospitals[group.hospitalId] ?? groupIndex === 0);
            return (
              <section
                className={`${styles.hospitalHistoryCard} ${
                  isHospitalExpanded ? styles.hospitalHistoryCardExpanded : ''
                }`}
                key={group.hospitalId}
              >
                <button
                  className={`${styles.hospitalHistoryHeader} ${
                    isHospitalExpanded ? styles.hospitalHistoryHeaderExpanded : ''
                  }`}
                  type="button"
                  onClick={() => toggleHospital(group.hospitalId)}
                  aria-expanded={isHospitalExpanded}
                >
                  <div className={styles.hospitalHistoryTitleWrap}>
                    <p className={styles.hospitalNameLabel}>Hospital</p>
                    <p className={styles.hospitalHistoryTitle}>
                      <span className={styles.hospitalNameBadge}>{group.hospitalId}</span>
                    </p>
                    <p className={styles.hospitalHistoryMeta}>
                      Visits: {group.visits.length} | Active: {group.activeCount} | Completed:{' '}
                      {group.completedCount}
                    </p>
                    <p className={styles.hospitalHistoryMeta}>
                      Latest record: {group.latestVisit ? formatDateTime(group.latestVisit.created_at) : 'N/A'}
                    </p>
                  </div>
                  <div className={styles.hospitalHistoryHeaderRight}>
                    <span className={styles.hospitalVisitsChip}>{group.visits.length} Records</span>
                    <span className={styles.hospitalExpandLabel}>
                      {isHospitalExpanded ? '−' : '+'}
                    </span>
                  </div>
                </button>

                {isHospitalExpanded ? (
                  <div className={styles.timelineList}>
                    {group.visits.map((visit) => {
            const isExpanded = Boolean(expandedVisits[visit.id]);
            const attachments = resolveVisitAttachments(visit);
            const prescriptionPreview = attachments.prescription
              ? resolveStoredDocumentPreview(attachments.prescription)
              : null;
            const parsedPrescription = parsePrescriptionContent(visit.prescription || '');
            const clinicalPreviews = attachments.clinicalReports.map((report, index) => ({
              index,
              ...resolveStoredDocumentPreview(report),
            }));
            return (
              <article className={styles.timelineItem} key={visit.id}>
                <button
                  className={styles.timelineHeader}
                  type="button"
                  onClick={() => toggleVisit(visit.id)}
                  aria-expanded={isExpanded}
                >
                  <div className={styles.timelineTitleWrap}>
                    <p className={styles.timelineTitle}>
                      Visit:
                      <span className={styles.visitDateTimeBadge}>{formatDateTime(visit.created_at)}</span>
                    </p>
                    <p className={styles.timelineMeta}>
                      Patient: {patientName} | Phone: {patientPhone}
                    </p>
                    <p className={styles.timelineMeta}>
                      Doctor: {visit.doctor_name || visit.doctor_uid} | Hospital: {visit.hospital_id}
                    </p>
                  </div>
                  <div className={styles.timelineHeaderRight}>
                    <StatusPill label={visit.treatment_status} tone={toneFromStatus(visit.treatment_status)} />
                    <span className={styles.expandLabel}>{isExpanded ? 'Hide' : 'View'}</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className={styles.timelineBody}>
                    <div className={styles.detailGrid}>
                    <p className={styles.bodyLine}>
                      <strong>Illness / Sickness / Problem:</strong> {visit.diagnosis || 'Not provided'}
                    </p>
                    <p className={styles.bodyLine}>
                      <strong>Treatment Status:</strong> {visit.treatment_status}
                    </p>
                    <p className={styles.bodyLine}>
                      <strong>Doctor Phone:</strong> {visit.doctor_phone || 'Not provided'}
                    </p>
                    <p className={styles.bodyLine}>
                      <strong>Hospital:</strong> {visit.hospital_id}
                    </p>
                    <p className={styles.bodyLine}>
                      <strong>Updated:</strong> {formatDateTime(visit.updated_at)}
                    </p>
                    </div>
                    <div className={styles.prescriptionBlock}>
                      <p className={styles.blockTitle}>Prescription Summary</p>
                      {parsedPrescription.prescriptionForLine ? (
                        <p className={styles.prescriptionMeta}>{parsedPrescription.prescriptionForLine}</p>
                      ) : null}
                      <p className={styles.prescriptionText}>
                        {parsedPrescription.notes || 'No prescription note.'}
                      </p>
                      {parsedPrescription.vitalsLine ? (
                        <p className={styles.vitalsLine}>{parsedPrescription.vitalsLine}</p>
                      ) : null}
                    </div>

                    <div className={styles.reportBlock}>
                      <p className={styles.blockTitle}>Attachments</p>
                      <div className={styles.attachmentList}>
                        {prescriptionPreview ? (
                          <article className={styles.attachmentRow}>
                            <p className={styles.attachmentIcon} aria-hidden="true">
                              {prescriptionPreview.kind === 'pdf' ? 'PDF' : prescriptionPreview.kind === 'image' ? 'IMG' : 'FILE'}
                            </p>
                            <div className={styles.attachmentInfo}>
                              <p className={styles.attachmentName}>Paper Prescription</p>
                              <p className={styles.attachmentMeta}>{reportTypeLabel(prescriptionPreview.kind)}</p>
                            </div>
                            <MediaIconButton
                              type="view"
                              label="View paper prescription in full screen"
                              onClick={() =>
                                openPreview(
                                  prescriptionPreview,
                                  `Paper Prescription | ${formatDateTime(visit.created_at)}`,
                                )
                              }
                            />
                          </article>
                        ) : null}

                        {clinicalPreviews.map((preview) => (
                          <article className={styles.attachmentRow} key={`${visit.id}-${preview.index}`}>
                            <p className={styles.attachmentIcon} aria-hidden="true">
                              {preview.kind === 'pdf' ? 'PDF' : preview.kind === 'image' ? 'IMG' : 'FILE'}
                            </p>
                            <div className={styles.attachmentInfo}>
                              <p className={styles.attachmentName}>Clinical Report #{preview.index + 1}</p>
                              <p className={styles.attachmentMeta}>{reportTypeLabel(preview.kind)}</p>
                            </div>
                            <MediaIconButton
                              type="view"
                              label={`View clinical report ${preview.index + 1} in full screen`}
                              onClick={() =>
                                openPreview(
                                  preview,
                                  `Clinical Report #${preview.index + 1} | ${formatDateTime(visit.created_at)}`,
                                )
                              }
                            />
                          </article>
                        ))}
                        {!prescriptionPreview && clinicalPreviews.length === 0 ? (
                          <p className={styles.empty}>No attachments for this visit.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </DashboardPanel>

      <MediaViewerModal
        isOpen={Boolean(previewModal)}
        title={previewModal?.title ?? 'Attachment preview'}
        src={previewModal?.src ?? ''}
        kind={previewModal?.kind ?? 'other'}
        onClose={() => setPreviewModal(null)}
      />
    </section>
  );
}
