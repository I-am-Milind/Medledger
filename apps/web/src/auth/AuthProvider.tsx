import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import type { AppUser, Role } from '../types';
import { firebaseAuth } from '../config/firebase';
import { ApiError, setApiTokenProvider, setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/services';
import { toastError } from '../components/toast';

type RegistrationInput = {
  email: string;
  password: string;
  role: 'patient' | 'doctor';
  displayName: string;
  phone?: string;
  patientProfile?: {
    demographics: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      gender: string;
    };
    contact: {
      email: string;
      phone: string;
      address_line_1: string;
      address_line_2: string;
      city: string;
      state: string;
      country: string;
      postal_code: string;
    };
    blood_group: string;
    allergies: string[];
    profile_image_base64: string;
    aadhaar_card_base64: string;
    hereditary_history: Array<{
      relation: string;
      condition: string;
      age_of_detection: number | null;
      status: string;
      affected_person_name: string;
      affected_people_count: number | null;
      doctor_report_image_base64: string;
      notes: string;
    }>;
  };
  hospitalId?: string;
  specializations?: string[];
  qualification?: string;
  license?: string;
  profileImageBase64?: string;
  hospitalLogoBase64?: string;
  verificationDocsBase64?: string[];
};

type PendingSetup = {
  email: string;
  role: 'patient' | 'doctor';
  displayName: string;
  phone?: string;
  patientProfile?: {
    demographics: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      gender: string;
    };
    contact: {
      email: string;
      phone: string;
      address_line_1: string;
      address_line_2: string;
      city: string;
      state: string;
      country: string;
      postal_code: string;
    };
    blood_group: string;
    allergies: string[];
    profile_image_base64: string;
    aadhaar_card_base64: string;
    hereditary_history: Array<{
      relation: string;
      condition: string;
      age_of_detection: number | null;
      status: string;
      affected_person_name: string;
      affected_people_count: number | null;
      doctor_report_image_base64: string;
      notes: string;
    }>;
  };
  hospitalId?: string;
  specializations?: string[];
  qualification?: string;
  license?: string;
  profileImageBase64?: string;
  hospitalLogoBase64?: string;
  verificationDocsBase64?: string[];
};

type AuthContextValue = {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser | null>;
  register: (payload: RegistrationInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: (options?: { reloadFirebaseUser?: boolean }) => Promise<AppUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const pendingSetupStorageKey = 'medledger.pending-registration';

async function toErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Authentication failed.';
}

function persistPendingSetup(payload: PendingSetup): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(pendingSetupStorageKey, JSON.stringify(payload));
}

function readPendingSetup(): PendingSetup | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(pendingSetupStorageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingSetup;
  } catch {
    return null;
  }
}

function clearPendingSetup(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(pendingSetupStorageKey);
}

