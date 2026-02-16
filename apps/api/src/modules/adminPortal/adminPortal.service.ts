import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../core/errors/AppError';
import type {
  DoctorProfileDoc,
  PatientProfileDoc,
  SupportRequestDoc,
  UserDoc,
} from '../../domain/models';
import {
  DOCTOR_APPROVAL_STATUS,
  PATIENT_VERIFICATION_STATUS,
  ROLES,
  SUPPORT_REQUEST_STATUS,
  type DoctorApprovalStatus,
  type PatientVerificationStatus,
  type SupportRequestStatus,
} from '../../domain/roles';
import type { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import type { PatientsRepository } from '../common/patients.repository';
import type { SupportRequestsRepository } from '../common/supportRequests.repository';
import type { UsersRepository } from '../common/users.repository';

const STATIC_ADMIN_EMAIL = 'admin@med.com';
const STATIC_ADMIN_PASSWORD = 'admin@123';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type AdminSession = {
  email: string;
  expiresAt: number;
};

export type AdminPortalLiveData = {
  timestamp: string;
  summary: {
    total_doctors: number;
    doctor_pending: number;
    doctor_approved: number;
    doctor_denied: number;
    total_patients: number;
    patient_pending: number;
    patient_verified: number;
    patient_rejected: number;
    support_open: number;
    support_in_progress: number;
    support_resolved: number;
  };
  doctor_verifications: Array<{
    uid: string;
    doctor_name: string;
    doctor_email: string;
    doctor_phone: string;
    hospital_id: string;
    specializations: string[];
    qualification: string;
    license: string;
    approval_status: DoctorApprovalStatus;
    created_at: string;
    updated_at: string;
  }>;
  patient_verifications: Array<{
    uid: string;
    identifier: string;
    patient_name: string;
    email: string;
    phone: string;
    blood_group: string;
    verification_status: PatientVerificationStatus;
    created_at: string;
    updated_at: string;
  }>;
  doctor_database: Array<{
    uid: string;
    doctor_name: string;
    doctor_email: string;
    doctor_phone: string;
    hospital_id: string;
    specializations: string[];
    qualification: string;
    license: string;
    approval_status: DoctorApprovalStatus;
    created_at: string;
    updated_at: string;
  }>;
  patient_database: Array<{
    uid: string;
    identifier: string;
    patient_name: string;
    email: string;
    phone: string;
    blood_group: string;
    verification_status: PatientVerificationStatus;
    created_at: string;
    updated_at: string;
  }>;
  support_inbox: SupportRequestDoc[];
};

export class AdminPortalService {
  private readonly sessions = new Map<string, AdminSession>();

  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly doctorProfilesRepository: DoctorProfilesRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly supportRequestsRepository: SupportRequestsRepository,
  ) {}

  private cleanupSessions(): void {
    const now = Date.now();
    this.sessions.forEach((session, token) => {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    });
  }

  public login(email: string, password: string): { token: string; email: string; expires_at: string } {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== STATIC_ADMIN_EMAIL || password !== STATIC_ADMIN_PASSWORD) {
      throw new AppError('Invalid static admin credentials', StatusCodes.UNAUTHORIZED, 'AUTH_INVALID');
    }

    this.cleanupSessions();
    const token = randomUUID();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(token, {
      email: normalizedEmail,
      expiresAt,
    });

    return {
      token,
      email: normalizedEmail,
      expires_at: new Date(expiresAt).toISOString(),
    };
  }

  public validateSessionToken(token: string): string | null {
    this.cleanupSessions();
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session.email;
  }

  public logout(token: string): void {
    this.sessions.delete(token);
  }

  public async getLiveData(): Promise<AdminPortalLiveData> {
    const [doctorProfiles, patientProfiles, users, supportRequests] = await Promise.all([
      this.doctorProfilesRepository.listAll(),
      this.patientsRepository.listAll(),
      this.usersRepository.listAll(),
      this.supportRequestsRepository.listAll(),
    ]);

    const userMap = new Map(users.map((user) => [user.uid, user] as const));

    const doctorRows = this.buildDoctorRows(doctorProfiles);
    const patientRows = this.buildPatientRows(patientProfiles, userMap);

    const summary = {
      total_doctors: doctorRows.length,
      doctor_pending: doctorRows.filter((item) => item.approval_status === DOCTOR_APPROVAL_STATUS.PENDING).length,
      doctor_approved: doctorRows.filter((item) => item.approval_status === DOCTOR_APPROVAL_STATUS.APPROVED).length,
      doctor_denied: doctorRows.filter((item) => item.approval_status === DOCTOR_APPROVAL_STATUS.DENIED).length,
      total_patients: patientRows.length,
      patient_pending: patientRows.filter((item) => item.verification_status === PATIENT_VERIFICATION_STATUS.PENDING)
        .length,
      patient_verified: patientRows.filter(
        (item) => item.verification_status === PATIENT_VERIFICATION_STATUS.VERIFIED,
      ).length,
      patient_rejected: patientRows.filter(
        (item) => item.verification_status === PATIENT_VERIFICATION_STATUS.REJECTED,
      ).length,
      support_open: supportRequests.filter((item) => item.status === SUPPORT_REQUEST_STATUS.OPEN).length,
      support_in_progress: supportRequests.filter((item) => item.status === SUPPORT_REQUEST_STATUS.IN_PROGRESS)
        .length,
      support_resolved: supportRequests.filter((item) => item.status === SUPPORT_REQUEST_STATUS.RESOLVED).length,
    };

    return {
      timestamp: new Date().toISOString(),
      summary,
      doctor_verifications: doctorRows,
      patient_verifications: patientRows,
      doctor_database: doctorRows,
      patient_database: patientRows,
      support_inbox: supportRequests,
    };
  }

  public async verifyDoctor(
    doctorUid: string,
    status: DoctorApprovalStatus,
  ): Promise<DoctorProfileDoc> {
    const doctorProfile = await this.doctorProfilesRepository.findByUid(doctorUid);
    if (!doctorProfile) {
      throw new AppError('Doctor profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const now = new Date().toISOString();
    const updatedProfile: DoctorProfileDoc = {
      ...doctorProfile,
      approval_status: status,
      updated_at: now,
    };

    const existingUser = await this.usersRepository.findByUid(doctorUid);
    const userDoc: UserDoc = existingUser
      ? {
          ...existingUser,
          role: ROLES.DOCTOR,
          displayName: undefined,
          phone: undefined,
          hospitalId: undefined,
          doctorApprovalStatus: status,
          patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
          updatedAt: now,
        }
      : {
          uid: doctorUid,
          email: doctorProfile.doctor_email.toLowerCase(),
          role: ROLES.DOCTOR,
          displayName: undefined,
          phone: undefined,
          hospitalId: undefined,
          doctorApprovalStatus: status,
          patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
          createdAt: doctorProfile.created_at,
          updatedAt: now,
        };

    await Promise.all([
      this.doctorProfilesRepository.upsert(updatedProfile),
      this.usersRepository.upsert(userDoc),
    ]);
    return updatedProfile;
  }

  public async verifyPatient(
    patientUid: string,
    status: PatientVerificationStatus,
  ): Promise<UserDoc> {
    const patientProfile = await this.patientsRepository.findByOwnerUid(patientUid);
    if (!patientProfile) {
      throw new AppError('Patient profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const existingUser = await this.usersRepository.findByUid(patientUid);
    const now = new Date().toISOString();
    const userDoc: UserDoc = existingUser
      ? {
          ...existingUser,
          role: ROLES.PATIENT,
          displayName: existingUser.displayName ?? `${patientProfile.demographics.first_name} ${patientProfile.demographics.last_name}`.trim(),
          phone: existingUser.phone ?? patientProfile.contact.phone,
          doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
          patientVerificationStatus: status,
          updatedAt: now,
        }
      : {
          uid: patientUid,
          email: patientProfile.contact.email.toLowerCase(),
          role: ROLES.PATIENT,
          displayName: `${patientProfile.demographics.first_name} ${patientProfile.demographics.last_name}`.trim(),
          phone: patientProfile.contact.phone,
          hospitalId: undefined,
          doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
          patientVerificationStatus: status,
          createdAt: patientProfile.created_at,
          updatedAt: now,
        };

    await this.usersRepository.upsert(userDoc);
    return userDoc;
  }

  public async updateSupportRequestStatus(
    requestId: string,
    status: SupportRequestStatus,
    actor: { uid: string; email: string },
  ): Promise<SupportRequestDoc> {
    const request = await this.supportRequestsRepository.findById(requestId);
    if (!request) {
      throw new AppError('Support request not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const now = new Date().toISOString();
    const updated: SupportRequestDoc = {
      ...request,
      status,
      updated_at: now,
      resolved_by_uid: status === SUPPORT_REQUEST_STATUS.RESOLVED ? actor.uid : request.resolved_by_uid,
      resolved_by_email:
        status === SUPPORT_REQUEST_STATUS.RESOLVED ? actor.email.toLowerCase() : request.resolved_by_email,
    };
    return this.supportRequestsRepository.update(updated);
  }

  private buildDoctorRows(doctorProfiles: DoctorProfileDoc[]): AdminPortalLiveData['doctor_database'] {
    return doctorProfiles.map((profile) => ({
      uid: profile.uid,
      doctor_name: profile.doctor_name,
      doctor_email: profile.doctor_email,
      doctor_phone: profile.doctor_phone,
      hospital_id: profile.hospital_id,
      specializations: profile.specializations,
      qualification: profile.qualification,
      license: profile.license,
      approval_status: profile.approval_status,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));
  }

  private buildPatientRows(
    patientProfiles: PatientProfileDoc[],
    userMap: Map<string, UserDoc>,
  ): AdminPortalLiveData['patient_database'] {
    return patientProfiles.map((profile) => {
      const user = userMap.get(profile.owner_uid);
      return {
        uid: profile.owner_uid,
        identifier: profile.global_patient_identifier,
        patient_name: `${profile.demographics.first_name} ${profile.demographics.last_name}`.trim(),
        email: profile.contact.email,
        phone: profile.contact.phone,
        blood_group: profile.blood_group,
        verification_status: user?.patientVerificationStatus ?? PATIENT_VERIFICATION_STATUS.PENDING,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    });
  }
}
