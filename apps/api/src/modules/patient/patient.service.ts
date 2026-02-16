import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import type { AccessRequestStatus, SupportRequestCategory } from '../../domain/roles';
import { SUPPORT_REQUEST_STATUS } from '../../domain/roles';
import type { PatientProfileDoc, SupportRequestDoc } from '../../domain/models';
import { AppError } from '../../core/errors/AppError';
import type { PatientsRepository } from '../common/patients.repository';
import type { AccessRequestsRepository } from '../common/accessRequests.repository';
import type { VisitsRepository } from '../common/visits.repository';
import type { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import type { SupportRequestsRepository } from '../common/supportRequests.repository';

type UpdatePatientProfileInput = Omit<
  PatientProfileDoc,
  'owner_uid' | 'global_patient_identifier' | 'created_at' | 'updated_at'
>;

type CreateSupportRequestInput = {
  category: SupportRequestCategory;
  subject: string;
  message: string;
};

export class PatientService {
  public constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly accessRequestsRepository: AccessRequestsRepository,
    private readonly visitsRepository: VisitsRepository,
    private readonly doctorProfilesRepository: DoctorProfilesRepository,
    private readonly supportRequestsRepository: SupportRequestsRepository,
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

  public async getProfile(ownerUid: string, email: string): Promise<PatientProfileDoc> {
    void email;
    const existing = await this.patientsRepository.findByOwnerUid(ownerUid);
    if (existing) {
      return existing;
    }

    throw new AppError('Patient profile not found. Complete registration first.', StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }

  public async updateProfile(
    ownerUid: string,
    payload: UpdatePatientProfileInput,
  ): Promise<PatientProfileDoc> {
    const current = await this.patientsRepository.findByOwnerUid(ownerUid);
    if (!current) {
      throw new AppError('Patient profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const updated: PatientProfileDoc = {
      ...current,
      demographics: payload.demographics,
      contact: payload.contact,
      blood_group: payload.blood_group,
      allergies: payload.allergies,
      profile_image_base64: payload.profile_image_base64,
      aadhaar_card_base64: payload.aadhaar_card_base64,
      hereditary_history: payload.hereditary_history,
      updated_at: new Date().toISOString(),
    };

    return this.patientsRepository.upsert(updated);
  }

  public async listAccessRequests(patientUid: string) {
    const requests = await this.accessRequestsRepository.listForPatient(patientUid);
    const missingDoctorInfoUids = requests
      .filter((request) => !request.doctor_name || !request.doctor_phone || !request.hospital_logo_base64)
      .map((request) => request.doctor_uid);
    const doctorProfileMap = await this.resolveDoctorProfileMap(missingDoctorInfoUids);

    return requests.map((request) => {
      const doctorProfile = doctorProfileMap.get(request.doctor_uid);
      return {
        ...request,
        doctor_name: request.doctor_name || doctorProfile?.doctor_name || '',
        doctor_phone: request.doctor_phone || doctorProfile?.doctor_phone || '',
        hospital_logo_base64: request.hospital_logo_base64 || doctorProfile?.hospital_logo_base64 || '',
      };
    });
  }

  public async decideAccessRequest(
    patientUid: string,
    requestId: string,
    status: AccessRequestStatus,
  ) {
    const existing = await this.accessRequestsRepository.findById(requestId);
    if (!existing) {
      throw new AppError('Access request not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    if (existing.patient_uid !== patientUid) {
      throw new AppError('Cannot manage access for another patient', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }

    existing.status = status;
    existing.updated_at = new Date().toISOString();
    return this.accessRequestsRepository.update(existing);
  }

  public async listVisits(patientUid: string) {
    const visits = await this.visitsRepository.listByPatient(patientUid);
    const missingDoctorInfoUids = visits
      .filter((visit) => !visit.doctor_name || !visit.doctor_phone || !visit.hospital_logo_base64)
      .map((visit) => visit.doctor_uid);
    const doctorProfileMap = await this.resolveDoctorProfileMap(missingDoctorInfoUids);

    return visits.map((visit) => {
      const doctorProfile = doctorProfileMap.get(visit.doctor_uid);
      return {
        ...visit,
        doctor_name: visit.doctor_name || doctorProfile?.doctor_name || '',
        doctor_phone: visit.doctor_phone || doctorProfile?.doctor_phone || '',
        hospital_logo_base64: visit.hospital_logo_base64 || doctorProfile?.hospital_logo_base64 || '',
      };
    });
  }

  public async createSupportRequest(
    actor: { uid: string; email: string; role: 'patient' | 'doctor' | 'admin' },
    input: CreateSupportRequestInput,
  ): Promise<SupportRequestDoc> {
    if (actor.role !== 'patient') {
      throw new AppError('Patient role required', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }

    const profile = await this.patientsRepository.findByOwnerUid(actor.uid);
    if (!profile) {
      throw new AppError('Patient profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const now = new Date().toISOString();
    const ticket: SupportRequestDoc = {
      id: randomUUID(),
      actor_uid: actor.uid,
      actor_role: 'patient',
      actor_name: `${profile.demographics.first_name} ${profile.demographics.last_name}`.trim(),
      actor_email: profile.contact.email || actor.email.toLowerCase(),
      actor_phone: profile.contact.phone || '',
      hospital_id: '',
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: SUPPORT_REQUEST_STATUS.OPEN,
      created_at: now,
      updated_at: now,
    };

    return this.supportRequestsRepository.create(ticket);
  }

  public async listSupportRequests(patientUid: string): Promise<SupportRequestDoc[]> {
    return this.supportRequestsRepository.listByActor(patientUid);
  }
}
