import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { doctorApi, patientApi } from '../../api/services';
import { getFirebaseAuthErrorMessage } from '../../auth/firebaseAuthError';
import { useAuth } from '../../auth/AuthProvider';
import type { DoctorProfile, PatientProfile, Role } from '../../types';
import { dataUrlToBase64, fileToDataUrl, resolveStoredDocumentPreview } from '../../utils/base64';
import {
  readRememberedAuthInfo,
  writeRememberedAuthInfo,
  type RememberedAuthInfo,
} from '../../utils/authRememberCookie';
import { toastError, toastInfo, toastSuccess } from '../../components/toast';
import { MAX_DOCTOR_SPECIALIZATIONS } from '../../constants/doctorSpecializations';
import { SpecializationPicker } from '../../components/SpecializationPicker';
import { DateInput } from '../../components/DateInput';
import { getStaticAdminSession } from '../admin/staticAdminAuth';
import styles from './AuthPortal.module.css';

type PortalRole = 'patient' | 'doctor';
type AuthMode = 'signin' | 'register';

type AuthPortalProps = {
  portalRole: PortalRole;
  heading: string;
  description: string;
  highlights: string[];
};

type VerificationPreview = {
  name: string;
  src: string;
  kind: 'image' | 'pdf' | 'other';
};

type HereditaryDraft = {
  relation: string;
  condition: string;
  age_of_detection: number | null;
  status: string;
  affected_person_name: string;
  affected_people_count: number | null;
  doctor_report_image_base64: string;
  show_report_preview: boolean;
  notes: string;
};

const emptyHereditaryEntry: HereditaryDraft = {
  relation: '',
  condition: '',
  age_of_detection: null,
  status: '',
  affected_person_name: '',
  affected_people_count: null,
  doctor_report_image_base64: '',
  show_report_preview: false,
  notes: '',
};

function roleHomePath(role: Role): string {
  if (role === 'doctor') {
    return '/doctor/dashboard';
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  return '/patient/dashboard';
}

function evaluatePassword(password: string): { label: string; score: number } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: 'Weak', score: 25 };
  if (score === 2) return { label: 'Fair', score: 50 };
  if (score === 3) return { label: 'Good', score: 75 };
  return { label: 'Strong', score: 100 };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDoctorProfileComplete(profile: DoctorProfile | null): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.doctor_name.trim() &&
      profile.doctor_email.trim() &&
      profile.doctor_phone.trim() &&
      profile.hospital_id.trim() &&
      profile.specializations.length > 0 &&
      profile.qualification.trim() &&
      profile.license.trim(),
  );
}

function isPatientProfileComplete(profile: PatientProfile): boolean {
  return Boolean(
    profile.demographics.first_name.trim() &&
      profile.demographics.last_name.trim() &&
      profile.demographics.date_of_birth.trim() &&
      profile.demographics.gender.trim() &&
      profile.contact.email.trim() &&
      profile.contact.phone.trim() &&
      profile.contact.address_line_1.trim() &&
      profile.contact.city.trim() &&
      profile.contact.state.trim() &&
      profile.contact.country.trim() &&
      profile.contact.postal_code.trim() &&
      profile.blood_group.trim() &&
      profile.profile_image_base64.trim() &&
      profile.aadhaar_card_base64.trim(),
  );
}

function resolvePortalRedirect(portalRole: PortalRole, fromPath: string | undefined): string {
  const defaultPath = portalRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard';
  if (!fromPath) {
    return defaultPath;
  }

  const normalized = fromPath.trim();
  if (!normalized.startsWith('/')) {
    return defaultPath;
  }

  if (portalRole === 'doctor' && normalized.startsWith('/doctor/')) {
    return normalized;
  }

  if (portalRole === 'patient' && normalized.startsWith('/patient/')) {
    return normalized;
  }

  return defaultPath;
}

