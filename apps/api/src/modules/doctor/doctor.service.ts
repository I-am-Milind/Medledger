import { randomUUID } from 'node:crypto';
import type { Auth } from 'firebase-admin/auth';
import { StatusCodes } from 'http-status-codes';
import { firebaseAdminAuth } from '../../config/firebaseAdmin';
import type {
  AccessRequestDoc,
  DoctorProfileDoc,
  PatientProfileDoc,
  SupportRequestDoc,
  UserDoc,
  VisitDoc,
} from '../../domain/models';
import {
  ACCESS_REQUEST_STATUS,
  DOCTOR_APPROVAL_STATUS,
  PATIENT_VERIFICATION_STATUS,
  ROLES,
  SUPPORT_REQUEST_STATUS,
  type SupportRequestCategory,
  type TreatmentStatus,
} from '../../domain/roles';
import { AppError } from '../../core/errors/AppError';
import { generateUniquePatientIdentifier } from '../../utils/patientIdentifier';
import type { UsersRepository } from '../common/users.repository';
import type { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import type { PatientsRepository } from '../common/patients.repository';
import type { AccessRequestsRepository } from '../common/accessRequests.repository';
import type { VisitsRepository } from '../common/visits.repository';
import type { SupportRequestsRepository } from '../common/supportRequests.repository';

type SessionActor = {
  uid: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  hospitalId?: string;
  doctorApprovalStatus: string;
};

type DoctorProfileInput = {
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

type CreateAccessRequestInput = {
  patient_identifier: string;
  reason: string;
};

type CreateVisitInput = {
  patient_identifier: string;
  diagnosis: string;
  prescription: string;
  paper_prescription_image_base64?: string;
  clinical_reports_base64?: string[];
  reports_base64: string[];
  treatment_status: TreatmentStatus;
};

type CreateSupportRequestInput = {
  category: SupportRequestCategory;
  subject: string;
  message: string;
};

type UpdateVisitInput = Partial<Omit<CreateVisitInput, 'patient_identifier'>>;

type ExportPatientFilters = {
  date_from?: string;
  date_to?: string;
};

type VisitExportRow = {
  visit_id: string;
  visit_at: string;
  updated_at: string;
  patient_identifier: string;
  patient_name: string;
  patient_phone: string;
  hospital_id: string;
  doctor_name: string;
  doctor_phone: string;
  illness_or_problem: string;
  treatment_status: string;
  prescription_summary: string;
};

type MedicationExportRow = {
  visit_id: string;
  visit_at: string;
  patient_identifier: string;
  patient_name: string;
  medication_notes: string;
  doctor_name: string;
  hospital_id: string;
};

type AdmissionExportRow = {
  admission_id: string;
  visit_id: string;
  admitted_at: string;
  patient_identifier: string;
  patient_name: string;
  hospital_id: string;
  attending_doctor: string;
  treatment_status: string;
  discharge_state: string;
};

type ReportMetadataExportRow = {
  visit_id: string;
  visit_at: string;
  patient_identifier: string;
  patient_name: string;
  report_type: 'prescription' | 'clinical_report';
  file_kind: 'image' | 'pdf' | 'other';
  file_size_estimate_kb: number;
  index_in_visit: number;
};

type ExportPatientData = {
  patient: PatientProfileDoc;
  applied_filters: ExportPatientFilters;
  generated_at: string;
  visits: VisitExportRow[];
  medications: MedicationExportRow[];
  admissions: AdmissionExportRow[];
  report_metadata: ReportMetadataExportRow[];
};

type VisitedPatientSummary = {
  patient_uid: string;
  patient_identifier: string;
  patient_name: string;
  visit_count: number;
  latest_visit_at: string;
  latest_treatment_status: TreatmentStatus;
  latest_diagnosis: string;
  latest_hospital_id: string;
  hospital_ids: string[];
};

type CreateDoctorPatientInput = {
  temporary_password: string;
  patient_profile: {
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
  initial_visit?: {
    illness_or_problem: string;
    prescription: string;
    prescription_image_base64: string;
    reports_base64: string[];
    treatment_status: TreatmentStatus;
  };
};

function assertDoctorAccess(actor: SessionActor): void {
  if (actor.role !== ROLES.DOCTOR) {
    throw new AppError('Doctor role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
  if (actor.doctorApprovalStatus !== DOCTOR_APPROVAL_STATUS.APPROVED) {
    throw new AppError(
      'Doctor account is pending admin verification',
      StatusCodes.FORBIDDEN,
      'FORBIDDEN',
      { approvalStatus: actor.doctorApprovalStatus },
    );
  }
  if (!actor.hospitalId) {
    throw new AppError('Doctor is not attached to a hospital', StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
}

function parseIsoDate(date: string | undefined, endOfDay: boolean): number | null {
  if (!date) return null;
  const normalized = endOfDay ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`;
  const value = Date.parse(normalized);
  if (Number.isNaN(value)) return null;
  return value;
}

function extractMedicationSummary(prescription: string): string {
  const lines = prescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        !line.toLowerCase().startsWith('prescription for:') &&
        !line.toLowerCase().startsWith('vitals snapshot'),
    );
  if (lines.length === 0) {
    return 'No medication text captured';
  }
  return lines.slice(0, 8).join(' | ');
}

function reportKind(value: string): 'image' | 'pdf' | 'other' {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('data:image/')) return 'image';
  if (normalized.startsWith('data:application/pdf')) return 'pdf';
  if (normalized.startsWith('ivborw0kggo') || normalized.startsWith('/9j/')) return 'image';
  if (normalized.startsWith('jvber')) return 'pdf';
  return 'other';
}

function estimateBase64Bytes(value: string): number {
  const trimmed = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const clean = trimmed.replace(/\s+/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function splitVisitAttachments(visit: VisitDoc): {
  prescription_image: string;
  clinical_reports: string[];
} {
  const explicitPrescription = visit.paper_prescription_image_base64?.trim() ?? '';
  const explicitClinical = (visit.clinical_reports_base64 ?? []).filter((item) => item.trim().length > 0);
  if (explicitPrescription || explicitClinical.length > 0) {
    return {
      prescription_image: explicitPrescription,
      clinical_reports: explicitClinical,
    };
  }

  const normalized = (visit.reports_base64 ?? []).filter((item) => item.trim().length > 0);
  return {
    prescription_image: normalized[0] ?? '',
    clinical_reports: normalized.slice(1),
  };
}

export class DoctorService {
  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly doctorProfilesRepository: DoctorProfilesRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly accessRequestsRepository: AccessRequestsRepository,
    private readonly visitsRepository: VisitsRepository,
    private readonly supportRequestsRepository: SupportRequestsRepository,
    private readonly firebaseAuth: Auth = firebaseAdminAuth,
  ) {}

  private async resolveDoctorProfileMap(doctorUids: string[]): Promise<Map<string, {
    doctor_name: string;
    doctor_phone: string;
    hospital_logo_base64: string;
  }>> {
    const uniqueDoctorUids = [...new Set(doctorUids.filter((item) => item.trim().length > 0))];
    if (uniqueDoctorUids.length === 0) {
      return new Map();
    }

    const profileEntries = await Promise.all(
      uniqueDoctorUids.map(async (doctorUid) => {
        const profile = await this.doctorProfilesRepository.findByUid(doctorUid);
        if (!profile) {
          return null;
        }
        return [
          doctorUid,
          {
            doctor_name: profile.doctor_name,
            doctor_phone: profile.doctor_phone,
            hospital_logo_base64: profile.hospital_logo_base64,
          },
        ] as const;
      }),
    );

    return new Map(profileEntries.filter((item): item is NonNullable<typeof item> => Boolean(item)));
  }

  public async getProfile(actor: SessionActor): Promise<DoctorProfileDoc | null> {
    return this.doctorProfilesRepository.findByUid(actor.uid);
  }

  public async apply(actor: SessionActor, input: DoctorProfileInput): Promise<DoctorProfileDoc> {
    const now = new Date().toISOString();
    const existingProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    const approvalStatus = existingProfile?.approval_status ?? DOCTOR_APPROVAL_STATUS.PENDING;
    const doctorProfile: DoctorProfileDoc = {
      uid: actor.uid,
      doctor_name: input.doctor_name,
      doctor_email: input.doctor_email.toLowerCase(),
      doctor_phone: input.doctor_phone,
      hospital_id: input.hospital_id,
      hospital_logo_base64: input.hospital_logo_base64,
      specializations: input.specializations,
      qualification: input.qualification,
      license: input.license,
      profile_image_base64: input.profile_image_base64,
      verification_docs_base64: input.verification_docs_base64,
      approval_status: approvalStatus,
      created_at: existingProfile?.created_at ?? now,
      updated_at: now,
    };

    await this.usersRepository.upsert({
      uid: actor.uid,
      email: actor.email.toLowerCase(),
      role: ROLES.DOCTOR,
      doctorApprovalStatus: approvalStatus,
      patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
      createdAt: now,
      updatedAt: now,
    });

    return this.doctorProfilesRepository.upsert(doctorProfile);
  }

  public async updateProfile(actor: SessionActor, input: DoctorProfileInput): Promise<DoctorProfileDoc> {
    if (actor.role !== ROLES.DOCTOR) {
      throw new AppError('Doctor role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }

    const existing = await this.doctorProfilesRepository.findByUid(actor.uid);
    if (!existing) {
      throw new AppError('Doctor profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const updated: DoctorProfileDoc = {
      ...existing,
      doctor_name: input.doctor_name,
      doctor_email: input.doctor_email.toLowerCase(),
      doctor_phone: input.doctor_phone,
      hospital_id: input.hospital_id,
      hospital_logo_base64: input.hospital_logo_base64,
      specializations: input.specializations,
      qualification: input.qualification,
      license: input.license,
      profile_image_base64: input.profile_image_base64,
      verification_docs_base64: input.verification_docs_base64,
      updated_at: new Date().toISOString(),
    };

    await this.usersRepository.upsert({
      uid: actor.uid,
      email: actor.email.toLowerCase(),
      role: ROLES.DOCTOR,
      doctorApprovalStatus: updated.approval_status,
      patientVerificationStatus: PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
      createdAt: existing.created_at,
      updatedAt: updated.updated_at,
    });

    return this.doctorProfilesRepository.upsert(updated);
  }

  public async searchPatients(actor: SessionActor, query: string) {
    assertDoctorAccess(actor);

    const attempts = new Map<string, Awaited<ReturnType<PatientsRepository['findByOwnerUid']>>>();

    const [byIdentifier, byUid, byEmailUser, byPhoneUser] = await Promise.all([
      this.patientsRepository.findByIdentifier(query),
      this.patientsRepository.findByOwnerUid(query),
      query.includes('@') ? this.usersRepository.findByEmail(query) : Promise.resolve(null),
      this.usersRepository.findByPhone(query),
    ]);

    if (byIdentifier) {
      attempts.set(byIdentifier.owner_uid, byIdentifier);
    }

    if (byUid) {
      attempts.set(byUid.owner_uid, byUid);
    }

    const [profileFromEmail, profileFromPhone] = await Promise.all([
      byEmailUser?.role === ROLES.PATIENT
        ? this.patientsRepository.findByOwnerUid(byEmailUser.uid)
        : Promise.resolve(null),
      byPhoneUser?.role === ROLES.PATIENT
        ? this.patientsRepository.findByOwnerUid(byPhoneUser.uid)
        : Promise.resolve(null),
    ]);

    if (profileFromEmail) {
      attempts.set(profileFromEmail.owner_uid, profileFromEmail);
    }

    if (profileFromPhone) {
      attempts.set(profileFromPhone.owner_uid, profileFromPhone);
    }

    const patients = [...attempts.values()].filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    );

    const results = await Promise.all(
      patients.map(async (patient) => {
        const access = await this.accessRequestsRepository.findByDoctorAndPatient(actor.uid, patient.owner_uid);
        return {
          patient_uid: patient.owner_uid,
          patient_identifier: patient.global_patient_identifier,
          demographics: patient.demographics,
          blood_group: patient.blood_group,
          allergies: patient.allergies,
          access_status: access?.status ?? ACCESS_REQUEST_STATUS.WAITING,
          contact:
            access?.status === ACCESS_REQUEST_STATUS.APPROVED
              ? {
                  email: patient.contact.email,
                  phone: patient.contact.phone,
                }
              : {
                  email: '',
                  phone: '',
                },
        };
      }),
    );

    return results;
  }

  public async createAccessRequest(actor: SessionActor, input: CreateAccessRequestInput): Promise<AccessRequestDoc> {
    assertDoctorAccess(actor);

    const patient = await this.patientsRepository.findByIdentifier(input.patient_identifier);
    if (!patient) {
      throw new AppError('Patient not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const existing = await this.accessRequestsRepository.findByDoctorAndPatient(actor.uid, patient.owner_uid);
    if (existing && existing.status === ACCESS_REQUEST_STATUS.WAITING) {
      return existing;
    }

    const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    const now = new Date().toISOString();
    const accessRequest: AccessRequestDoc = {
      id: randomUUID(),
      doctor_uid: actor.uid,
      doctor_hospital_id: actor.hospitalId!,
      doctor_name: doctorProfile?.doctor_name ?? '',
      doctor_phone: doctorProfile?.doctor_phone ?? '',
      hospital_logo_base64: doctorProfile?.hospital_logo_base64 ?? '',
      patient_uid: patient.owner_uid,
      patient_identifier: patient.global_patient_identifier,
      reason: input.reason,
      status: ACCESS_REQUEST_STATUS.WAITING,
      created_at: now,
      updated_at: now,
    };

    return this.accessRequestsRepository.create(accessRequest);
  }

  public async listAccessRequests(actor: SessionActor) {
    assertDoctorAccess(actor);
    const requests = await this.accessRequestsRepository.listForDoctor(actor.uid);
    const missingDoctorInfoUids = requests
      .filter((item) => !item.doctor_name || !item.doctor_phone || !item.hospital_logo_base64)
      .map((item) => item.doctor_uid);
    const doctorProfileMap = await this.resolveDoctorProfileMap(missingDoctorInfoUids);

    return requests.map((request) => {
      if (request.doctor_name && request.doctor_phone && request.hospital_logo_base64) {
        return request;
      }
      const doctorProfile = doctorProfileMap.get(request.doctor_uid);
      return {
        ...request,
        doctor_name: request.doctor_name || doctorProfile?.doctor_name || '',
        doctor_phone: request.doctor_phone || doctorProfile?.doctor_phone || '',
        hospital_logo_base64:
          request.hospital_logo_base64 || doctorProfile?.hospital_logo_base64 || '',
      };
    });
  }

  public async listVisitedPatients(actor: SessionActor): Promise<VisitedPatientSummary[]> {
    assertDoctorAccess(actor);
    const visits = await this.visitsRepository.listByDoctor(actor.uid);
    if (visits.length === 0) {
      return [];
    }

    const grouped = new Map<
      string,
      {
        patient_uid: string;
        patient_identifier: string;
        visit_count: number;
        latest_visit: VisitDoc;
        hospital_ids: Set<string>;
      }
    >();

    visits.forEach((visit) => {
      const key = `${visit.patient_uid}:${visit.patient_identifier}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          patient_uid: visit.patient_uid,
          patient_identifier: visit.patient_identifier,
          visit_count: 1,
          latest_visit: visit,
          hospital_ids: new Set([visit.hospital_id]),
        });
        return;
      }

      current.visit_count += 1;
      current.hospital_ids.add(visit.hospital_id);
      if (visit.created_at.localeCompare(current.latest_visit.created_at) > 0) {
        current.latest_visit = visit;
      }
    });

    const patientUids = [...new Set([...grouped.values()].map((item) => item.patient_uid))];
    const patientProfiles = await Promise.all(
      patientUids.map(async (patientUid) => {
        const profile = await this.patientsRepository.findByOwnerUid(patientUid);
        return [patientUid, profile] as const;
      }),
    );
    const patientProfileMap = new Map(patientProfiles);

    return [...grouped.values()]
      .map((entry) => {
        const patientProfile = patientProfileMap.get(entry.patient_uid);
        const patientName = patientProfile
          ? `${patientProfile.demographics.first_name} ${patientProfile.demographics.last_name}`.trim()
          : 'Unknown patient';
        return {
          patient_uid: entry.patient_uid,
          patient_identifier: entry.patient_identifier,
          patient_name: patientName || 'Unknown patient',
          visit_count: entry.visit_count,
          latest_visit_at: entry.latest_visit.created_at,
          latest_treatment_status: entry.latest_visit.treatment_status,
          latest_diagnosis: entry.latest_visit.diagnosis,
          latest_hospital_id: entry.latest_visit.hospital_id,
          hospital_ids: [...entry.hospital_ids].sort((a, b) => a.localeCompare(b)),
        };
      })
      .sort((left, right) => right.latest_visit_at.localeCompare(left.latest_visit_at));
  }

  public async createPatient(actor: SessionActor, input: CreateDoctorPatientInput): Promise<{
    user: UserDoc;
    profile: PatientProfileDoc;
    access_request: AccessRequestDoc;
    initial_visit: VisitDoc | null;
  }> {
    assertDoctorAccess(actor);

    const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    if (!doctorProfile) {
      throw new AppError('Doctor profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const now = new Date().toISOString();
    const normalizedEmail = input.patient_profile.contact.email.trim().toLowerCase();
    const normalizedPhone = input.patient_profile.contact.phone.trim();
    const displayName = `${input.patient_profile.demographics.first_name} ${input.patient_profile.demographics.last_name}`
      .trim();

    const [existingByEmail, existingByPhone] = await Promise.all([
      this.usersRepository.findByEmail(normalizedEmail),
      this.usersRepository.findByPhone(normalizedPhone),
    ]);

    if (existingByEmail) {
      throw new AppError('Email is already registered.', StatusCodes.CONFLICT, 'CONFLICT');
    }

    if (existingByPhone) {
      throw new AppError('Phone number is already registered.', StatusCodes.CONFLICT, 'CONFLICT');
    }

    let createdUid = '';
    try {
      const authUser = await this.firebaseAuth.createUser({
        email: normalizedEmail,
        password: input.temporary_password,
        displayName,
        emailVerified: true,
        disabled: false,
      });
      createdUid = authUser.uid;

      const userDoc: UserDoc = {
        uid: createdUid,
        email: normalizedEmail,
        role: ROLES.PATIENT,
        displayName,
        phone: normalizedPhone,
        doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
        patientVerificationStatus: PATIENT_VERIFICATION_STATUS.VERIFIED,
        createdAt: now,
        updatedAt: now,
      };

      const patientIdentifier = await generateUniquePatientIdentifier(this.patientsRepository);
      const patientProfile: PatientProfileDoc = {
        owner_uid: createdUid,
        global_patient_identifier: patientIdentifier,
        demographics: input.patient_profile.demographics,
        contact: {
          ...input.patient_profile.contact,
          email: normalizedEmail,
          phone: normalizedPhone,
        },
        blood_group: input.patient_profile.blood_group,
        allergies: input.patient_profile.allergies,
        profile_image_base64: input.patient_profile.profile_image_base64,
        aadhaar_card_base64: input.patient_profile.aadhaar_card_base64,
        hereditary_history: input.patient_profile.hereditary_history,
        created_by: {
          doctor_uid: actor.uid,
          doctor_name: doctorProfile.doctor_name,
          hospital_id: actor.hospitalId!,
          created_at: now,
        },
        created_at: now,
        updated_at: now,
      };

      await this.usersRepository.upsert(userDoc);
      await this.patientsRepository.upsert(patientProfile);

      const autoApprovedAccess: AccessRequestDoc = {
        id: randomUUID(),
        doctor_uid: actor.uid,
        doctor_hospital_id: actor.hospitalId!,
        doctor_name: doctorProfile.doctor_name,
        doctor_phone: doctorProfile.doctor_phone,
        hospital_logo_base64: doctorProfile.hospital_logo_base64,
        patient_uid: createdUid,
        patient_identifier: patientIdentifier,
        reason: 'Patient onboarded by treating doctor.',
        status: ACCESS_REQUEST_STATUS.APPROVED,
        created_at: now,
        updated_at: now,
      };
      await this.accessRequestsRepository.create(autoApprovedAccess);

      const initialVisitInput = input.initial_visit;
      const hasInitialVisit =
        Boolean(initialVisitInput?.illness_or_problem.trim()) ||
        Boolean(initialVisitInput?.prescription.trim()) ||
        Boolean(initialVisitInput?.prescription_image_base64.trim()) ||
        Boolean(initialVisitInput && initialVisitInput.reports_base64.length > 0);

      let initialVisit: VisitDoc | null = null;
      if (hasInitialVisit && initialVisitInput) {
        const prescriptionImage = initialVisitInput.prescription_image_base64.trim();
        const clinicalReports = initialVisitInput.reports_base64.filter((item) => item.trim().length > 0);
        const reportPayload = [prescriptionImage, ...clinicalReports].filter((item) => item.trim().length > 0);

        initialVisit = {
          id: randomUUID(),
          patient_uid: createdUid,
          patient_identifier: patientIdentifier,
          doctor_uid: actor.uid,
          doctor_name: doctorProfile.doctor_name,
          doctor_phone: doctorProfile.doctor_phone,
          hospital_logo_base64: doctorProfile.hospital_logo_base64,
          hospital_id: actor.hospitalId!,
          diagnosis: initialVisitInput.illness_or_problem.trim() || 'Initial onboarding',
          prescription: initialVisitInput.prescription.trim() || 'Initial consultation record',
          paper_prescription_image_base64: prescriptionImage,
          clinical_reports_base64: clinicalReports,
          reports_base64: reportPayload,
          treatment_status: initialVisitInput.treatment_status,
          created_at: now,
          updated_at: now,
        };
        await this.visitsRepository.create(initialVisit);
      }

      return {
        user: userDoc,
        profile: patientProfile,
        access_request: autoApprovedAccess,
        initial_visit: initialVisit,
      };
    } catch (error) {
      if (createdUid) {
        try {
          await this.firebaseAuth.deleteUser(createdUid);
        } catch {
          // no-op cleanup failure
        }
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'auth/email-already-exists'
      ) {
        throw new AppError('Email is already registered.', StatusCodes.CONFLICT, 'CONFLICT');
      }

      throw error;
    }
  }

  public async createSupportRequest(
    actor: SessionActor,
    input: CreateSupportRequestInput,
  ): Promise<SupportRequestDoc> {
    if (actor.role !== ROLES.DOCTOR) {
      throw new AppError('Doctor role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }

    const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    const now = new Date().toISOString();
    const ticket: SupportRequestDoc = {
      id: randomUUID(),
      actor_uid: actor.uid,
      actor_role: ROLES.DOCTOR,
      actor_name: doctorProfile?.doctor_name ?? '',
      actor_email: actor.email.toLowerCase(),
      actor_phone: doctorProfile?.doctor_phone ?? '',
      hospital_id: doctorProfile?.hospital_id ?? actor.hospitalId ?? '',
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: SUPPORT_REQUEST_STATUS.OPEN,
      created_at: now,
      updated_at: now,
    };

    return this.supportRequestsRepository.create(ticket);
  }

  public async listSupportRequests(actor: SessionActor): Promise<SupportRequestDoc[]> {
    if (actor.role !== ROLES.DOCTOR) {
      throw new AppError('Doctor role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }
    return this.supportRequestsRepository.listByActor(actor.uid);
  }

  public async lookupPatientByIdentifier(actor: SessionActor, identifier: string) {
    if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
      throw new AppError('Doctor or admin role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }

    const patient = await this.patientsRepository.findByIdentifier(identifier);
    if (!patient) {
      throw new AppError('Patient not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    if (actor.role === ROLES.DOCTOR) {
      assertDoctorAccess(actor);
      const access = await this.accessRequestsRepository.findByDoctorAndPatient(actor.uid, patient.owner_uid);
      if (!access || access.status !== ACCESS_REQUEST_STATUS.APPROVED) {
        throw new AppError(
          'Doctor has no approved access to this patient',
          StatusCodes.FORBIDDEN,
          'FORBIDDEN',
        );
      }
    }

    const visits = await this.visitsRepository.listByPatient(patient.owner_uid);
    const doctorProfileMap = await this.resolveDoctorProfileMap(visits.map((visit) => visit.doctor_uid));

    return {
      patient,
      visits: visits.map((visit) => {
        const doctorProfile = doctorProfileMap.get(visit.doctor_uid);
        return {
          ...visit,
          doctor_name: doctorProfile?.doctor_name ?? '',
          doctor_phone: doctorProfile?.doctor_phone ?? '',
          hospital_logo_base64: doctorProfile?.hospital_logo_base64 ?? '',
        };
      }),
    };
  }

  public async createVisit(actor: SessionActor, input: CreateVisitInput): Promise<VisitDoc> {
    assertDoctorAccess(actor);

    const patient = await this.patientsRepository.findByIdentifier(input.patient_identifier);
    if (!patient) {
      throw new AppError('Patient not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const access = await this.accessRequestsRepository.findByDoctorAndPatient(actor.uid, patient.owner_uid);
    if (!access || access.status !== ACCESS_REQUEST_STATUS.APPROVED) {
      throw new AppError(
        'Doctor has no approved access to patient records',
        StatusCodes.FORBIDDEN,
        'FORBIDDEN',
      );
    }

    const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    const now = new Date().toISOString();
    const explicitPrescriptionImage = input.paper_prescription_image_base64?.trim() ?? '';
    const prescriptionImage =
      explicitPrescriptionImage || input.reports_base64[0]?.trim() || '';
    const clinicalReports =
      input.clinical_reports_base64 && input.clinical_reports_base64.length > 0
        ? input.clinical_reports_base64.filter((item) => item.trim().length > 0)
        : input.reports_base64
            .slice(explicitPrescriptionImage ? 0 : prescriptionImage ? 1 : 0)
            .filter((item) => item.trim().length > 0);
    const normalizedReports = [prescriptionImage, ...clinicalReports]
      .filter((item) => item.trim().length > 0);
    const visit: VisitDoc = {
      id: randomUUID(),
      patient_uid: patient.owner_uid,
      patient_identifier: patient.global_patient_identifier,
      doctor_uid: actor.uid,
      doctor_name: doctorProfile?.doctor_name ?? '',
      doctor_phone: doctorProfile?.doctor_phone ?? '',
      hospital_logo_base64: doctorProfile?.hospital_logo_base64 ?? '',
      hospital_id: actor.hospitalId!,
      diagnosis: input.diagnosis,
      prescription: input.prescription,
      paper_prescription_image_base64: prescriptionImage,
      clinical_reports_base64: clinicalReports,
      reports_base64: normalizedReports,
      treatment_status: input.treatment_status,
      created_at: now,
      updated_at: now,
    };

    return this.visitsRepository.create(visit);
  }

  public async updateVisit(actor: SessionActor, visitId: string, input: UpdateVisitInput): Promise<VisitDoc> {
    assertDoctorAccess(actor);

    const existing = await this.visitsRepository.findById(visitId);
    if (!existing) {
      throw new AppError('Visit not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    if (existing.hospital_id !== actor.hospitalId) {
      throw new AppError(
        'Doctor cannot modify records outside own hospital',
        StatusCodes.FORBIDDEN,
        'FORBIDDEN',
      );
    }

    const access = await this.accessRequestsRepository.findByDoctorAndPatient(actor.uid, existing.patient_uid);
    if (!access || access.status !== ACCESS_REQUEST_STATUS.APPROVED) {
      throw new AppError(
        'Doctor has no approved access to patient records',
        StatusCodes.FORBIDDEN,
        'FORBIDDEN',
      );
    }

    const doctorProfile = await this.doctorProfilesRepository.findByUid(actor.uid);
    const previousAttachmentState = splitVisitAttachments(existing);
    const nextPrescriptionImage =
      input.paper_prescription_image_base64 !== undefined
        ? input.paper_prescription_image_base64
        : previousAttachmentState.prescription_image;
    const nextClinicalReports =
      input.clinical_reports_base64 !== undefined
        ? input.clinical_reports_base64
        : input.reports_base64 !== undefined
          ? input.reports_base64
          : previousAttachmentState.clinical_reports;
    const nextReports = [nextPrescriptionImage, ...(nextClinicalReports ?? [])].filter(
      (item) => item.trim().length > 0,
    );

    const updated: VisitDoc = {
      ...existing,
      diagnosis: input.diagnosis ?? existing.diagnosis,
      prescription: input.prescription ?? existing.prescription,
      paper_prescription_image_base64: nextPrescriptionImage,
      clinical_reports_base64: nextClinicalReports,
      reports_base64: nextReports,
      treatment_status: input.treatment_status ?? existing.treatment_status,
      doctor_name: existing.doctor_name || doctorProfile?.doctor_name || '',
      doctor_phone: existing.doctor_phone || doctorProfile?.doctor_phone || '',
      hospital_logo_base64:
        existing.hospital_logo_base64 || doctorProfile?.hospital_logo_base64 || '',
      updated_at: new Date().toISOString(),
    };

    return this.visitsRepository.update(updated);
  }

  public async exportPatientData(
    actor: SessionActor,
    identifier: string,
    filters: ExportPatientFilters,
  ): Promise<ExportPatientData> {
    const lookup = await this.lookupPatientByIdentifier(actor, identifier);
    const patient = lookup.patient;

    const fromMs = parseIsoDate(filters.date_from, false);
    const toMs = parseIsoDate(filters.date_to, true);
    const filteredVisits = lookup.visits
      .filter((visit) => {
        const createdAtMs = Date.parse(visit.created_at);
        if (Number.isNaN(createdAtMs)) return false;
        if (fromMs !== null && createdAtMs < fromMs) return false;
        if (toMs !== null && createdAtMs > toMs) return false;
        return true;
      })
      .sort((left, right) => left.created_at.localeCompare(right.created_at));

    const patientName = `${patient.demographics.first_name} ${patient.demographics.last_name}`.trim();
    const patientPhone = patient.contact.phone;

    const visits: VisitExportRow[] = filteredVisits.map((visit) => ({
      visit_id: visit.id,
      visit_at: visit.created_at,
      updated_at: visit.updated_at,
      patient_identifier: patient.global_patient_identifier,
      patient_name: patientName,
      patient_phone: patientPhone,
      hospital_id: visit.hospital_id,
      doctor_name: visit.doctor_name || visit.doctor_uid,
      doctor_phone: visit.doctor_phone || '',
      illness_or_problem: visit.diagnosis,
      treatment_status: visit.treatment_status,
      prescription_summary: extractMedicationSummary(visit.prescription),
    }));

    const medications: MedicationExportRow[] = filteredVisits.map((visit) => ({
      visit_id: visit.id,
      visit_at: visit.created_at,
      patient_identifier: patient.global_patient_identifier,
      patient_name: patientName,
      medication_notes: extractMedicationSummary(visit.prescription),
      doctor_name: visit.doctor_name || visit.doctor_uid,
      hospital_id: visit.hospital_id,
    }));

    const admissions: AdmissionExportRow[] = filteredVisits.map((visit) => ({
      admission_id: `ADM-${visit.id}`,
      visit_id: visit.id,
      admitted_at: visit.created_at,
      patient_identifier: patient.global_patient_identifier,
      patient_name: patientName,
      hospital_id: visit.hospital_id,
      attending_doctor: visit.doctor_name || visit.doctor_uid,
      treatment_status: visit.treatment_status,
      discharge_state:
        visit.treatment_status === 'completed' || visit.treatment_status === 'one_time_complete'
          ? 'closed'
          : 'active',
    }));

    const report_metadata: ReportMetadataExportRow[] = filteredVisits.flatMap((visit) => {
      const attachments = splitVisitAttachments(visit);
      const rows: ReportMetadataExportRow[] = [];
      if (attachments.prescription_image) {
        rows.push({
          visit_id: visit.id,
          visit_at: visit.created_at,
          patient_identifier: patient.global_patient_identifier,
          patient_name: patientName,
          report_type: 'prescription',
          file_kind: reportKind(attachments.prescription_image),
          file_size_estimate_kb: Number(
            (estimateBase64Bytes(attachments.prescription_image) / 1024).toFixed(2),
          ),
          index_in_visit: 1,
        });
      }
      attachments.clinical_reports.forEach((report, index) => {
        rows.push({
          visit_id: visit.id,
          visit_at: visit.created_at,
          patient_identifier: patient.global_patient_identifier,
          patient_name: patientName,
          report_type: 'clinical_report',
          file_kind: reportKind(report),
          file_size_estimate_kb: Number((estimateBase64Bytes(report) / 1024).toFixed(2)),
          index_in_visit: index + 1,
        });
      });
      return rows;
    });

    return {
      patient,
      applied_filters: filters,
      generated_at: new Date().toISOString(),
      visits,
      medications,
      admissions,
      report_metadata,
    };
  }
}
