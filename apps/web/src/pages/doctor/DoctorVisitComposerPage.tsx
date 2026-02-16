import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { CameraCaptureModal, MediaIconButton, MediaViewerModal } from '../../components/media';
import type { DoctorProfile, Visit } from '../../types';
import { dataUrlToBase64, fileToBase64, resolveStoredDocumentPreview } from '../../utils/base64';
import { loadCachedResource, readCachedResource, writeCachedResource } from '../../utils/resourceCache';
import styles from './DoctorVisitComposerPage.module.css';

type SearchResult = {
  patient_uid: string;
  patient_identifier: string;
  demographics: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
  };
  contact: {
    email: string;
    phone: string;
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

type PreviewModalState = {
  src: string;
  kind: 'image' | 'pdf' | 'other';
  title: string;
};

type CameraTarget = 'paper' | 'report' | null;

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

function accessTone(status: SearchResult['access_status'] | ''): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'danger';
  if (status === 'waiting') return 'warning';
  return 'neutral';
}

function formatDateTime(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
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

function timeZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  } catch {
    return 'Local time';
  }
}

export function DoctorVisitComposerPage() {
  const { appUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileCacheKey = `doctor-profile-summary:${appUser?.uid ?? 'anonymous'}`;
  const recentPatientsCacheKey = `doctor-recent-patients:${appUser?.uid ?? 'anonymous'}`;

  const [profile, setProfile] = useState<DoctorProfile | null>(
    readCachedResource<DoctorProfile | null>(profileCacheKey) ?? null,
  );
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>(
    readCachedResource<RecentPatient[]>(recentPatientsCacheKey) ?? [],
  );

  const [prescriptionForInput, setPrescriptionForInput] = useState(searchParams.get('patient') ?? '');
  const [patientMatches, setPatientMatches] = useState<SearchResult[]>([]);
  const [selectedIdentifier, setSelectedIdentifier] = useState('');
  const [selectedPatientUid, setSelectedPatientUid] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [selectedPatientPhone, setSelectedPatientPhone] = useState('');
  const [selectedPatientEmail, setSelectedPatientEmail] = useState('');
  const [selectedAccessStatus, setSelectedAccessStatus] = useState<SearchResult['access_status'] | ''>('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const lookupRef = useRef(0);
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const detailsCacheRef = useRef<Map<string, { phone: string; email: string }>>(new Map());

  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [bodyTemperature, setBodyTemperature] = useState('');
  const [capturedAt, setCapturedAt] = useState(() => new Date());
  const [treatmentStatus, setTreatmentStatus] = useState<Visit['treatment_status']>('active');
  const [paperPrescriptionBase64, setPaperPrescriptionBase64] = useState('');
  const [paperPrescriptionFileName, setPaperPrescriptionFileName] = useState('');
  const [reportAttachmentsBase64, setReportAttachmentsBase64] = useState<string[]>([]);
  const [reportAttachmentNames, setReportAttachmentNames] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const paperUploadInputRef = useRef<HTMLInputElement | null>(null);
  const reportsUploadInputRef = useRef<HTMLInputElement | null>(null);

  const isHospitalLinked = Boolean((profile?.hospital_id || appUser?.hospitalId)?.trim());
  const isDoctorApproved = (profile?.approval_status ?? appUser?.doctorApprovalStatus) === 'approved';
  const zoneName = useMemo(() => timeZoneLabel(), []);
  const paperPrescriptionPreview = useMemo(
    () => resolveStoredDocumentPreview(paperPrescriptionBase64),
    [paperPrescriptionBase64],
  );
  const reportPreviews = useMemo(
    () =>
      reportAttachmentsBase64.map((attachment, index) => ({
        index,
        name: reportAttachmentNames[index] || `Report ${index + 1}`,
        ...resolveStoredDocumentPreview(attachment),
      })),
    [reportAttachmentNames, reportAttachmentsBase64],
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

  useEffect(() => {
    const timer = window.setInterval(() => setCapturedAt(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function rememberPatient(patient: SearchResult): void {
    setRecentPatients((previous) => {
      const merged = [...previous];
      const patientName = `${patient.demographics.first_name} ${patient.demographics.last_name}`.trim();
      const nextEntry: RecentPatient = {
        patient_uid: patient.patient_uid,
        patient_identifier: patient.patient_identifier,
        patient_name: patientName || patient.patient_uid,
        access_status: patient.access_status,
        searched_at: new Date().toISOString(),
      };
      const existingIndex = merged.findIndex((entry) => entry.patient_identifier === patient.patient_identifier);
      if (existingIndex >= 0) merged.splice(existingIndex, 1);
      merged.unshift(nextEntry);
      const trimmed = merged.slice(0, 20);
      writeCachedResource<RecentPatient[]>(recentPatientsCacheKey, trimmed);
      return trimmed;
    });
  }

  async function hydrateSelectedPatient(patient: SearchResult, options: { setQuery?: boolean } = {}): Promise<void> {
    if (options.setQuery) {
      setPrescriptionForInput(patient.patient_identifier);
      setSearchParams({ patient: patient.patient_identifier }, { replace: true });
    }
    setSelectedIdentifier(patient.patient_identifier);
    setSelectedPatientUid(patient.patient_uid);
    setSelectedPatientName(
      `${patient.demographics.first_name} ${patient.demographics.last_name}`.trim() || 'Not provided',
    );
    setSelectedAccessStatus(patient.access_status);
    rememberPatient(patient);

    if (patient.access_status !== 'approved') {
      setSelectedPatientPhone('Hidden until access approved');
      setSelectedPatientEmail('Hidden until access approved');
      return;
    }

    if (patient.contact.phone || patient.contact.email) {
      setSelectedPatientPhone(patient.contact.phone || 'Not available');
      setSelectedPatientEmail(patient.contact.email || 'Not available');
      detailsCacheRef.current.set(patient.patient_identifier, {
        phone: patient.contact.phone || 'Not available',
        email: patient.contact.email || 'Not available',
      });
      return;
    }

    const cachedDetails = detailsCacheRef.current.get(patient.patient_identifier);
    if (cachedDetails) {
      setSelectedPatientPhone(cachedDetails.phone);
      setSelectedPatientEmail(cachedDetails.email);
      return;
    }

    try {
      const detailResponse = await doctorApi.lookupPatient(patient.patient_identifier);
      const nextDetails = {
        phone: detailResponse.patient.contact.phone || 'Not available',
        email: detailResponse.patient.contact.email || 'Not available',
      };
      detailsCacheRef.current.set(patient.patient_identifier, nextDetails);
      setSelectedPatientPhone(nextDetails.phone);
      setSelectedPatientEmail(nextDetails.email);
    } catch {
      setSelectedPatientPhone('Not available');
      setSelectedPatientEmail('Not available');
    }
  }

  async function resolvePatient(query: string): Promise<void> {
    if (!isDoctorApproved) {
      setError('Doctor approval is pending. Patient lookup is available after approval.');
      return;
    }
    const lookupValue = query.trim();
    if (!lookupValue) {
      setPatientMatches([]);
      setSelectedIdentifier('');
      setSelectedPatientUid('');
      setSelectedPatientName('');
      setSelectedPatientPhone('');
      setSelectedPatientEmail('');
      setSelectedAccessStatus('');
      return;
    }

    lookupRef.current += 1;
    const lookupId = lookupRef.current;
    setLookupBusy(true);

    try {
      const cachedResults = searchCacheRef.current.get(lookupValue.toLowerCase());
      const searchResponse = cachedResults
        ? { results: cachedResults }
        : await doctorApi.searchPatients(lookupValue);
      if (!cachedResults) {
        searchCacheRef.current.set(lookupValue.toLowerCase(), searchResponse.results);
      }
      if (lookupId !== lookupRef.current) return;
      const results = searchResponse.results;
      setPatientMatches(results);

      if (results.length === 0) {
        setSelectedIdentifier('');
        setSelectedPatientUid('');
        setSelectedPatientName('');
        setSelectedPatientPhone('');
        setSelectedPatientEmail('');
        setSelectedAccessStatus('');
        return;
      }

      const normalized = lookupValue.toLowerCase();
      const exact = results.find((item) => item.patient_identifier.toLowerCase() === normalized);
      const matched = exact ?? results[0];
      if (!matched) {
        return;
      }
      await hydrateSelectedPatient(matched);
    } finally {
      if (lookupId === lookupRef.current) setLookupBusy(false);
    }
  }

  useEffect(() => {
    const seedFromQuery = searchParams.get('patient') ?? '';
    if (seedFromQuery && seedFromQuery !== prescriptionForInput) {
      setPrescriptionForInput(seedFromQuery);
    }
  }, [prescriptionForInput, searchParams]);

  useEffect(() => {
    const query = prescriptionForInput.trim();
    if (!query || query.length < 2) {
      setPatientMatches([]);
      setSelectedIdentifier('');
      setSelectedPatientUid('');
      setSelectedPatientName('');
      setSelectedPatientPhone('');
      setSelectedPatientEmail('');
      setSelectedAccessStatus('');
      setLookupBusy(false);
      return;
    }
    const timerId = window.setTimeout(() => {
      void resolvePatient(query);
    }, 260);
    return () => window.clearTimeout(timerId);
  }, [isDoctorApproved, prescriptionForInput]);

  async function handlePrescriptionPaperUpload(files: FileList | null): Promise<void> {
    const file = files?.[0] ?? null;
    if (!file) {
      setPaperPrescriptionBase64('');
      setPaperPrescriptionFileName('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Paper prescription file must be an image.');
      return;
    }
    const encoded = await fileToBase64(file);
    setPaperPrescriptionBase64(encoded);
    setPaperPrescriptionFileName(file.name);
  }

  async function handleClinicalReportsUpload(files: FileList | null, append = false): Promise<void> {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      if (!append) {
        setReportAttachmentsBase64([]);
        setReportAttachmentNames([]);
      }
      return;
    }

    const existingKinds = append
      ? reportAttachmentsBase64.map((item) => resolveStoredDocumentPreview(item).kind)
      : [];
    const existingImageCount = existingKinds.filter((kind) => kind === 'image').length;
    const existingPdfCount = existingKinds.filter((kind) => kind === 'pdf').length;

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const pdfFiles = selectedFiles.filter((file) => file.type === 'application/pdf');
    const unknownFiles = selectedFiles.filter(
      (file) => !file.type.startsWith('image/') && file.type !== 'application/pdf',
    );
    if (unknownFiles.length > 0) {
      setError('Only image and PDF files are allowed for clinical reports.');
      return;
    }
    if (existingImageCount + imageFiles.length > 4) {
      setError('Clinical reports allow a maximum of 4 images.');
      return;
    }
    if (existingPdfCount + pdfFiles.length > 2) {
      setError('Clinical reports allow a maximum of 2 PDF files.');
      return;
    }
    const encoded = await Promise.all(selectedFiles.map((file) => fileToBase64(file)));
    const names = selectedFiles.map((file) => file.name);
    setReportAttachmentsBase64((previous) => (append ? [...previous, ...encoded] : encoded));
    setReportAttachmentNames((previous) => (append ? [...previous, ...names] : names));
  }

  const openPreview = (source: { src: string; kind: 'image' | 'pdf' | 'other' }, title: string): void => {
    if (!source.src) {
      return;
    }
    setPreviewModal({
      src: source.src,
      kind: source.kind,
      title,
    });
  };

  function handleCameraCapture(dataUrl: string): void {
    setError('');
    if (cameraTarget === 'paper') {
      setPaperPrescriptionBase64(dataUrlToBase64(dataUrl));
      setPaperPrescriptionFileName(`camera-paper-${new Date().toISOString()}.jpg`);
      setCameraTarget(null);
      return;
    }
    if (cameraTarget === 'report') {
      const existingImageCount = reportAttachmentsBase64
        .map((item) => resolveStoredDocumentPreview(item).kind)
        .filter((kind) => kind === 'image').length;
      if (existingImageCount >= 4) {
        setError('Clinical reports allow a maximum of 4 images.');
        return;
      }
      setReportAttachmentsBase64((previous) => [...previous, dataUrlToBase64(dataUrl)]);
      setReportAttachmentNames((previous) => [...previous, `camera-report-${new Date().toISOString()}.jpg`]);
      setCameraTarget(null);
    }
  }

  async function createVisit(): Promise<void> {
    if (!isDoctorApproved) {
      setError('Doctor approval is pending. Visit submission is available after approval.');
      return;
    }
    if (!selectedIdentifier) {
      setError('Enter patient MLP / UID / email and select a valid patient first.');
      return;
    }
    if (selectedAccessStatus !== 'approved') {
      setError('Patient access must be approved before creating visit.');
      return;
    }
    if (!prescription.trim()) {
      setError('Prescription is required before saving visit.');
      return;
    }
    if (!paperPrescriptionBase64) {
      setError('Paper prescription image is required.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    const vitalsSegments: string[] = [];
    if (bloodPressure.trim()) vitalsSegments.push(`BP: ${bloodPressure.trim()}`);
    if (oxygenSaturation.trim()) vitalsSegments.push(`Oxygen: ${oxygenSaturation.trim()}%`);
    if (bodyTemperature.trim()) vitalsSegments.push(`Temperature: ${bodyTemperature.trim()} C`);

    const vitalsBlock =
      vitalsSegments.length > 0
        ? `Vitals Snapshot (${formatDateTime(capturedAt)}): ${vitalsSegments.join(' | ')}`
        : '';
    const patientBlock = `Prescription For: ${selectedPatientName || 'Not provided'} | Phone: ${
      selectedPatientPhone || 'Not available'
    } | Email: ${selectedPatientEmail || 'Not available'}`;
    const normalizedPrescription = [patientBlock, prescription.trim(), vitalsBlock]
      .filter(Boolean)
      .join('\n\n');

    try {
      const response = await doctorApi.createVisit({
        patient_identifier: selectedIdentifier,
        diagnosis: diagnosis.trim() || 'General consultation',
        prescription: normalizedPrescription,
        paper_prescription_image_base64: paperPrescriptionBase64,
        clinical_reports_base64: reportAttachmentsBase64,
        reports_base64: [paperPrescriptionBase64, ...reportAttachmentsBase64],
        treatment_status: treatmentStatus,
      });
      setMessage(`Prescription and visit saved: ${formatDateTime(response.visit.created_at)}`);
      setDiagnosis('');
      setPrescription('');
      setPaperPrescriptionBase64('');
      setPaperPrescriptionFileName('');
      setReportAttachmentsBase64([]);
      setReportAttachmentNames([]);
      setBloodPressure('');
      setOxygenSaturation('');
      setBodyTemperature('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.summaryPanel}
        title="Visit Composer"
        subtitle={
          isDoctorApproved
            ? 'Prescription and visit records are separated for safer clinical entry.'
            : 'Doctor approval is pending. Profile and Report / Help are available meanwhile.'
        }
        actions={
          <StatusPill
            label={selectedAccessStatus || 'not selected'}
            tone={accessTone(selectedAccessStatus)}
          />
        }
      >
        {!isDoctorApproved ? (
          <p className={styles.error}>
            Doctor approval is pending. Visit Composer unlocks after admin approval.
          </p>
        ) : null}
        <div className={styles.summaryInfo}>
          <p className={styles.summaryLine}>
            Hospital: {profile?.hospital_id || appUser?.hospitalId || 'Not linked'}
          </p>
          <p className={styles.summaryLine}>Current local time zone: {zoneName}</p>
          <p className={styles.summaryLine}>
            Live time: <strong>{formatDateTime(capturedAt)}</strong>
          </p>
        </div>
      </DashboardPanel>

      <div className={styles.columns}>
        <DashboardPanel
          className={styles.panel}
          title="Prescription Details"
          subtitle="Select patient and prepare prescription content."
        >
          <div className={styles.panelBody}>
            <label className={styles.label} htmlFor="prescription-target">
              Prescription For (MLP / UID / email / phone)
            </label>
            <div className={styles.searchField}>
              <span className={styles.searchIcon}>
                <SearchIcon />
              </span>
              <input
                id="prescription-target"
                className={styles.searchInput}
                placeholder="Enter MLP, email, UID, or phone"
                disabled={!isDoctorApproved}
                value={prescriptionForInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setPrescriptionForInput(value);
                  if (value.trim()) {
                    setSearchParams({ patient: value.trim() }, { replace: true });
                  } else {
                    setSearchParams({}, { replace: true });
                  }
                }}
              />
            </div>

            {lookupBusy ? <p className={styles.metaLine}>Resolving patient details...</p> : null}

            {patientMatches.length > 1 ? (
              <div className={styles.matches}>
                {patientMatches.map((match) => (
                  <button
                    className={styles.matchItem}
                    key={match.patient_uid}
                    type="button"
                    onClick={() => {
                      void hydrateSelectedPatient(match, { setQuery: true });
                    }}
                  >
                    <span>{match.demographics.first_name} {match.demographics.last_name}</span>
                    <small>{match.patient_identifier}</small>
                  </button>
                ))}
              </div>
            ) : null}

            <section className={styles.infoCard}>
              <p className={styles.metaLine}>
                <strong>Identifier:</strong> {selectedIdentifier || 'Not selected'}
              </p>
              <p className={styles.metaLine}>
                <strong>Name:</strong> {selectedPatientName || 'Not available'}
              </p>
              <p className={styles.metaLine}>
                <strong>Phone:</strong> {selectedPatientPhone || 'Not available'}
              </p>
              <p className={styles.metaLine}>
                <strong>Email:</strong> {selectedPatientEmail || 'Not available'}
              </p>
            </section>

            <label className={styles.label}>
              Prescription (required)
              <textarea
                className={styles.textarea}
                value={prescription}
                onChange={(event) => setPrescription(event.target.value)}
              />
            </label>

            <label className={styles.label}>
              Paper Prescription Image (required, image only)
              <div className={styles.mediaRow}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="view"
                    label="View paper prescription image"
                    onClick={() =>
                      openPreview(
                        paperPrescriptionPreview,
                        `Paper Prescription | ${selectedIdentifier || 'not selected'}`,
                      )
                    }
                    disabled={!paperPrescriptionPreview.src}
                  />
                  <MediaIconButton
                    type="camera"
                    label="Capture paper prescription image"
                    onClick={() => setCameraTarget('paper')}
                  />
                </div>
                <button
                  className={styles.fileButton}
                  type="button"
                  onClick={() => paperUploadInputRef.current?.click()}
                >
                  Upload image
                </button>
                <input
                  ref={paperUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handlePrescriptionPaperUpload(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            <p className={styles.metaLine}>
              {paperPrescriptionFileName || 'No paper prescription image selected.'}
            </p>
            {paperPrescriptionPreview.src ? (
              <img
                className={styles.paperPreview}
                src={paperPrescriptionPreview.src}
                alt="Paper prescription preview"
              />
            ) : null}

            <section className={styles.recentSection}>
              <p className={styles.recentTitle}>Recent Patients</p>
              {recentPatients.length === 0 ? (
                <p className={styles.metaLine}>No recent patient selections.</p>
              ) : (
                <div className={styles.recentList}>
                  {recentPatients.map((item) => (
                    <button
                      key={`${item.patient_identifier}-${item.searched_at}`}
                      className={styles.recentChip}
                      type="button"
                      onClick={() => {
                        setPrescriptionForInput(item.patient_identifier);
                        setSearchParams({ patient: item.patient_identifier }, { replace: true });
                      }}
                    >
                      <span>{item.patient_name}</span>
                      <small>{item.patient_identifier}</small>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className={styles.panel}
          title="Visit Details"
          subtitle="Capture illness/sickness/problem, vitals, treatment state, and report attachments."
        >
          <div className={styles.panelBody}>
            <label className={styles.label}>
              Auto Captured Date Time
              <input className={styles.inputReadOnly} value={formatDateTime(capturedAt)} readOnly />
            </label>

            <div className={styles.vitalsGrid}>
              <label className={styles.label}>
                BP
                <input
                  className={styles.input}
                  placeholder="120/80"
                  value={bloodPressure}
                  onChange={(event) => setBloodPressure(event.target.value)}
                />
              </label>
              <label className={styles.label}>
                Oxygen
                <input
                  className={styles.input}
                  placeholder="98"
                  value={oxygenSaturation}
                  onChange={(event) => setOxygenSaturation(event.target.value)}
                />
              </label>
              <label className={styles.label}>
                Temperature
                <input
                  className={styles.input}
                  placeholder="36.8"
                  value={bodyTemperature}
                  onChange={(event) => setBodyTemperature(event.target.value)}
                />
              </label>
            </div>

            <label className={styles.label}>
              Illness / Sickness / Problem
              <textarea
                className={styles.textarea}
                placeholder="Describe current illness, symptoms, or clinical problem"
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
              />
            </label>

            <label className={styles.label}>
              Clinical Reports (max 4 images + 2 PDFs)
              <div className={styles.mediaRow}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="camera"
                    label="Capture clinical report image"
                    onClick={() => setCameraTarget('report')}
                  />
                </div>
                <button
                  className={styles.fileButton}
                  type="button"
                  onClick={() => reportsUploadInputRef.current?.click()}
                >
                  Upload reports
                </button>
                <input
                  ref={reportsUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  onChange={(event) => {
                    void handleClinicalReportsUpload(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            <p className={styles.metaLine}>
              {reportAttachmentNames.length === 0
                ? 'No clinical report attachments selected.'
                : `Attachments: ${reportAttachmentNames.join(', ')}`}
            </p>
            {reportPreviews.length > 0 ? (
              <div className={styles.reportPreviewGrid}>
                {reportPreviews.map((report) => (
                  <article className={styles.reportPreviewCard} key={`${report.index}-${report.name}`}>
                    {report.kind === 'image' ? (
                      <img className={styles.reportPreview} src={report.src} alt={report.name} />
                    ) : report.kind === 'pdf' ? (
                      <object className={styles.reportPreview} data={report.src} type="application/pdf">
                        <a href={report.src} target="_blank" rel="noreferrer">
                          Open PDF
                        </a>
                      </object>
                    ) : (
                      <a href={report.src} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    )}
                    <div className={styles.reportPreviewMeta}>
                      <p className={styles.reportPreviewName}>{report.name}</p>
                      <MediaIconButton
                        type="view"
                        label={`View ${report.name}`}
                        onClick={() =>
                          openPreview(
                            report,
                            `Clinical Report ${report.index + 1} | ${selectedIdentifier || 'unassigned'}`,
                          )
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <label className={styles.label}>
              Treatment Status
              <select
                className={styles.select}
                value={treatmentStatus}
                onChange={(event) => setTreatmentStatus(event.target.value as Visit['treatment_status'])}
              >
                <option value="active">active</option>
                <option value="improving">improving</option>
                <option value="stable">stable</option>
                <option value="critical">critical</option>
                <option value="completed">completed</option>
                <option value="one_time_complete">one_time_complete</option>
              </select>
            </label>
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel
        className={styles.submitPanel}
        title="Submit Prescription"
        subtitle="This saves prescription and visit details into database with server date and time."
      >
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !isHospitalLinked || !isDoctorApproved}
            onClick={() => void createVisit()}
          >
            Submit Prescription + Save Visit
          </button>
          {selectedIdentifier ? (
            <Link className={styles.linkButton} to={`/doctor/lookup/${selectedIdentifier}`}>
              Open Medical History
            </Link>
          ) : null}
        </div>
        <p className={styles.metaLine}>
          Auto captured local time ({formatDateTime(capturedAt)}) is included in notes; server save time is stored in database.
        </p>
        {message ? <p className={styles.hint}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </DashboardPanel>

      <MediaViewerModal
        isOpen={Boolean(previewModal)}
        title={previewModal?.title ?? 'Attachment preview'}
        src={previewModal?.src ?? ''}
        kind={previewModal?.kind ?? 'other'}
        onClose={() => setPreviewModal(null)}
      />
      <CameraCaptureModal
        isOpen={cameraTarget !== null}
        title={cameraTarget === 'paper' ? 'Capture Paper Prescription' : 'Capture Clinical Report'}
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
      />
    </section>
  );
}
