import { useEffect, useMemo, useRef, useState } from 'react';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { DateInput } from '../../components/DateInput';
import { DashboardPanel, StatusPill } from '../../components/dashboard';
import { CameraCaptureModal, MediaIconButton, MediaViewerModal } from '../../components/media';
import type { DoctorProfile, Visit } from '../../types';
import { dataUrlToBase64, fileToDataUrl, resolveStoredDocumentPreview } from '../../utils/base64';
import styles from './DoctorAddPatientPage.module.css';

type HereditaryDraft = {
  relation: string;
  condition: string;
  age_of_detection: number | null;
  status: string;
  affected_person_name: string;
  affected_people_count: number | null;
  doctor_report_image_base64: string;
  notes: string;
};

type PreviewModalState = {
  src: string;
  kind: 'image' | 'pdf' | 'other';
  title: string;
};

type CameraTarget = 'profile' | 'aadhaar' | 'prescription' | 'report' | null;

const emptyHereditaryEntry: HereditaryDraft = {
  relation: '',
  condition: '',
  age_of_detection: null,
  status: '',
  affected_person_name: '',
  affected_people_count: null,
  doctor_report_image_base64: '',
  notes: '',
};

function nowDisplay(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(value);
}

export function DoctorAddPatientPage() {
  const { appUser } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [capturedAt, setCapturedAt] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateValue] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [profileImageDataUrl, setProfileImageDataUrl] = useState('');
  const [aadhaarDataUrl, setAadhaarDataUrl] = useState('');
  const [hereditaryHistory, setHereditaryHistory] = useState<HereditaryDraft[]>([]);

  const [illnessOrProblem, setIllnessOrProblem] = useState('');
  const [prescription, setPrescription] = useState('');
  const [prescriptionImageDataUrl, setPrescriptionImageDataUrl] = useState('');
  const [reportsDataUrls, setReportsDataUrls] = useState<string[]>([]);
  const [reportNames, setReportNames] = useState<string[]>([]);
  const [treatmentStatus, setTreatmentStatus] = useState<Visit['treatment_status']>('active');
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const profileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const aadhaarUploadInputRef = useRef<HTMLInputElement | null>(null);
  const prescriptionUploadInputRef = useRef<HTMLInputElement | null>(null);
  const reportsUploadInputRef = useRef<HTMLInputElement | null>(null);

  const isHospitalLinked = Boolean((profile?.hospital_id || appUser?.hospitalId)?.trim());
  const creationMeta = useMemo(
    () => ({
      doctorName: profile?.doctor_name || appUser?.displayName || 'Doctor',
      hospitalId: profile?.hospital_id || appUser?.hospitalId || 'Not linked',
    }),
    [appUser?.displayName, appUser?.hospitalId, profile],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCapturedAt(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void doctorApi.getProfile().then((result) => setProfile(result.profile));
  }, []);

  function resetForm(): void {
    setTemporaryPassword('');
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setGender('');
    setEmail('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setStateValue('');
    setCountry('');
    setPostalCode('');
    setBloodGroup('');
    setAllergiesInput('');
    setProfileImageDataUrl('');
    setAadhaarDataUrl('');
    setHereditaryHistory([]);
    setIllnessOrProblem('');
    setPrescription('');
    setPrescriptionImageDataUrl('');
    setReportsDataUrls([]);
    setReportNames([]);
    setTreatmentStatus('active');
  }

  function updateHereditary(
    index: number,
    updater: (current: HereditaryDraft) => HereditaryDraft,
  ): void {
    setHereditaryHistory((previous) => {
      const next = [...previous];
      const current = next[index];
      if (!current) return previous;
      next[index] = updater(current);
      return next;
    });
  }

  async function handleReportsUpload(files: FileList | null, append = false): Promise<void> {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      if (!append) {
        setReportsDataUrls([]);
        setReportNames([]);
      }
      return;
    }

    const existingKinds = append ? reportsDataUrls.map((item) => resolveStoredDocumentPreview(item).kind) : [];
    const existingImageCount = existingKinds.filter((kind) => kind === 'image').length;
    const existingPdfCount = existingKinds.filter((kind) => kind === 'pdf').length;
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const pdfFiles = selectedFiles.filter((file) => file.type === 'application/pdf');
    const invalidFiles = selectedFiles.filter(
      (file) => !file.type.startsWith('image/') && file.type !== 'application/pdf',
    );

    if (invalidFiles.length > 0) {
      setError('Only image and PDF files are allowed for reports.');
      return;
    }
    if (existingImageCount + imageFiles.length > 4) {
      setError('Maximum 4 images are allowed in reports.');
      return;
    }
    if (existingPdfCount + pdfFiles.length > 2) {
      setError('Maximum 2 PDFs are allowed in reports.');
      return;
    }

    const urls = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
    const names = selectedFiles.map((file) => file.name);
    setReportsDataUrls((previous) => (append ? [...previous, ...urls] : urls));
    setReportNames((previous) => (append ? [...previous, ...names] : names));
  }

  function openPreview(source: { src: string; kind: 'image' | 'pdf' | 'other' }, title: string): void {
    if (!source.src) {
      return;
    }
    setPreviewModal({
      src: source.src,
      kind: source.kind,
      title,
    });
  }

  function handleCameraCapture(dataUrl: string): void {
    setError('');
    if (cameraTarget === 'profile') {
      setProfileImageDataUrl(dataUrl);
      setCameraTarget(null);
      return;
    }
    if (cameraTarget === 'aadhaar') {
      setAadhaarDataUrl(dataUrl);
      setCameraTarget(null);
      return;
    }
    if (cameraTarget === 'prescription') {
      setPrescriptionImageDataUrl(dataUrl);
      setCameraTarget(null);
      return;
    }
    if (cameraTarget === 'report') {
      const existingImageCount = reportsDataUrls
        .map((item) => resolveStoredDocumentPreview(item).kind)
        .filter((kind) => kind === 'image').length;
      if (existingImageCount >= 4) {
        setError('Maximum 4 images are allowed in reports.');
        return;
      }
      setReportsDataUrls((previous) => [...previous, dataUrl]);
      setReportNames((previous) => [...previous, `camera-report-${new Date().toISOString()}.jpg`]);
      setCameraTarget(null);
    }
  }

  function validate(): string | null {
    if (!isHospitalLinked) return 'Doctor must be linked to a hospital before adding patients.';
    if (!temporaryPassword.trim() || temporaryPassword.trim().length < 8)
      return 'Temporary password must be at least 8 characters.';
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required.';
    if (!dateOfBirth.trim() || !gender.trim()) return 'Date of birth and gender are required.';
    if (!email.trim() || !phone.trim()) return 'Email and phone are required.';
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !country.trim() || !postalCode.trim())
      return 'Complete all required contact fields.';
    if (!bloodGroup.trim()) return 'Blood group is required.';
    if (!profileImageDataUrl) return 'Patient profile image is required.';
    if (!aadhaarDataUrl) return 'Aadhaar card document is required.';
    if (
      hereditaryHistory.some(
        (entry) =>
          !entry.relation.trim() ||
          !entry.condition.trim() ||
          !entry.status.trim() ||
          !entry.affected_person_name.trim() ||
          entry.affected_people_count === null ||
          entry.affected_people_count < 1,
      )
    ) {
      return 'Complete or remove empty hereditary entries.';
    }
    return null;
  }

  async function handleCreate(): Promise<void> {
    setError('');
    setMessage('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const hasInitialVisit =
        Boolean(illnessOrProblem.trim()) ||
        Boolean(prescription.trim()) ||
        Boolean(prescriptionImageDataUrl.trim()) ||
        reportsDataUrls.length > 0;

      const response = await doctorApi.createPatient({
        temporary_password: temporaryPassword.trim(),
        patient_profile: {
          demographics: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: dateOfBirth.trim(),
            gender: gender.trim(),
          },
          contact: {
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address_line_1: addressLine1.trim(),
            address_line_2: addressLine2.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            postal_code: postalCode.trim(),
          },
          blood_group: bloodGroup.trim(),
          allergies: allergiesInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          profile_image_base64: dataUrlToBase64(profileImageDataUrl),
          aadhaar_card_base64: dataUrlToBase64(aadhaarDataUrl),
          hereditary_history: hereditaryHistory.map((entry) => ({
            relation: entry.relation.trim(),
            condition: entry.condition.trim(),
            age_of_detection: entry.age_of_detection,
            status: entry.status.trim(),
            affected_person_name: entry.affected_person_name.trim(),
            affected_people_count: entry.affected_people_count,
            doctor_report_image_base64: dataUrlToBase64(entry.doctor_report_image_base64),
            notes: entry.notes.trim(),
          })),
        },
        initial_visit: hasInitialVisit
          ? {
              illness_or_problem: illnessOrProblem.trim(),
              prescription: prescription.trim(),
              prescription_image_base64: dataUrlToBase64(prescriptionImageDataUrl),
              reports_base64: reportsDataUrls.map((item) => dataUrlToBase64(item)),
              treatment_status: treatmentStatus,
            }
          : undefined,
      });

      setMessage(
        `Patient created successfully. MLP: ${response.profile.global_patient_identifier}. Temporary login email: ${response.user.email}`,
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient account.');
    } finally {
      setBusy(false);
    }
  }

  const profilePreview = resolveStoredDocumentPreview(profileImageDataUrl);
  const aadhaarPreview = resolveStoredDocumentPreview(aadhaarDataUrl);
  const prescriptionPreview = resolveStoredDocumentPreview(prescriptionImageDataUrl);

  return (
    <section className={styles.page}>
      <DashboardPanel
        className={styles.metaPanel}
        title="Add Patient"
        subtitle="Doctor-assisted patient onboarding for users who cannot self-register."
        actions={<StatusPill label={isHospitalLinked ? 'hospital linked' : 'not linked'} tone={isHospitalLinked ? 'success' : 'danger'} />}
      >
        <div className={styles.metaGrid}>
          <p className={styles.metaLine}>
            <strong>Created By:</strong> {creationMeta.doctorName}
          </p>
          <p className={styles.metaLine}>
            <strong>Hospital:</strong> {creationMeta.hospitalId}
          </p>
          <p className={styles.metaLine}>
            <strong>Date & Time:</strong> {nowDisplay(capturedAt)}
          </p>
          <p className={styles.metaLine}>
            <strong>Mode:</strong> Auto-verified by doctor onboarding
          </p>
        </div>
      </DashboardPanel>

      <div className={styles.columns}>
        <DashboardPanel
          className={styles.panel}
          title="Account + Identity"
          subtitle="Create login credentials and complete patient core profile."
        >
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Temporary Password
              <input
                className={styles.input}
                type="password"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label className={styles.label}>
              First Name
              <input className={styles.input} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </label>
            <label className={styles.label}>
              Last Name
              <input className={styles.input} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </label>
            <div className={styles.label}>
              <label htmlFor="doctor-add-patient-dob">Date Of Birth</label>
              <DateInput
                id="doctor-add-patient-dob"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                inputClassName={styles.input}
                maxDate={new Date()}
                placeholder="Select date of birth"
              />
            </div>
            <label className={styles.label}>
              Gender
              <input className={styles.input} value={gender} onChange={(event) => setGender(event.target.value)} />
            </label>
            <label className={styles.label}>
              Email
              <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className={styles.label}>
              Phone
              <input className={styles.input} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className={styles.label}>
              Address Line 1
              <input className={styles.input} value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
            </label>
            <label className={styles.label}>
              Address Line 2
              <input className={styles.input} value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
            </label>
            <label className={styles.label}>
              City
              <input className={styles.input} value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <label className={styles.label}>
              State
              <input className={styles.input} value={state} onChange={(event) => setStateValue(event.target.value)} />
            </label>
            <label className={styles.label}>
              Country
              <input className={styles.input} value={country} onChange={(event) => setCountry(event.target.value)} />
            </label>
            <label className={styles.label}>
              Postal Code
              <input className={styles.input} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
            </label>
            <label className={styles.label}>
              Blood Group
              <select className={styles.input} value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)}>
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </label>
            <label className={styles.label}>
              Allergies (comma separated)
              <input
                className={styles.input}
                value={allergiesInput}
                onChange={(event) => setAllergiesInput(event.target.value)}
                placeholder="Peanut, Penicillin"
              />
            </label>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className={styles.panel}
          title="Uploads + Initial Clinical Entry"
          subtitle="Upload live profile/documents and optionally add first visit details."
        >
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Patient Profile Picture
              <div className={styles.mediaActions}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="view"
                    label="View patient profile image"
                    onClick={() => openPreview(profilePreview, 'Patient Profile Image')}
                    disabled={!profilePreview.src}
                  />
                  <MediaIconButton
                    type="camera"
                    label="Capture patient profile image"
                    onClick={() => setCameraTarget('profile')}
                  />
                </div>
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={() => profileUploadInputRef.current?.click()}
                >
                  Upload photo
                </button>
                <input
                  ref={profileUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    if (!file) {
                      setProfileImageDataUrl('');
                    } else {
                      void fileToDataUrl(file).then(setProfileImageDataUrl);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            {profilePreview.src ? (
              <div className={styles.previewCard}>
                <img className={styles.previewImage} src={profilePreview.src} alt="Patient profile preview" />
              </div>
            ) : null}

            <label className={styles.label}>
              Aadhaar Card Document
              <div className={styles.mediaActions}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="view"
                    label="View Aadhaar document"
                    onClick={() => openPreview(aadhaarPreview, 'Aadhaar Document')}
                    disabled={!aadhaarPreview.src}
                  />
                  <MediaIconButton
                    type="camera"
                    label="Capture Aadhaar image"
                    onClick={() => setCameraTarget('aadhaar')}
                  />
                </div>
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={() => aadhaarUploadInputRef.current?.click()}
                >
                  Upload document
                </button>
                <input
                  ref={aadhaarUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    if (!file) {
                      setAadhaarDataUrl('');
                    } else {
                      void fileToDataUrl(file).then(setAadhaarDataUrl);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            {aadhaarPreview.src ? (
              <div className={styles.previewCard}>
                {aadhaarPreview.kind === 'image' ? (
                  <img className={styles.previewImage} src={aadhaarPreview.src} alt="Aadhaar preview" />
                ) : aadhaarPreview.kind === 'pdf' ? (
                  <object className={styles.previewFrame} data={aadhaarPreview.src} type="application/pdf">
                    <a href={aadhaarPreview.src} target="_blank" rel="noreferrer">
                      Open Aadhaar PDF
                    </a>
                  </object>
                ) : (
                  <a href={aadhaarPreview.src} target="_blank" rel="noreferrer">
                    Open Aadhaar file
                  </a>
                )}
              </div>
            ) : null}

            <label className={styles.label}>
              Illness / Sickness / Problem (optional)
              <textarea
                className={styles.input}
                value={illnessOrProblem}
                onChange={(event) => setIllnessOrProblem(event.target.value)}
                placeholder="Describe initial condition"
              />
            </label>
            <label className={styles.label}>
              Initial Prescription Note (optional)
              <textarea
                className={styles.input}
                value={prescription}
                onChange={(event) => setPrescription(event.target.value)}
                placeholder="Initial prescription instructions"
              />
            </label>
            <label className={styles.label}>
              Initial Prescription Image (optional)
              <div className={styles.mediaActions}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="view"
                    label="View prescription image"
                    onClick={() => openPreview(prescriptionPreview, 'Initial Prescription Image')}
                    disabled={!prescriptionPreview.src}
                  />
                  <MediaIconButton
                    type="camera"
                    label="Capture prescription image"
                    onClick={() => setCameraTarget('prescription')}
                  />
                </div>
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={() => prescriptionUploadInputRef.current?.click()}
                >
                  Upload image
                </button>
                <input
                  ref={prescriptionUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    if (!file) {
                      setPrescriptionImageDataUrl('');
                    } else {
                      void fileToDataUrl(file).then(setPrescriptionImageDataUrl);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            {prescriptionPreview.src ? (
              <div className={styles.previewCard}>
                <img className={styles.previewImage} src={prescriptionPreview.src} alt="Prescription preview" />
              </div>
            ) : null}

            <label className={styles.label}>
              Initial Reports (max 4 images + 2 PDFs)
              <div className={styles.mediaActions}>
                <div className={styles.mediaIconGroup}>
                  <MediaIconButton
                    type="camera"
                    label="Capture report image"
                    onClick={() => setCameraTarget('report')}
                  />
                </div>
                <button
                  className={styles.inlineButton}
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
                    void handleReportsUpload(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </label>
            <p className={styles.metaLine}>
              {reportNames.length === 0 ? 'No reports selected.' : `Reports: ${reportNames.join(', ')}`}
            </p>
            {reportsDataUrls.length > 0 ? (
              <div className={styles.reportGrid}>
                {reportsDataUrls.map((item, index) => {
                  const preview = resolveStoredDocumentPreview(item);
                  return (
                    <article className={styles.reportCard} key={`${index}-${reportNames[index] ?? 'report'}`}>
                      {preview.kind === 'image' ? (
                        <img className={styles.reportImage} src={preview.src} alt={`Report ${index + 1}`} />
                      ) : preview.kind === 'pdf' ? (
                        <object className={styles.reportFrame} data={preview.src} type="application/pdf">
                          <a href={preview.src} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        </object>
                      ) : (
                        <a className={styles.reportLink} href={preview.src} target="_blank" rel="noreferrer">
                          Open file
                        </a>
                      )}
                      <div className={styles.reportMetaRow}>
                        <p className={styles.reportMeta}>{reportNames[index] || `Report ${index + 1}`}</p>
                        <MediaIconButton
                          type="view"
                          label={`View report ${index + 1}`}
                          onClick={() =>
                            openPreview(preview, reportNames[index] || `Initial Report ${index + 1}`)
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            <label className={styles.label}>
              Initial Treatment Status
              <select
                className={styles.input}
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
        className={styles.panel}
        title="Family Hereditary Structure"
        subtitle="Add hereditary conditions exactly like patient self-registration."
        actions={
          <button
            className={styles.inlineButton}
            type="button"
            onClick={() =>
              setHereditaryHistory((previous) => [
                ...previous,
                {
                  ...emptyHereditaryEntry,
                },
              ])
            }
          >
            Add entry
          </button>
        }
      >
        {hereditaryHistory.length === 0 ? <p className={styles.metaLine}>No hereditary entries added yet.</p> : null}
        <div className={styles.hereditaryList}>
          {hereditaryHistory.map((entry, index) => {
            const preview = resolveStoredDocumentPreview(entry.doctor_report_image_base64);
            return (
              <article className={styles.hereditaryCard} key={`hereditary-${index}`}>
                <div className={styles.formGrid}>
                  <label className={styles.label}>
                    Relation
                    <input
                      className={styles.input}
                      value={entry.relation}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          relation: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Condition
                    <input
                      className={styles.input}
                      value={entry.condition}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          condition: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Age Of Detection
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      max={120}
                      value={entry.age_of_detection ?? ''}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          age_of_detection: event.target.value ? Number(event.target.value) : null,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Status
                    <input
                      className={styles.input}
                      value={entry.status}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Who Has This Condition
                    <input
                      className={styles.input}
                      value={entry.affected_person_name}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          affected_person_name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    How Many People Have This
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={entry.affected_people_count ?? ''}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          affected_people_count: event.target.value ? Number(event.target.value) : null,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Doctor Report (image/pdf)
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        if (!file) {
                          updateHereditary(index, (current) => ({
                            ...current,
                            doctor_report_image_base64: '',
                          }));
                          return;
                        }
                        void fileToDataUrl(file).then((dataUrl) =>
                          updateHereditary(index, (current) => ({
                            ...current,
                            doctor_report_image_base64: dataUrl,
                          })),
                        );
                      }}
                    />
                  </label>
                  {preview.src ? (
                    <div className={styles.previewCard}>
                      {preview.kind === 'image' ? (
                        <img className={styles.previewImage} src={preview.src} alt={`Hereditary report ${index + 1}`} />
                      ) : preview.kind === 'pdf' ? (
                        <object className={styles.previewFrame} data={preview.src} type="application/pdf">
                          <a href={preview.src} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        </object>
                      ) : (
                        <a href={preview.src} target="_blank" rel="noreferrer">
                          Open document
                        </a>
                      )}
                      <div className={styles.previewActions}>
                        <MediaIconButton
                          type="view"
                          label={`View hereditary report ${index + 1}`}
                          onClick={() => openPreview(preview, `Hereditary Report ${index + 1}`)}
                        />
                      </div>
                    </div>
                  ) : null}
                  <label className={styles.label}>
                    Notes
                    <textarea
                      className={styles.input}
                      value={entry.notes}
                      onChange={(event) =>
                        updateHereditary(index, (current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={() =>
                    setHereditaryHistory((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
                  }
                >
                  Remove Entry
                </button>
              </article>
            );
          })}
        </div>
      </DashboardPanel>

      <div className={styles.actions}>
        <button className={styles.submitButton} type="button" disabled={busy} onClick={() => void handleCreate()}>
          {busy ? 'Creating Patient...' : 'Create Patient Account'}
        </button>
      </div>

      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <MediaViewerModal
        isOpen={Boolean(previewModal)}
        title={previewModal?.title ?? 'Document preview'}
        src={previewModal?.src ?? ''}
        kind={previewModal?.kind ?? 'other'}
        onClose={() => setPreviewModal(null)}
      />
      <CameraCaptureModal
        isOpen={cameraTarget !== null}
        title={
          cameraTarget === 'profile'
            ? 'Capture Patient Profile Image'
            : cameraTarget === 'aadhaar'
              ? 'Capture Aadhaar Document'
              : cameraTarget === 'prescription'
                ? 'Capture Initial Prescription'
                : 'Capture Report Image'
        }
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
      />
    </section>
  );
}
