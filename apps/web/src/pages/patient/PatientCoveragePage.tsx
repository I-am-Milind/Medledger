import { useMemo, useState } from 'react';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import type { AccessRequest } from '../../types';
import { usePatientWorkspaceData } from './usePatientWorkspaceData';
import styles from './PatientCoveragePage.module.css';

type HospitalCoverageDetail = {
  hospitalId: string;
  doctorNames: string[];
  doctorPhones: string[];
  requestEvents: AccessRequest[];
  visitCount: number;
  logoBase64: string;
};

function accessTone(status: AccessRequest['status']): 'success' | 'warning' | 'danger' {
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

function resolveImageSource(value: string): string {
  if (!value) {
    return '';
  }
  if (value.startsWith('data:')) {
    return value;
  }
  return `data:image/png;base64,${value}`;
}

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

function IconApprove() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm4.28 6.78a1 1 0 0 0-1.41-1.41L10.5 11.73L9.13 10.36a1 1 0 0 0-1.41 1.42l2.08 2.07a1 1 0 0 0 1.41 0l5.07-5.07Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconDeny() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm4.7 6.7a1 1 0 0 0-1.4 0L12 12l-3.3-3.3a1 1 0 0 0-1.4 1.4L10.6 13.4l-3.3 3.3a1 1 0 1 0 1.4 1.4L12 14.8l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3 3.3-3.3a1 1 0 0 0 0-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconRestore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4a8 8 0 1 1-7.75 10h2.1A6 6 0 1 0 12 6c-2.03 0-3.82 1-4.91 2.53H10a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1v-6a1 1 0 1 1 2 0v2.59A9.94 9.94 0 0 1 12 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PatientCoveragePage() {
  const { data, loading, refreshing, error, decideAccessRequest } = usePatientWorkspaceData();
  const [approvalPromptRequest, setApprovalPromptRequest] = useState<AccessRequest | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [hideApprovalPrompt, setHideApprovalPrompt] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('medledger_hide_access_approve_prompt') === '1';
  });
  const [dontShowApprovalPromptAgain, setDontShowApprovalPromptAgain] = useState(false);
  const [coverageSearchTerm, setCoverageSearchTerm] = useState('');
  const [accessSearchTerm, setAccessSearchTerm] = useState('');
  const [expandedHospitals, setExpandedHospitals] = useState<Record<string, boolean>>({});
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const accessRequests = data?.accessRequests ?? [];
  const visits = data?.visits ?? [];
  const normalizedCoverageSearch = coverageSearchTerm.trim().toLowerCase();
  const normalizedAccessSearch = accessSearchTerm.trim().toLowerCase();

  const hospitalCoverage = useMemo<HospitalCoverageDetail[]>(() => {
    const coverageMap = new Map<string, {
      hospitalId: string;
      doctorNames: Set<string>;
      doctorPhones: Set<string>;
      requestEvents: AccessRequest[];
      visitCount: number;
      logoBase64: string;
    }>();

    const getCoverage = (hospitalId: string) => {
      const normalizedHospitalId = hospitalId.trim();
      if (!normalizedHospitalId) {
        return null;
      }
      const existing = coverageMap.get(normalizedHospitalId);
      if (existing) {
        return existing;
      }
      const created = {
        hospitalId: normalizedHospitalId,
        doctorNames: new Set<string>(),
        doctorPhones: new Set<string>(),
        requestEvents: [] as AccessRequest[],
        visitCount: 0,
        logoBase64: '',
      };
      coverageMap.set(normalizedHospitalId, created);
      return created;
    };

    accessRequests.forEach((request) => {
      const coverage = getCoverage(request.doctor_hospital_id);
      if (!coverage) {
        return;
      }
      coverage.requestEvents.push(request);
      if (request.doctor_name?.trim()) {
        coverage.doctorNames.add(request.doctor_name.trim());
      }
      if (request.doctor_phone?.trim()) {
        coverage.doctorPhones.add(request.doctor_phone.trim());
      }
      if (!coverage.logoBase64 && request.hospital_logo_base64?.trim()) {
        coverage.logoBase64 = request.hospital_logo_base64.trim();
      }
    });

    visits.forEach((visit) => {
      const coverage = getCoverage(visit.hospital_id);
      if (!coverage) {
        return;
      }
      coverage.visitCount += 1;
      if (visit.doctor_name?.trim()) {
        coverage.doctorNames.add(visit.doctor_name.trim());
      }
      if (visit.doctor_phone?.trim()) {
        coverage.doctorPhones.add(visit.doctor_phone.trim());
      }
      if (!coverage.logoBase64 && visit.hospital_logo_base64?.trim()) {
        coverage.logoBase64 = visit.hospital_logo_base64.trim();
      }
    });

    return [...coverageMap.values()]
      .map((item) => ({
        hospitalId: item.hospitalId,
        doctorNames: [...item.doctorNames],
        doctorPhones: [...item.doctorPhones],
        requestEvents: [...item.requestEvents].sort((left, right) =>
          right.created_at.localeCompare(left.created_at),
        ),
        visitCount: item.visitCount,
        logoBase64: item.logoBase64,
      }))
      .sort((left, right) => right.visitCount - left.visitCount);
  }, [accessRequests, visits]);

  const filteredHospitalCoverage = useMemo(() => {
    if (!normalizedCoverageSearch) {
      return hospitalCoverage;
    }

    return hospitalCoverage.filter((item) => {
      const values = [
        item.hospitalId,
        item.doctorNames.join(' '),
        item.doctorPhones.join(' '),
        String(item.visitCount),
        String(item.requestEvents.length),
      ];
      return values.some((value) => value.toLowerCase().includes(normalizedCoverageSearch));
    });
  }, [hospitalCoverage, normalizedCoverageSearch]);

  const filteredAccessRequests = useMemo(() => {
    if (!normalizedAccessSearch) {
      return accessRequests;
    }
    return accessRequests.filter((item) => {
      const values = [
        item.patient_identifier,
        item.doctor_name ?? '',
        item.doctor_uid,
        item.doctor_phone ?? '',
        item.doctor_hospital_id,
        item.reason,
        item.status,
      ];
      return values.some((value) => value.toLowerCase().includes(normalizedAccessSearch));
    });
  }, [accessRequests, normalizedAccessSearch]);

  const waitingRequests = accessRequests.filter((request) => request.status === 'waiting').length;

  function toggleHospital(hospitalId: string): void {
    setExpandedHospitals((previous) => ({
      ...previous,
      [hospitalId]: !previous[hospitalId],
    }));
  }

  function toggleRequest(requestId: string): void {
    setExpandedRequests((previous) => ({
      ...previous,
      [requestId]: !previous[requestId],
    }));
  }

  function requestApproval(request: AccessRequest): void {
    if (hideApprovalPrompt) {
      void decideAccessRequest(request.id, 'approved');
      return;
    }

    setDontShowApprovalPromptAgain(false);
    setApprovalPromptRequest(request);
  }

  async function confirmApproval(): Promise<void> {
    if (!approvalPromptRequest) {
      return;
    }

    setApprovalBusy(true);
    try {
      if (dontShowApprovalPromptAgain) {
        window.localStorage.setItem('medledger_hide_access_approve_prompt', '1');
        setHideApprovalPrompt(true);
      }

      await decideAccessRequest(approvalPromptRequest.id, 'approved');
      setApprovalPromptRequest(null);
    } finally {
      setApprovalBusy(false);
    }
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <DashboardPanel title="Doctor Coverage" subtitle="Loading coverage workspace...">
          <p className={styles.empty}>Loading data...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.columns}>
        <DashboardPanel
          className={styles.panel}
          title="Doctor Coverage"
          subtitle="Hospitals and doctors currently connected to your record."
          actions={
            <StatusPill
              label={refreshing ? 'Syncing' : 'Live Synced'}
              tone={refreshing ? 'info' : 'success'}
            />
          }
        >
          <label className={styles.searchLabel} htmlFor="coverage-search">
            Coverage Search
          </label>
          <div className={styles.searchField}>
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              id="coverage-search"
              className={styles.searchInput}
              placeholder="Search hospital, doctor, contact, total visits"
              value={coverageSearchTerm}
              onChange={(event) => setCoverageSearchTerm(event.target.value)}
            />
          </div>
          <p className={styles.summaryLine}>Hospitals Found: {filteredHospitalCoverage.length}</p>

          {filteredHospitalCoverage.length === 0 ? (
            <p className={styles.empty}>No hospital coverage found for this search.</p>
          ) : null}

          <div className={styles.list}>
            {filteredHospitalCoverage.map((hospital) => (
              <article className={styles.compactCard} key={hospital.hospitalId}>
                <button
                  className={styles.cardHeaderButton}
                  type="button"
                  onClick={() => toggleHospital(hospital.hospitalId)}
                  aria-expanded={Boolean(expandedHospitals[hospital.hospitalId])}
                >
                  <div className={styles.cardHeaderLeft}>
                    {hospital.logoBase64 ? (
                      <img
                        className={styles.hospitalLogo}
                        src={resolveImageSource(hospital.logoBase64)}
                        alt={`${hospital.hospitalId} logo`}
                      />
                    ) : (
                      <div className={styles.hospitalLogoPlaceholder} aria-hidden="true">
                        H
                      </div>
                    )}
                    <div>
                      <p className={styles.itemTitle}>{hospital.hospitalId}</p>
                      <p className={styles.itemMeta}>
                        Visits: {hospital.visitCount} | Requests: {hospital.requestEvents.length}
                      </p>
                    </div>
                  </div>
                  <span className={styles.expandLabel}>
                    {expandedHospitals[hospital.hospitalId] ? 'Hide' : 'View'}
                  </span>
                </button>

                {expandedHospitals[hospital.hospitalId] ? (
                  <div className={styles.cardBody}>
                    <p className={styles.itemLine}>
                      Doctors: {hospital.doctorNames.length > 0 ? hospital.doctorNames.join(', ') : 'Not available'}
                    </p>
                    <p className={styles.itemLine}>
                      Doctor Contacts:{' '}
                      {hospital.doctorPhones.length > 0 ? hospital.doctorPhones.join(', ') : 'Not available'}
                    </p>
                    <div className={styles.requestTimeline}>
                      <p className={styles.requestTimelineTitle}>Request Timeline</p>
                      {hospital.requestEvents.length === 0 ? (
                        <p className={styles.itemLine}>No access requests found.</p>
                      ) : (
                        <ul className={styles.requestTimelineList}>
                          {hospital.requestEvents.map((request) => (
                            <li className={styles.requestTimelineItem} key={request.id}>
                              <span>{formatDateTime(request.created_at)}</span>
                              <span>
                                {request.doctor_name || request.doctor_uid} ({request.status})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel className={styles.panel} title="Doctor Access Data" subtitle="Approve or deny active doctor access requests.">
          <label className={styles.searchLabel} htmlFor="access-search">
            Access Search
          </label>
          <div className={styles.searchField}>
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              id="access-search"
              className={styles.searchInput}
              placeholder="Search request ID, doctor, hospital, status, reason"
              value={accessSearchTerm}
              onChange={(event) => setAccessSearchTerm(event.target.value)}
            />
          </div>
          <div className={styles.summaryRow}>
            <p className={styles.summaryLine}>Waiting Requests: {waitingRequests}</p>
            <p className={styles.summarySubLine}>Total Requests: {filteredAccessRequests.length}</p>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {filteredAccessRequests.length === 0 ? <p className={styles.empty}>No access requests.</p> : null}

          <div className={styles.list}>
            {filteredAccessRequests.map((item) => (
              <article className={styles.compactCard} key={item.id}>
                <button
                  className={styles.cardHeaderButton}
                  type="button"
                  onClick={() => toggleRequest(item.id)}
                  aria-expanded={Boolean(expandedRequests[item.id])}
                >
                  <div className={styles.cardHeaderLeft}>
                    <div>
                      <p className={styles.itemTitle}>{item.patient_identifier}</p>
                      <p className={styles.itemMeta}>
                        {item.doctor_name || item.doctor_uid} | {item.doctor_hospital_id}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardHeaderRight}>
                    <StatusPill label={item.status} tone={accessTone(item.status)} />
                    <span className={styles.expandLabel}>{expandedRequests[item.id] ? 'Hide' : 'View'}</span>
                  </div>
                </button>

                {expandedRequests[item.id] ? (
                  <div className={styles.cardBody}>
                    <p className={styles.itemLine}>Doctor: {item.doctor_name || item.doctor_uid}</p>
                    <p className={styles.itemLine}>Contact: {item.doctor_phone || 'Not provided'}</p>
                    <p className={styles.itemLine}>Hospital: {item.doctor_hospital_id}</p>
                    <p className={styles.itemLine}>Requested at: {formatDateTime(item.created_at)}</p>
                    <p className={styles.itemLine}>Reason: {item.reason}</p>
                    <div className={styles.actions}>
                      {item.status === 'waiting' ? (
                        <>
                          <button
                            className={styles.button}
                            type="button"
                            onClick={() => {
                              requestApproval(item);
                            }}
                          >
                            <span className={styles.icon} aria-hidden="true">
                              <IconApprove />
                            </span>
                            Approve
                          </button>
                          <button
                            className={styles.buttonDanger}
                            type="button"
                            onClick={() => {
                              void decideAccessRequest(item.id, 'denied');
                            }}
                          >
                            <span className={styles.icon} aria-hidden="true">
                              <IconDeny />
                            </span>
                            Deny
                          </button>
                        </>
                      ) : null}
                      {item.status === 'approved' ? (
                        <button
                          className={styles.buttonDanger}
                          type="button"
                          onClick={() => {
                            void decideAccessRequest(item.id, 'denied');
                          }}
                        >
                          <span className={styles.icon} aria-hidden="true">
                            <IconDeny />
                          </span>
                          Stop Access
                        </button>
                      ) : null}
                      {item.status === 'denied' ? (
                        <button
                          className={styles.buttonRestore}
                          type="button"
                          onClick={() => {
                            requestApproval(item);
                          }}
                        >
                          <span className={styles.icon} aria-hidden="true">
                            <IconRestore />
                          </span>
                          Re-give Access
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </DashboardPanel>
      </div>

      {approvalPromptRequest ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setApprovalPromptRequest(null)}>
          <article
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Approve doctor access warning"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Before You Approve Access</h3>
            <p className={styles.modalText}>
              Doctor <strong>{approvalPromptRequest.doctor_name || approvalPromptRequest.doctor_uid}</strong> from{' '}
              <strong>{approvalPromptRequest.doctor_hospital_id}</strong> will be able to:
            </p>
            <ul className={styles.modalList}>
              <li>View your patient profile and treatment context for care continuity.</li>
              <li>Add visit records, prescriptions, and reports to your timeline.</li>
              <li>Use your approved identifier for secure lookup in this hospital workflow.</li>
            </ul>
            <label className={styles.modalCheckbox}>
              <input
                type="checkbox"
                checked={dontShowApprovalPromptAgain}
                onChange={(event) => setDontShowApprovalPromptAgain(event.target.checked)}
              />
              Don't show this warning again
            </label>
            <div className={styles.actions}>
              <button
                className={styles.buttonDanger}
                type="button"
                onClick={() => setApprovalPromptRequest(null)}
                disabled={approvalBusy}
              >
                Cancel
              </button>
              <button
                className={styles.button}
                type="button"
                onClick={() => void confirmApproval()}
                disabled={approvalBusy}
              >
                {approvalBusy ? 'Approving...' : 'Continue and Approve'}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
