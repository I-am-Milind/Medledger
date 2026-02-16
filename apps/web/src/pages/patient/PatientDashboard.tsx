import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { DashboardPanel, DashboardStat } from '../../components/dashboard';
import { useAuth } from '../../auth/AuthProvider';
import { usePatientWorkspaceData } from './usePatientWorkspaceData';
import styles from './PatientDashboard.module.css';

const qrCanvasId = 'patient-qr-canvas';

function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M8 3h8a5 5 0 0 1 5 5v8h-2V8a3 3 0 0 0-3-3H8V3Zm-5 8h2v5a3 3 0 0 0 3 3h5v2H8a5 5 0 0 1-5-5v-5Zm14.59-1L21 13.41l-1.41 1.41L16.17 11.4V18h-2v-6.6l-3.42 3.42L9.34 13.4L12.75 10l-3.4-3.4 1.41-1.42 3.4 3.42V2h2v6.6l3.43-3.43L21 6.59 17.59 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 3h10a1 1 0 0 1 1 1v3h1.5A3.5 3.5 0 0 1 23 10.5v4A3.5 3.5 0 0 1 19.5 18H18v3a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-3H4.5A3.5 3.5 0 0 1 1 14.5v-4A3.5 3.5 0 0 1 4.5 7H6V4a1 1 0 0 1 1-1Zm1 2v2h8V5H8Zm8 15v-5H8v5h8Zm3.5-4A1.5 1.5 0 0 0 21 14.5v-4A1.5 1.5 0 0 0 19.5 9h-15A1.5 1.5 0 0 0 3 10.5v4A1.5 1.5 0 0 0 4.5 16H6v-2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2h1.5Z"
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

function resolveImageSource(value: string): string {
  if (!value) {
    return '';
  }
  if (value.startsWith('data:')) {
    return value;
  }
  return `data:image/png;base64,${value}`;
}