function resolvePendingSpecializations(
  payload: PendingSetup & { specialization?: string },
): string[] {
  if (Array.isArray(payload.specializations)) {
    return payload.specializations.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (typeof payload.specialization === 'string' && payload.specialization.trim().length > 0) {
    return [payload.specialization.trim()];
  }
  return [];
}

function buildDoctorBootstrapProfile(input: {
  displayName: string;
  email: string;
  phone?: string;
  hospitalId?: string;
  specializations?: string[];
  qualification?: string;
  license?: string;
  profileImageBase64?: string;
  hospitalLogoBase64?: string;
  verificationDocsBase64?: string[];
}): {
  doctor_name: string;
  doctor_email: string;
  doctor_phone: string;
  hospital_id: string;
  hospital_logo_base64: string;
  specializations: string[];
  qualification: string;
  license: string;
  profile_image_base64: string;
  verification_docs_base64: string[];
} | undefined {
  if (
    !input.hospitalId ||
    !input.specializations ||
    input.specializations.length === 0 ||
    !input.qualification ||
    !input.license
  ) {
    return undefined;
  }

  return {
    doctor_name: input.displayName,
    doctor_email: input.email,
    doctor_phone: input.phone ?? '',
    hospital_id: input.hospitalId,
    hospital_logo_base64: input.hospitalLogoBase64 ?? '',
    specializations: input.specializations,
    qualification: input.qualification,
    license: input.license,
    profile_image_base64: input.profileImageBase64 ?? '',
    verification_docs_base64: input.verificationDocsBase64 ?? [],
  };
}

function ensureDoctorBootstrapProfile(
  profile: ReturnType<typeof buildDoctorBootstrapProfile>,
): NonNullable<ReturnType<typeof buildDoctorBootstrapProfile>> {
  if (!profile) {
    throw new Error('Doctor profile details are incomplete. Please fill all professional details.');
  }
  return profile;
}

function buildPatientBootstrapProfile(input: {
  email: string;
  phone?: string;
  patientProfile?: PendingSetup['patientProfile'];
}): PendingSetup['patientProfile'] | undefined {
  if (!input.patientProfile) {
    return undefined;
  }

  return {
    ...input.patientProfile,
    contact: {
      ...input.patientProfile.contact,
      email: input.patientProfile.contact.email || input.email,
      phone: input.patientProfile.contact.phone || input.phone || '',
    },
  };
}

function ensurePatientBootstrapProfile(
  profile: ReturnType<typeof buildPatientBootstrapProfile>,
): NonNullable<ReturnType<typeof buildPatientBootstrapProfile>> {
  if (!profile) {
    throw new Error('Patient profile details are incomplete. Please fill all required fields.');
  }
  return profile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastRestoreErrorRef = useRef<{ message: string; at: number }>({ message: '', at: 0 });

  async function clearSession(): Promise<void> {
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.warn('Failed to sign out cleanly', error);
    } finally {
      setFirebaseUser(null);
      setAppUser(null);
      setApiTokenProvider(async () => null);
    }
  }

  function isProvisioningError(error: unknown): boolean {
    if (!(error instanceof ApiError)) {
      return false;
    }
    if (error.statusCode !== 403) {
      return false;
    }
    return error.message.toLowerCase().includes('not provisioned');
  }

  async function refreshSession(options: { reloadFirebaseUser?: boolean } = {}): Promise<AppUser | null> {
    const shouldReload = options.reloadFirebaseUser ?? false;
    let currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      setAppUser(null);
      return null;
    }

    if (shouldReload) {
      await currentUser.reload();
      currentUser = firebaseAuth.currentUser;
    }
    const refreshedUser = currentUser;
    setFirebaseUser(refreshedUser);

    if (!refreshedUser?.emailVerified) {
      setApiTokenProvider(async () => refreshedUser?.getIdToken() ?? null);
      setAppUser(null);
      return null;
    }

    setApiTokenProvider(async () => refreshedUser.getIdToken());

    const pending = readPendingSetup();
    if (pending && refreshedUser.email && pending.email.toLowerCase() === refreshedUser.email.toLowerCase()) {
      const pendingSpecializations = resolvePendingSpecializations(
        pending as PendingSetup & { specialization?: string },
      );
      const pendingDoctorProfile = buildDoctorBootstrapProfile({
        displayName: pending.displayName,
        email: pending.email,
        phone: pending.phone,
        hospitalId: pending.hospitalId,
        specializations: pendingSpecializations,
        qualification: pending.qualification,
        license: pending.license,
        profileImageBase64: pending.profileImageBase64,
        hospitalLogoBase64: pending.hospitalLogoBase64,
        verificationDocsBase64: pending.verificationDocsBase64,
      });
      const pendingPatientProfile = buildPatientBootstrapProfile({
        email: pending.email,
        phone: pending.phone,
        patientProfile: pending.patientProfile,
      });
      let pendingSetupComplete = true;
      try {
        const doctorProfile =
          pending.role === 'doctor' ? ensureDoctorBootstrapProfile(pendingDoctorProfile) : undefined;
        const patientProfile =
          pending.role === 'patient' ? ensurePatientBootstrapProfile(pendingPatientProfile) : undefined;

        await authApi.bootstrap({
          role: pending.role,
          displayName: pending.displayName,
          phone: pending.phone,
          hospitalId: pending.hospitalId,
          patientProfile,
          doctorProfile,
        });
      } catch (error) {
        pendingSetupComplete = false;
        console.error('Pending registration bootstrap failed', error);
      }

      if (pendingSetupComplete) {
        clearPendingSetup();
      }
    }

    const session = await authApi.session();
    setAppUser(session.user);
    return session.user;
  }

  async function runWithLoading<T>(task: () => Promise<T>): Promise<T> {
    setLoading(true);
    try {
      return await task();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearSession();
    });

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setFirebaseUser(nextUser);

      if (!nextUser) {
        setAppUser(null);
        setLoading(false);
        setApiTokenProvider(async () => null);
        return;
      }

      try {
        await refreshSession();
      } catch (error) {
        console.error('Failed to restore session', error);
        const message = error instanceof Error ? error.message : 'Failed to restore session';
        const now = Date.now();
        if (
          lastRestoreErrorRef.current.message !== message ||
          now - lastRestoreErrorRef.current.at > 5000
        ) {
          toastError(message);
          lastRestoreErrorRef.current = { message, at: now };
        }
        if (isProvisioningError(error)) {
          await clearSession();
        } else {
          setAppUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      signIn: async (email, password) => {
        return runWithLoading(async () => {
          try {
            await signInWithEmailAndPassword(firebaseAuth, email, password);
            return await refreshSession();
          } catch (error) {
            await clearSession();
            throw error;
          }
        });
      },
      register: async (payload) => {
        await runWithLoading(async () => {
          const credential = await createUserWithEmailAndPassword(
            firebaseAuth,
            payload.email,
            payload.password,
          );
          await updateProfile(credential.user, { displayName: payload.displayName });
          await sendEmailVerification(credential.user);
          setApiTokenProvider(async () => credential.user.getIdToken(true));
          persistPendingSetup({
            email: payload.email,
            role: payload.role,
            displayName: payload.displayName,
            phone: payload.phone,
            patientProfile: payload.patientProfile,
            hospitalId: payload.hospitalId,
            specializations: payload.specializations,
            qualification: payload.qualification,
            license: payload.license,
            profileImageBase64: payload.profileImageBase64,
            hospitalLogoBase64: payload.hospitalLogoBase64,
            verificationDocsBase64: payload.verificationDocsBase64,
          });

          try {
            const doctorProfile = buildDoctorBootstrapProfile({
              displayName: payload.displayName,
              email: payload.email,
              phone: payload.phone,
              hospitalId: payload.hospitalId,
              specializations: payload.specializations,
              qualification: payload.qualification,
              license: payload.license,
              profileImageBase64: payload.profileImageBase64,
              hospitalLogoBase64: payload.hospitalLogoBase64,
              verificationDocsBase64: payload.verificationDocsBase64,
            });
            const patientProfile = buildPatientBootstrapProfile({
              email: payload.email,
              phone: payload.phone,
              patientProfile: payload.patientProfile,
            });
            const ensuredDoctorProfile =
              payload.role === 'doctor' ? ensureDoctorBootstrapProfile(doctorProfile) : undefined;
            const ensuredPatientProfile =
              payload.role === 'patient' ? ensurePatientBootstrapProfile(patientProfile) : undefined;

            const boot = await authApi.bootstrap({
              role: payload.role,
              displayName: payload.displayName,
              phone: payload.phone,
              hospitalId: payload.hospitalId,
              patientProfile: ensuredPatientProfile,
              doctorProfile: ensuredDoctorProfile,
            });

            await credential.user.reload();
            setFirebaseUser(firebaseAuth.currentUser);
            setAppUser(credential.user.emailVerified ? boot.user : null);
            if (credential.user.emailVerified) {
              clearPendingSetup();
            }
          } catch (error) {
            console.error('Registration setup failed after Firebase account creation', error);
            setFirebaseUser(firebaseAuth.currentUser);
            setAppUser(null);
            throw error;
          }
        });
      },
      requestPasswordReset: async (email) => {
        const normalized = email.trim().toLowerCase();
        await sendPasswordResetEmail(firebaseAuth, normalized, {
          url: `${window.location.origin}/access`,
        });
      },
      logout: async () => {
        await runWithLoading(async () => {
          await clearSession();
        });
      },
      refreshSession,
    }),
    [firebaseUser, appUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export async function safeAuthCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new Error(await toErrorMessage(error));
  }
}

export function hasRole(user: AppUser | null, role: Role): boolean {
  return Boolean(user && user.role === role);
}