export function AuthPortal({ portalRole, heading, description, highlights }: AuthPortalProps) {
  const { firebaseUser, appUser, signIn, register, requestPasswordReset, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const staticAdminSession = getStaticAdminSession();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [qualification, setQualification] = useState('');
  const [license, setLicense] = useState('');
  const [doctorProfileImageBase64, setDoctorProfileImageBase64] = useState('');
  const [hospitalLogoBase64, setHospitalLogoBase64] = useState('');
  const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
  const [verificationPreviews, setVerificationPreviews] = useState<VerificationPreview[]>([]);
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientDateOfBirth, setPatientDateOfBirth] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientAddressLine1, setPatientAddressLine1] = useState('');
  const [patientAddressLine2, setPatientAddressLine2] = useState('');
  const [patientCity, setPatientCity] = useState('');
  const [patientState, setPatientState] = useState('');
  const [patientCountry, setPatientCountry] = useState('');
  const [patientPostalCode, setPatientPostalCode] = useState('');
  const [patientBloodGroup, setPatientBloodGroup] = useState('');
  const [patientAllergiesInput, setPatientAllergiesInput] = useState('');
  const [patientProfileImageBase64, setPatientProfileImageBase64] = useState('');
  const [patientAadhaarCardBase64, setPatientAadhaarCardBase64] = useState('');
  const [patientAadhaarPreview, setPatientAadhaarPreview] = useState<VerificationPreview | null>(null);
  const [isPatientAadhaarPreviewOpen, setIsPatientAadhaarPreviewOpen] = useState(false);
  const [patientHereditaryHistory, setPatientHereditaryHistory] = useState<HereditaryDraft[]>([]);
  const [notice, setNotice] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordBusy, setForgotPasswordBusy] = useState(false);

  const fromPath = (location.state as { from?: string } | null)?.from;
  const strength = useMemo(() => evaluatePassword(password), [password]);
  const isRegister = mode === 'register';
  const isDoctorRegister = portalRole === 'doctor' && isRegister;
  const isPatientRegister = portalRole === 'patient' && isRegister;
  const formClassName = [
    styles.form,
    isRegister ? styles.formRegister : styles.formSignin,
    isDoctorRegister ? styles.formDoctorRegister : '',
    isPatientRegister ? styles.formPatientRegister : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!forgotPasswordNotice) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsForgotPasswordOpen(false);
      setForgotPasswordNotice('');
      setForgotPasswordError('');
    }, 5000);

    return () => window.clearTimeout(timerId);
  }, [forgotPasswordNotice]);

  useEffect(() => {
    const remembered = readRememberedAuthInfo();
    if (!remembered || remembered.role !== portalRole) {
      return;
    }

    if (remembered.email) {
      setEmail((previous) => previous || remembered.email);
    }

    if (remembered.displayName) {
      setDisplayName((previous) => previous || remembered.displayName || '');
    }

    if (remembered.phone) {
      setPhone((previous) => previous || remembered.phone || '');
    }

    if (portalRole === 'doctor' && remembered.hospitalId) {
      setHospitalId((previous) => previous || remembered.hospitalId || '');
    }
  }, [portalRole]);

  if (staticAdminSession) {
    return <Navigate to="/admin/panel" replace />;
  }

  if (firebaseUser && appUser) {
    return <Navigate to={roleHomePath(appUser.role)} replace />;
  }

  if (firebaseUser && !appUser) {
    return <Navigate to="/verify" replace />;
  }

  async function handleSignIn(): Promise<void> {
    const signedInUser = await signIn(email.trim(), password);

    if (!signedInUser) {
      navigate('/verify', { replace: true });
      return;
    }

    if (signedInUser.role !== portalRole) {
      await logout();
      throw new Error(
        `This account is registered as ${signedInUser.role}. Use ${signedInUser.role} sign-in only.`,
      );
    }

    if (portalRole === 'doctor') {
      const doctorProfile = (await doctorApi.getProfile()).profile;
      if (!isDoctorProfileComplete(doctorProfile)) {
        await logout();
        throw new Error('Doctor profile is incomplete. Complete all doctor information before sign-in.');
      }
    }

    if (portalRole === 'patient') {
      const patientProfile = (await patientApi.getProfile()).profile;
      if (!isPatientProfileComplete(patientProfile)) {
        await logout();
        throw new Error('Patient profile is incomplete. Complete all patient information before sign-in.');
      }
    }

    const remembered: RememberedAuthInfo = {
      email: signedInUser.email.toLowerCase(),
      role: portalRole,
      displayName: signedInUser.displayName,
      phone: signedInUser.phone,
      hospitalId: portalRole === 'doctor' ? signedInUser.hospitalId : undefined,
    };
    writeRememberedAuthInfo(remembered);
    toastSuccess(`${portalRole === 'doctor' ? 'Doctor' : 'Patient'} login successful.`);
    navigate(resolvePortalRedirect(portalRole, fromPath), { replace: true });
  }

  async function handleRegister(): Promise<void> {
    const patientProfile =
      portalRole === 'patient'
        ? {
            demographics: {
              first_name: patientFirstName.trim(),
              last_name: patientLastName.trim(),
              date_of_birth: patientDateOfBirth.trim(),
              gender: patientGender.trim(),
            },
            contact: {
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              address_line_1: patientAddressLine1.trim(),
              address_line_2: patientAddressLine2.trim(),
              city: patientCity.trim(),
              state: patientState.trim(),
              country: patientCountry.trim(),
              postal_code: patientPostalCode.trim(),
            },
            blood_group: patientBloodGroup.trim(),
            allergies: patientAllergiesInput
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            profile_image_base64: dataUrlToBase64(patientProfileImageBase64),
            aadhaar_card_base64: dataUrlToBase64(patientAadhaarCardBase64),
            hereditary_history: patientHereditaryHistory.map((entry) => ({
              relation: entry.relation.trim(),
              condition: entry.condition.trim(),
              age_of_detection: entry.age_of_detection,
              status: entry.status.trim(),
              affected_person_name: entry.affected_person_name.trim(),
              affected_people_count: entry.affected_people_count,
              doctor_report_image_base64: dataUrlToBase64(entry.doctor_report_image_base64),
              notes: entry.notes.trim(),
            })),
          }
        : undefined;

    await register({
      role: portalRole,
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      phone: phone.trim(),
      patientProfile,
      hospitalId: portalRole === 'doctor' ? hospitalId.trim() : undefined,
      specializations: portalRole === 'doctor' ? specializations : undefined,
      qualification: portalRole === 'doctor' ? qualification.trim() : undefined,
      license: portalRole === 'doctor' ? license.trim() : undefined,
      profileImageBase64: portalRole === 'doctor' ? doctorProfileImageBase64 : undefined,
      hospitalLogoBase64: portalRole === 'doctor' ? hospitalLogoBase64 : undefined,
      verificationDocsBase64: portalRole === 'doctor' ? verificationDocs : [],
    });

    writeRememberedAuthInfo({
      email: email.trim().toLowerCase(),
      role: portalRole,
      displayName: displayName.trim() || undefined,
      phone: phone.trim() || undefined,
      hospitalId: portalRole === 'doctor' ? hospitalId.trim() || undefined : undefined,
    });

    toastInfo('Account created. Please verify your email to continue.');
    navigate('/verify', { replace: true });
  }

  function validateInputs(): string | null {
    if (isRegister && !displayName.trim()) {
      return 'Full name is required.';
    }

    if (isRegister && !phone.trim()) {
      return 'Contact number is required.';
    }

    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!isValidEmail(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Password is required.';
    }

    if (isRegister && password.length < 8) {
      return 'Password must be at least 8 characters for account creation.';
    }

    if (isRegister && password !== confirmPassword) {
      return 'Password and confirm password must match.';
    }

    if (
      isDoctorRegister &&
      (
        !hospitalId.trim() ||
        specializations.length === 0 ||
        !qualification.trim() ||
        !license.trim()
      )
    ) {
      return 'Complete all doctor professional fields before creating account.';
    }

    if (isDoctorRegister && specializations.length > MAX_DOCTOR_SPECIALIZATIONS) {
      return `Select up to ${MAX_DOCTOR_SPECIALIZATIONS} specializations.`;
    }

    if (
      isPatientRegister &&
      (
        !patientFirstName.trim() ||
        !patientLastName.trim() ||
        !patientDateOfBirth.trim() ||
        !patientGender.trim() ||
        !patientAddressLine1.trim() ||
        !patientCity.trim() ||
        !patientState.trim() ||
        !patientCountry.trim() ||
        !patientPostalCode.trim() ||
        !patientBloodGroup.trim()
      )
    ) {
      return 'Complete all required patient profile fields before creating account.';
    }

    if (isPatientRegister && !patientProfileImageBase64) {
      return 'Patient profile image is required.';
    }

    if (isPatientRegister && !patientAadhaarCardBase64) {
      return 'Aadhaar card document is required.';
    }

    if (
      isPatientRegister &&
      patientHereditaryHistory.some(
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

  function updatePatientHereditaryEntry(
    index: number,
    updater: (current: HereditaryDraft) => HereditaryDraft,
  ): void {
    setPatientHereditaryHistory((previous) => {
      const next = [...previous];
      const current = next[index];
      if (!current) {
        return previous;
      }
      next[index] = updater(current);
      return next;
    });
  }

  async function onForgotPasswordSubmit(): Promise<void> {
    setForgotPasswordNotice('');
    setForgotPasswordError('');

    const targetEmail = forgotPasswordEmail.trim() || email.trim();
    if (!targetEmail) {
      const message = 'Enter your registered email address first.';
      setForgotPasswordError(message);
      toastError(message);
      return;
    }

    if (!isValidEmail(targetEmail)) {
      const message = 'Enter a valid email address.';
      setForgotPasswordError(message);
      toastError(message);
      return;
    }

    setForgotPasswordBusy(true);
    try {
      await requestPasswordReset(targetEmail);
      const message =
        'Verification reset email sent. Open your email, verify ownership using the link, then set a new password.';
      setForgotPasswordNotice(message);
      toastSuccess(message);
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err);
      setForgotPasswordError(message);
      toastError(message);
    } finally {
      setForgotPasswordBusy(false);
    }
  }

  async function onSubmit(): Promise<void> {
    setNotice('');
    setError('');
    if (getStaticAdminSession()) {
      const message = 'Admin session is active. Logout admin first to sign in as doctor or patient.';
      setError(message);
      toastError(message);
      return;
    }
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      toastError(validationError);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await handleSignIn();
      } else {
        await handleRegister();
        setNotice('Account created. Verify your email to continue.');
      }
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`${styles.page} ${portalRole === 'doctor' ? styles.doctor : styles.patient}`}>
      <section className={styles.layout}>
        <aside className={styles.hero}>
          <h1 className={styles.heroTitle}>{heading}</h1>
          <p className={styles.heroText}>{description}</p>
          <div className={styles.pills}>
            <span>Role Protected</span>
            <span>Firebase Auth</span>
            <span>Email Verified</span>
          </div>
          <ul className={styles.highlightList}>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link className={styles.backLink} to="/access">
            Change role
          </Link>
          <div className={styles.heroLogoLarge}>
            <img src="/medledger-logo.png" alt="MedLedger logo" />
          </div>
        </aside>

        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardHeadingRow}>
              <h2 className={styles.cardTitle}>
                {portalRole === 'doctor' ? 'Doctor Access' : 'Patient Access'}
              </h2>
              <span className={styles.roleChip}>{portalRole === 'doctor' ? 'Doctor' : 'Patient'}</span>
            </div>
            <p className={styles.cardHint}>
              {isRegister
                ? 'Create account and verify email before entering dashboard.'
                : 'Sign in with your registered email and password.'}
            </p>
            <div className={styles.modeSwitch}>
              <button
                className={`${styles.modeButton} ${mode === 'signin' ? styles.modeActive : ''}`}
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setNotice('');
                }}
              >
                I have an account
              </button>
              <button
                className={`${styles.modeButton} ${mode === 'register' ? styles.modeActive : ''}`}
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setNotice('');
                  setIsForgotPasswordOpen(false);
                  setForgotPasswordNotice('');
                  setForgotPasswordError('');
                }}
              >
                Create account
              </button>
            </div>
          </header>

          <form
            className={formClassName}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            {isRegister ? (
              <section className={`${styles.group} ${styles.identityGroup}`}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.groupTitle}>Identity</h3>
                  <span className={styles.groupTag}>Step 1</span>
                </div>
                <div className={styles.fieldGrid}>
                  <label className={styles.label}>
                    Full Name
                    <input
                      className={styles.input}
                      placeholder="Enter legal full name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Contact Number
                    <input
                      className={styles.input}
                      type="tel"
                      placeholder="+1 5550000000"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section className={`${styles.group} ${styles.credentialsGroup}`}>
              <div className={styles.groupHeader}>
                <h3 className={styles.groupTitle}>Credentials</h3>
                <span className={styles.groupTag}>{isRegister ? 'Step 2' : 'Secure'}</span>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.label}>
                  Email
                  <input
                    className={styles.input}
                    name={`medledger-${portalRole}-email`}
                    type="email"
                    autoComplete="email"
                    placeholder={portalRole === 'doctor' ? 'name@hospital.com' : 'name@example.com'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className={styles.label}>
                  Password
                  <input
                    className={styles.input}
                    name={`medledger-${portalRole}-password`}
                    type="password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder={isRegister ? 'Minimum 8 characters' : 'Enter password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {isRegister ? (
                  <label className={styles.label}>
                    Confirm Password
                    <input
                      className={styles.input}
                      name={`medledger-${portalRole}-confirm-password`}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
              {isRegister ? (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthTrack}>
                    <span className={styles.strengthBar} style={{ width: `${strength.score}%` }} />
                  </div>
                  <small>Password strength: {strength.label}</small>
                </div>
              ) : null}
              {!isRegister ? (
                <div className={styles.forgotWrap}>
                  <button
                    className={styles.forgotToggle}
                    type="button"
                    onClick={() => {
                      setIsForgotPasswordOpen((previous) => {
                        const next = !previous;
                        if (next) {
                          setForgotPasswordEmail(email.trim());
                        } else {
                          setForgotPasswordNotice('');
                          setForgotPasswordError('');
                        }
                        return next;
                      });
                    }}
                  >
                    {isForgotPasswordOpen ? 'Hide forgot password' : 'Forgot password?'}
                  </button>
                  {isForgotPasswordOpen ? (
                    <div className={styles.forgotCard}>
                      <p className={styles.forgotText}>
                        We will send a verification reset link to your email. Use that verified link to set a new password.
                      </p>
                      <label className={styles.label}>
                        Account Email
                        <input
                          className={styles.input}
                          type="email"
                          autoComplete="email"
                          placeholder="name@example.com"
                          value={forgotPasswordEmail}
                          onChange={(event) => setForgotPasswordEmail(event.target.value)}
                        />
                      </label>
                      <button
                        className={styles.inlineButton}
                        type="button"
                        disabled={forgotPasswordBusy}
                        onClick={() => {
                          void onForgotPasswordSubmit();
                        }}
                      >
                        {forgotPasswordBusy ? 'Sending...' : 'Send verification reset email'}
                      </button>
                      {forgotPasswordError ? (
                        <p className={styles.error} role="alert">
                          {forgotPasswordError}
                        </p>
                      ) : null}
                      {forgotPasswordNotice ? <p className={styles.hint}>{forgotPasswordNotice}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {isDoctorRegister ? (
              <section className={`${styles.group} ${styles.professionalGroup}`}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.groupTitle}>Professional Details</h3>
                  <span className={styles.groupTag}>Step 3</span>
                </div>
                <div className={`${styles.fieldGrid} ${styles.fieldGridTwoColumns}`}>
                  <label className={styles.label}>
                    Hospital ID
                    <input
                      className={styles.input}
                      placeholder="HOSP-001"
                      value={hospitalId}
                      onChange={(event) => setHospitalId(event.target.value)}
                    />
                  </label>
                  <div className={`${styles.label} ${styles.fieldSpan}`}>
                    <span>Specialization</span>
                    <SpecializationPicker value={specializations} onChange={setSpecializations} />
                  </div>
                  <label className={styles.label}>
                    Qualification
                    <input
                      className={styles.input}
                      placeholder="MD, MBBS, MS"
                      value={qualification}
                      onChange={(event) => setQualification(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Medical License
                    <input
                      className={styles.input}
                      placeholder="License number"
                      value={license}
                      onChange={(event) => setLicense(event.target.value)}
                    />
                  </label>
                  <label className={`${styles.label} ${styles.fileLabel}`}>
                    Doctor Profile Picture
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        if (!file) {
                          setDoctorProfileImageBase64('');
                          return;
                        }
                        void fileToDataUrl(file).then(setDoctorProfileImageBase64);
                      }}
                    />
                  </label>
                  {doctorProfileImageBase64 ? (
                    <div className={`${styles.fileLabel} ${styles.imagePreviewCard}`}>
                      <img
                        className={styles.imagePreview}
                        src={doctorProfileImageBase64}
                        alt="Doctor profile preview"
                      />
                    </div>
                  ) : null}
                  <label className={`${styles.label} ${styles.fileLabel}`}>
                    Hospital Logo (optional)
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        if (!file) {
                          setHospitalLogoBase64('');
                          return;
                        }
                        void fileToDataUrl(file).then(setHospitalLogoBase64);
                      }}
                    />
                  </label>
                  {hospitalLogoBase64 ? (
                    <div className={`${styles.fileLabel} ${styles.imagePreviewCard}`}>
                      <img
                        className={styles.imagePreview}
                        src={hospitalLogoBase64}
                        alt="Hospital logo preview"
                      />
                    </div>
                  ) : null}
                  <label className={`${styles.label} ${styles.fileLabel}`}>
                    Verification Documents
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files ?? []);
                        if (files.length === 0) {
                          setVerificationDocs([]);
                          setVerificationPreviews([]);
                          return;
                        }

                        void Promise.all(
                          files.map(async (file) => {
                            const dataUrl = await fileToDataUrl(file);
                            const preview = resolveStoredDocumentPreview(dataUrl);
                            return {
                              name: file.name,
                              src: dataUrl,
                              base64: dataUrlToBase64(dataUrl),
                              kind: preview.kind,
                            };
                          }),
                        ).then((items) => {
                          setVerificationDocs(items.map((item) => item.base64));
                          setVerificationPreviews(
                            items.map((item) => ({
                              name: item.name,
                              src: item.src,
                              kind: item.kind,
                            })),
                          );
                        });
                      }}
                    />
                  </label>
                </div>
                <small className={styles.fileCount}>{verificationDocs.length} file(s) selected</small>
                {verificationPreviews.length > 0 ? (
                  <div className={styles.docPreviewGrid}>
                    {verificationPreviews.map((item) => (
                      <article className={styles.docPreviewCard} key={`${item.name}-${item.src.length}`}>
                        {item.kind === 'image' ? (
                          <img className={styles.docPreviewImage} src={item.src} alt={item.name} />
                        ) : item.kind === 'pdf' ? (
                          <object
                            className={styles.docPreviewFrame}
                            data={item.src}
                            type="application/pdf"
                            aria-label={item.name}
                          >
                            <a href={item.src} target="_blank" rel="noreferrer">
                              Open PDF
                            </a>
                          </object>
                        ) : (
                          <a className={styles.docPreviewLink} href={item.src} target="_blank" rel="noreferrer">
                            Open file preview
                          </a>
                        )}
                        <p className={styles.docPreviewName}>{item.name}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {isPatientRegister ? (
              <section className={`${styles.group} ${styles.patientProfileGroup}`}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.groupTitle}>Patient Profile Details</h3>
                  <span className={styles.groupTag}>Step 3</span>
                </div>
                <div className={`${styles.fieldGrid} ${styles.fieldGridTwoColumns}`}>
                  <label className={styles.label}>
                    First Name
                    <input
                      className={styles.input}
                      placeholder="Enter first name"
                      value={patientFirstName}
                      onChange={(event) => setPatientFirstName(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Last Name
                    <input
                      className={styles.input}
                      placeholder="Enter last name"
                      value={patientLastName}
                      onChange={(event) => setPatientLastName(event.target.value)}
                    />
                  </label>
                  <div className={styles.label}>
                    <label htmlFor="patient-register-date-of-birth">Date of Birth</label>
                    <DateInput
                      id="patient-register-date-of-birth"
                      value={patientDateOfBirth}
                      inputClassName={styles.input}
                      maxDate={new Date()}
                      placeholder="Select date of birth"
                      onChange={setPatientDateOfBirth}
                    />
                  </div>
                  <label className={styles.label}>
                    Gender
                    <select
                      className={styles.input}
                      value={patientGender}
                      onChange={(event) => setPatientGender(event.target.value)}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className={styles.label}>
                    Address Line 1
                    <input
                      className={styles.input}
                      placeholder="Street and house number"
                      value={patientAddressLine1}
                      onChange={(event) => setPatientAddressLine1(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Address Line 2
                    <input
                      className={styles.input}
                      placeholder="Apartment, floor (optional)"
                      value={patientAddressLine2}
                      onChange={(event) => setPatientAddressLine2(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    City
                    <input
                      className={styles.input}
                      placeholder="City"
                      value={patientCity}
                      onChange={(event) => setPatientCity(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    State
                    <input
                      className={styles.input}
                      placeholder="State"
                      value={patientState}
                      onChange={(event) => setPatientState(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Country
                    <input
                      className={styles.input}
                      placeholder="Country"
                      value={patientCountry}
                      onChange={(event) => setPatientCountry(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Postal Code
                    <input
                      className={styles.input}
                      placeholder="Postal code"
                      value={patientPostalCode}
                      onChange={(event) => setPatientPostalCode(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Blood Group
                    <select
                      className={styles.input}
                      value={patientBloodGroup}
                      onChange={(event) => setPatientBloodGroup(event.target.value)}
                    >
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
                      placeholder="Peanut, Penicillin"
                      value={patientAllergiesInput}
                      onChange={(event) => setPatientAllergiesInput(event.target.value)}
                    />
                  </label>
                  <label className={`${styles.label} ${styles.fileLabel}`}>
                    Patient Profile Picture
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        if (!file) {
                          setPatientProfileImageBase64('');
                          return;
                        }
                        void fileToDataUrl(file).then(setPatientProfileImageBase64);
                      }}
                    />
                  </label>
                  {patientProfileImageBase64 ? (
                    <div className={`${styles.fileLabel} ${styles.imagePreviewCard}`}>
                      <img
                        className={styles.imagePreview}
                        src={patientProfileImageBase64}
                        alt="Patient profile preview"
                      />
                    </div>
                  ) : null}
                  <label className={`${styles.label} ${styles.fileLabel}`}>
                    Aadhaar Card Document
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*,.pdf"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0] ?? null;
                              if (!file) {
                                setPatientAadhaarCardBase64('');
                                setPatientAadhaarPreview(null);
                                setIsPatientAadhaarPreviewOpen(false);
                                return;
                              }
                              void fileToDataUrl(file).then((dataUrl) => {
                                const preview = resolveStoredDocumentPreview(dataUrl);
                                setPatientAadhaarCardBase64(dataUrl);
                          setPatientAadhaarPreview({
                            name: file.name,
                                  src: dataUrl,
                                  kind: preview.kind,
                                });
                                setIsPatientAadhaarPreviewOpen(false);
                              });
                            }}
                          />
                        </label>
                </div>
                {patientAadhaarPreview ? (
                  <div className={styles.fileActions}>
                    <button
                      className={styles.inlineButton}
                      type="button"
                      onClick={() => setIsPatientAadhaarPreviewOpen((previous) => !previous)}
                    >
                      {isPatientAadhaarPreviewOpen ? 'Hide Aadhaar Preview' : 'View Aadhaar Document'}
                    </button>
                  </div>
                ) : null}
                {patientAadhaarPreview && isPatientAadhaarPreviewOpen ? (
                  <div className={styles.docPreviewGrid}>
                    <article className={styles.docPreviewCard}>
                      {patientAadhaarPreview.kind === 'image' ? (
                        <img
                          className={styles.docPreviewImage}
                          src={patientAadhaarPreview.src}
                          alt={patientAadhaarPreview.name}
                        />
                      ) : patientAadhaarPreview.kind === 'pdf' ? (
                        <object
                          className={styles.docPreviewFrame}
                          data={patientAadhaarPreview.src}
                          type="application/pdf"
                          aria-label={patientAadhaarPreview.name}
                        >
                          <a href={patientAadhaarPreview.src} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        </object>
                      ) : (
                        <a
                          className={styles.docPreviewLink}
                          href={patientAadhaarPreview.src}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open file preview
                        </a>
                      )}
                      <p className={styles.docPreviewName}>{patientAadhaarPreview.name}</p>
                    </article>
                  </div>
                ) : null}

                <section className={styles.hereditarySection}>
                  <div className={styles.hereditaryHeader}>
                    <p className={styles.hereditaryTitle}>Family Hereditary Structure</p>
                    <button
                      className={styles.inlineButton}
                      type="button"
                      onClick={() =>
                        setPatientHereditaryHistory((previous) => [
                          ...previous,
                          { ...emptyHereditaryEntry },
                        ])
                      }
                    >
                      Add entry
                    </button>
                  </div>

                  {patientHereditaryHistory.length === 0 ? (
                    <p className={styles.hereditaryEmpty}>
                      No hereditary entries added yet.
                    </p>
                  ) : null}

                  {patientHereditaryHistory.map((entry, index) => {
                    const reportPreview = resolveStoredDocumentPreview(entry.doctor_report_image_base64);

                    return (
                      <article className={styles.hereditaryCard} key={`hereditary-${index}`}>
                        <div className={`${styles.fieldGrid} ${styles.fieldGridTwoColumns}`}>
                          <label className={styles.label}>
                            Relation
                            <input
                              className={styles.input}
                              value={entry.relation}
                              onChange={(event) =>
                                updatePatientHereditaryEntry(index, (current) => ({
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
                                updatePatientHereditaryEntry(index, (current) => ({
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
                                updatePatientHereditaryEntry(index, (current) => ({
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
                                updatePatientHereditaryEntry(index, (current) => ({
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
                              placeholder="Family member name"
                              value={entry.affected_person_name}
                              onChange={(event) =>
                                updatePatientHereditaryEntry(index, (current) => ({
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
                                updatePatientHereditaryEntry(index, (current) => ({
                                  ...current,
                                  affected_people_count: event.target.value ? Number(event.target.value) : null,
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.label} ${styles.fieldSpan}`}>
                            Doctor Report Image
                            <input
                              className={styles.input}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0] ?? null;
                                if (!file) {
                                  updatePatientHereditaryEntry(index, (current) => ({
                                    ...current,
                                    doctor_report_image_base64: '',
                                    show_report_preview: false,
                                  }));
                                  return;
                                }

                                void fileToDataUrl(file).then((dataUrl) =>
                                  updatePatientHereditaryEntry(index, (current) => ({
                                    ...current,
                                    doctor_report_image_base64: dataUrl,
                                    show_report_preview: false,
                                  })),
                                );
                              }}
                            />
                          </label>
                        </div>

                        {reportPreview.src ? (
                          <div className={styles.fileActions}>
                            <button
                              className={styles.inlineButton}
                              type="button"
                              onClick={() =>
                                updatePatientHereditaryEntry(index, (current) => ({
                                  ...current,
                                  show_report_preview: !current.show_report_preview,
                                }))
                              }
                            >
                              {entry.show_report_preview ? 'Hide Report' : 'View Report'}
                            </button>
                          </div>
                        ) : null}
                        {reportPreview.src && entry.show_report_preview ? (
                          <div className={styles.docPreviewGrid}>
                            <article className={styles.docPreviewCard}>
                              {reportPreview.kind === 'image' ? (
                                <img
                                  className={styles.docPreviewImage}
                                  src={reportPreview.src}
                                  alt={`Doctor report ${index + 1}`}
                                />
                              ) : reportPreview.kind === 'pdf' ? (
                                <object
                                  className={styles.docPreviewFrame}
                                  data={reportPreview.src}
                                  type="application/pdf"
                                  aria-label={`Doctor report ${index + 1}`}
                                >
                                  <a href={reportPreview.src} target="_blank" rel="noreferrer">
                                    Open PDF
                                  </a>
                                </object>
                              ) : (
                                <a className={styles.docPreviewLink} href={reportPreview.src} target="_blank" rel="noreferrer">
                                  Open file preview
                                </a>
                              )}
                              <p className={styles.docPreviewName}>Doctor report</p>
                            </article>
                          </div>
                        ) : null}

                        <label className={styles.label}>
                          Notes
                          <textarea
                            className={styles.input}
                            value={entry.notes}
                            onChange={(event) =>
                              updatePatientHereditaryEntry(index, (current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className={styles.inlineButton}
                          type="button"
                          onClick={() =>
                            setPatientHereditaryHistory((previous) =>
                              previous.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          Remove entry
                        </button>
                      </article>
                    );
                  })}
                </section>
              </section>
            ) : null}

            <div className={styles.actionRow}>
              <button className={styles.submitButton} type="submit" disabled={busy}>
                {busy
                  ? 'Please wait...'
                  : mode === 'signin'
                    ? `Sign In as ${portalRole === 'doctor' ? 'Doctor' : 'Patient'}`
                    : `Create ${portalRole === 'doctor' ? 'Doctor' : 'Patient'} Account`}
              </button>
            </div>
          </form>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className={styles.hint}>{notice}</p> : null}
        </section>
      </section>
    </main>
  );
}
