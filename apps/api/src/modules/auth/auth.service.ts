import { StatusCodes } from 'http-status-codes';
import type { DoctorProfileDoc, PatientProfileDoc, UserDoc } from '../../domain/models';
import { DOCTOR_APPROVAL_STATUS, PATIENT_VERIFICATION_STATUS, ROLES } from '../../domain/roles';
import { AppError } from '../../core/errors/AppError';
import type { UsersRepository } from '../common/users.repository';
import type { PatientsRepository } from '../common/patients.repository';
import type { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { generateUniquePatientIdentifier } from '../../utils/patientIdentifier';

type BootstrapInput = {
  role: 'patient' | 'doctor';
  displayName: string;
  phone?: string;
  hospitalId?: string;
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
  doctorProfile?: {
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
  };
};

type SessionActor = {
  uid: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  hospitalId?: string;
  doctorApprovalStatus: string;
};

export class AuthService {
  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly doctorProfilesRepository: DoctorProfilesRepository,
  ) {}

  public async bootstrap(actor: SessionActor, input: BootstrapInput): Promise<UserDoc> {
    if (input.role === ROLES.PATIENT && !input.patientProfile) {
      throw new AppError(
        'patientProfile is required for patient bootstrap',
        StatusCodes.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    }

    if (input.role === ROLES.DOCTOR && !input.doctorProfile) {
      throw new AppError(
        'doctorProfile is required for doctor bootstrap',
        StatusCodes.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    }

    const existing = await this.usersRepository.findByUid(actor.uid);
    if (existing) {
      if (input.role === ROLES.DOCTOR) {
        const doctorProfile = input.doctorProfile as NonNullable<BootstrapInput['doctorProfile']>;
        const persistedDoctorProfile = await this.upsertDoctorProfile(actor, doctorProfile);

        const needsUserUpdate =
          existing.role !== ROLES.DOCTOR ||
          existing.doctorApprovalStatus !== persistedDoctorProfile.approval_status ||
          existing.patientVerificationStatus !== PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE ||
          existing.displayName !== undefined ||
          existing.phone !== undefined ||
          existing.hospitalId !== undefined;

        if (needsUserUpdate) {
          const now = new Date().toISOString();
          const updatedUser: UserDoc = {
            ...existing,
            role: ROLES.DOCTOR,
            displayName: undefined,
            phone: undefined,
            hospitalId: undefined,
            doctorApprovalStatus: persistedDoctorProfile.approval_status,
            patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
            updatedAt: now,
          };
          await this.usersRepository.upsert(updatedUser);
          return updatedUser;
        }

        return existing;
      }

      if (existing.role === ROLES.PATIENT && input.role === ROLES.PATIENT) {
        const patientProfile = input.patientProfile as NonNullable<BootstrapInput['patientProfile']>;
        await this.upsertPatientProfile(actor, patientProfile);
        if (existing.patientVerificationStatus !== PATIENT_VERIFICATION_STATUS.VERIFIED) {
          const updatedPatientUser = {
            ...existing,
            patientVerificationStatus: PATIENT_VERIFICATION_STATUS.VERIFIED,
            updatedAt: new Date().toISOString(),
          };
          await this.usersRepository.upsert(updatedPatientUser);
          return updatedPatientUser;
        }
      }
      return existing;
    }

    const now = new Date().toISOString();
    const userDoc: UserDoc = {
      uid: actor.uid,
      email: actor.email.toLowerCase(),
      role: input.role,
      displayName: input.role === ROLES.DOCTOR ? undefined : input.displayName,
      phone: input.role === ROLES.DOCTOR ? undefined : input.phone,
      hospitalId: input.role === ROLES.DOCTOR ? undefined : input.hospitalId,
      doctorApprovalStatus:
        input.role === ROLES.DOCTOR
          ? DOCTOR_APPROVAL_STATUS.PENDING
          : DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
      patientVerificationStatus:
        input.role === ROLES.PATIENT
          ? PATIENT_VERIFICATION_STATUS.VERIFIED
          : PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
      createdAt: now,
      updatedAt: now,
    };

    const createdUser = await this.usersRepository.upsert(userDoc);
    if (input.role === ROLES.DOCTOR) {
      const doctorProfile = input.doctorProfile as NonNullable<BootstrapInput['doctorProfile']>;
      await this.upsertDoctorProfile(actor, doctorProfile);
    } else {
      const patientProfile = input.patientProfile as NonNullable<BootstrapInput['patientProfile']>;
      await this.upsertPatientProfile(actor, patientProfile);
    }
    return createdUser;
  }

  public async getSession(actor: SessionActor): Promise<UserDoc> {
    const existing = await this.usersRepository.findByUid(actor.uid);
    if (existing) {
      const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
      if (doctorProfile) {
        const shouldRepairUser =
          existing.role !== ROLES.DOCTOR ||
          existing.doctorApprovalStatus !== doctorProfile.approval_status ||
          existing.patientVerificationStatus !== PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE ||
          existing.displayName !== undefined ||
          existing.phone !== undefined ||
          existing.hospitalId !== undefined;

        const repairedUser: UserDoc = shouldRepairUser
          ? {
              ...existing,
              role: ROLES.DOCTOR,
              displayName: undefined,
              phone: undefined,
              hospitalId: undefined,
              doctorApprovalStatus: doctorProfile.approval_status,
              patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
              updatedAt: new Date().toISOString(),
            }
          : existing;

        if (shouldRepairUser) {
          await this.usersRepository.upsert(repairedUser);
        }

        return {
          ...repairedUser,
          displayName: doctorProfile.doctor_name,
          phone: doctorProfile.doctor_phone,
          hospitalId: doctorProfile.hospital_id,
          doctorApprovalStatus: doctorProfile.approval_status,
          patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
        };
      }

      if (
        existing.role === ROLES.PATIENT &&
        existing.patientVerificationStatus === PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE
      ) {
        const repairedPatientUser: UserDoc = {
          ...existing,
          patientVerificationStatus: PATIENT_VERIFICATION_STATUS.VERIFIED,
          updatedAt: new Date().toISOString(),
        };
        await this.usersRepository.upsert(repairedPatientUser);
        return repairedPatientUser;
      }

      return existing;
    }
    throw new AppError(
      'Account is not provisioned. Complete registration from the correct role portal.',
      StatusCodes.FORBIDDEN,
      'FORBIDDEN',
    );
  }

  private async upsertDoctorProfile(
    actor: SessionActor,
    profileInput: NonNullable<BootstrapInput['doctorProfile']>,
  ): Promise<DoctorProfileDoc> {
    const now = new Date().toISOString();
    const existing = await this.doctorProfilesRepository.findByUid(actor.uid);
    const createdAt = existing?.created_at ?? now;

    const doctorProfile: DoctorProfileDoc = {
      uid: actor.uid,
      doctor_name: profileInput.doctor_name,
      doctor_email: profileInput.doctor_email.toLowerCase(),
      doctor_phone: profileInput.doctor_phone,
      hospital_id: profileInput.hospital_id,
      hospital_logo_base64: profileInput.hospital_logo_base64,
      specializations: profileInput.specializations,
      qualification: profileInput.qualification,
      license: profileInput.license,
      profile_image_base64: profileInput.profile_image_base64,
      verification_docs_base64: profileInput.verification_docs_base64,
      approval_status: existing?.approval_status ?? DOCTOR_APPROVAL_STATUS.PENDING,
      created_at: createdAt,
      updated_at: now,
    };

    return this.doctorProfilesRepository.upsert(doctorProfile);
  }

  private async upsertPatientProfile(
    actor: SessionActor,
    profileInput: NonNullable<BootstrapInput['patientProfile']>,
  ): Promise<PatientProfileDoc> {
    const now = new Date().toISOString();
    const existing = await this.patientsRepository.findByOwnerUid(actor.uid);
    const createdAt = existing?.created_at ?? now;

    const patientProfile: PatientProfileDoc = {
      owner_uid: actor.uid,
      global_patient_identifier:
        existing?.global_patient_identifier ??
        (await generateUniquePatientIdentifier(this.patientsRepository)),
      demographics: profileInput.demographics,
      contact: {
        ...profileInput.contact,
        email: profileInput.contact.email.toLowerCase() || actor.email.toLowerCase(),
      },
      blood_group: profileInput.blood_group,
      allergies: profileInput.allergies,
      profile_image_base64: profileInput.profile_image_base64,
      aadhaar_card_base64: profileInput.aadhaar_card_base64,
      hereditary_history: profileInput.hereditary_history,
      created_at: createdAt,
      updated_at: now,
    };

    return this.patientsRepository.upsert(patientProfile);
  }
}