export function PatientDashboard() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { data, error, loading, refreshing } = usePatientWorkspaceData();
  const [isQrExpanded, setIsQrExpanded] = useState(false);

  const profile = data?.profile ?? null;
  const accessRequests = data?.accessRequests ?? [];
  const visits = data?.visits ?? [];

  const qrValue = useMemo(() => {
    if (!profile) {
      return '';
    }
    return `${window.location.origin}/doctor/lookup/${profile.global_patient_identifier}`;
  }, [profile]);

  const totalHospitals = useMemo(() => {
    const hospitalIds = new Set<string>();

    visits.forEach((visit) => {
      const hospitalId = visit.hospital_id?.trim() ?? '';
      if (hospitalId) {
        hospitalIds.add(hospitalId);
      }
    });

    accessRequests.forEach((request) => {
      const hospitalId = request.doctor_hospital_id?.trim() ?? '';
      if (hospitalId) {
        hospitalIds.add(hospitalId);
      }
    });

    return hospitalIds.size;
  }, [accessRequests, visits]);

  const ongoingTreatments = visits.filter(
    (visit) => visit.treatment_status !== 'completed' && visit.treatment_status !== 'one_time_complete',
  ).length;
  const completedVisits = visits.filter(
    (visit) => visit.treatment_status === 'completed' || visit.treatment_status === 'one_time_complete',
  ).length;

  const waitingRequests = accessRequests.filter((request) => request.status === 'waiting').length;
  const approvedRequests = accessRequests.filter((request) => request.status === 'approved').length;
  const deniedRequests = accessRequests.filter((request) => request.status === 'denied').length;

  const patientName = `${profile?.demographics.first_name ?? ''} ${profile?.demographics.last_name ?? ''}`
    .trim() || appUser?.displayName || 'Patient';
  const patientEmail = profile?.contact.email || appUser?.email || 'Not provided';
  const patientPhone = profile?.contact.phone || appUser?.phone || 'Not provided';
  const profileImageSrc = resolveImageSource(profile?.profile_image_base64 ?? '');
  const profileInitials = patientName
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? '')
    .join('') || 'PT';

  function downloadQr(): void {
    const canvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${profile?.global_patient_identifier ?? 'patient'}-qr.png`;
    link.click();
  }

  function printQr(): void {
    const canvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const popup = window.open('', '_blank', 'width=700,height=700');
    if (!popup) {
      return;
    }
    popup.document.write(`
      <html>
      <head><title>Print QR</title></head>
      <body style="font-family:Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh;">
        <div style="text-align:center;">
          <h2>MedLedger Patient QR</h2>
          <img src="${dataUrl}" alt="Patient QR" />
          <p>${profile?.global_patient_identifier ?? ''}</p>
        </div>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  if (loading) {
    return (
      <section className={styles.dashboard}>
        <DashboardPanel title="Patient Dashboard" subtitle="Loading owner workspace...">
          <p className={styles.empty}>Loading patient dashboard...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.dashboard}>
      <section className={styles.stats}>
        <DashboardStat label="MLP Identifier" value={profile?.global_patient_identifier ?? 'MLP-PENDING'} tone="primary" />
        <DashboardStat
          label="Hospitals Overall"
          value={totalHospitals}
          tone="info"
          hint={totalHospitals > 0 ? 'Click to open Doctor Coverage' : 'No hospitals linked yet'}
          onClick={() => navigate('/patient/coverage')}
          ariaLabel="Open doctor coverage"
        />
        <DashboardStat label="Current Treatments Ongoing" value={ongoingTreatments} tone="warning" />
        <DashboardStat label="Completed Visits" value={completedVisits} tone="success" />
      </section>

      <section className={styles.workspaceLayout}>
        <DashboardPanel
          className={styles.profilePanel}
          title="Patient Snapshot"
          subtitle={refreshing ? 'Syncing latest records...' : 'Identity summary from verified profile data.'}
        >
          <div className={styles.profileSummary}>
            {profileImageSrc ? (
              <img className={styles.profileImage} src={profileImageSrc} alt={`${patientName} profile`} />
            ) : (
              <div className={styles.profileImageFallback} aria-hidden="true">
                {profileInitials}
              </div>
            )}
            <div className={styles.profileContent}>
              <p className={styles.profileName}>{patientName}</p>
              <p className={styles.profileIdentifier}>{profile?.global_patient_identifier ?? 'MLP-PENDING'}</p>
              <div className={styles.profileDetailList}>
                <p className={styles.profileDetail}>
                  <span className={styles.icon} aria-hidden="true">
                    <IconMail />
                  </span>
                  {patientEmail}
                </p>
                <p className={styles.profileDetail}>
                  <span className={styles.icon} aria-hidden="true">
                    <IconPhone />
                  </span>
                  {patientPhone}
                </p>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className={styles.quickPanel}
          title="Quick Access Snapshot"
          subtitle="Role-safe medical access overview."
        >
          <div className={styles.quickStats}>
            <article className={styles.quickMetric}>
              <span className={styles.metricIcon} aria-hidden="true">
                <IconHospital />
              </span>
              <div>
                <p className={styles.metricLabel}>Hospitals Linked</p>
                <p className={styles.metricValue}>{totalHospitals}</p>
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
            <Link className={styles.linkButton} to="/patient/coverage">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Doctor Coverage
            </Link>
            <Link className={styles.linkButtonAlt} to="/patient/track-records">
              <span className={styles.icon} aria-hidden="true">
                <IconRoute />
              </span>
              Open Track Records
            </Link>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className={styles.qrPanel}
          title="Patient QR Access"
          subtitle="Primary healthcare handoff token. Scan for verified lookup."
        >
          {profile ? (
            <div className={styles.qrContent}>
              <div className={styles.qrWrap}>
                <QRCodeCanvas id={qrCanvasId} value={qrValue} size={260} bgColor="#FFFFFF" fgColor="#0D1B2A" />
              </div>
              <div className={styles.qrMeta}>
                <p className={styles.qrLabel}>MLP: {profile.global_patient_identifier}</p>
                <p className={styles.qrHint}>
                  This QR remains stable while medical records update securely in the background.
                </p>
                <div className={styles.actions}>
                  <button className={styles.buttonAlt} type="button" onClick={() => setIsQrExpanded(true)}>
                    <span className={styles.icon} aria-hidden="true">
                      <IconExpand />
                    </span>
                    View Large QR
                  </button>
                  <button className={styles.button} type="button" onClick={downloadQr}>
                    <span className={styles.icon} aria-hidden="true">
                      <IconDownload />
                    </span>
                    Download QR
                  </button>
                  <button className={styles.buttonGhost} type="button" onClick={printQr}>
                    <span className={styles.icon} aria-hidden="true">
                      <IconPrint />
                    </span>
                    Print QR
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className={styles.empty}>No patient profile found.</p>
          )}
          {error ? <p className={styles.error}>{error}</p> : null}
        </DashboardPanel>
      </section>

      {isQrExpanded && profile ? (
        <div className={styles.qrModalBackdrop} role="presentation" onClick={() => setIsQrExpanded(false)}>
          <article
            className={styles.qrModal}
            role="dialog"
            aria-modal="true"
            aria-label="Large QR preview"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.qrModalTitle}>MLP QR Code</h3>
            <p className={styles.qrModalText}>{profile.global_patient_identifier}</p>
            <div className={styles.qrLargeWrap}>
              <QRCodeCanvas value={qrValue} size={360} bgColor="#FFFFFF" fgColor="#0D1B2A" />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={downloadQr}>
                <span className={styles.icon} aria-hidden="true">
                  <IconDownload />
                </span>
                Download QR
              </button>
              <button className={styles.buttonGhost} type="button" onClick={() => setIsQrExpanded(false)}>
                <span className={styles.icon} aria-hidden="true">
                  <IconPrint />
                </span>
                Close
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
