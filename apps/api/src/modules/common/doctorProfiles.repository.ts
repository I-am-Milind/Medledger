import type { Firestore } from 'firebase-admin/firestore';
import type { DoctorProfileDoc } from '../../domain/models';
import { DOCTOR_APPROVAL_STATUS } from '../../domain/roles';
import { COLLECTIONS } from './collections';

function normalizeSpecializations(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }
  return [];
}

function normalizeDoctorProfileDoc(raw: unknown): DoctorProfileDoc {
  const record = (raw ?? {}) as Partial<DoctorProfileDoc> & { specialization?: unknown };

  return {
    uid: record.uid ?? '',
    doctor_name: record.doctor_name ?? '',
    doctor_email: record.doctor_email ?? '',
    doctor_phone: record.doctor_phone ?? '',
    hospital_id: record.hospital_id ?? '',
    hospital_logo_base64: record.hospital_logo_base64 ?? '',
    specializations: normalizeSpecializations(record.specializations ?? record.specialization),
    qualification: record.qualification ?? '',
    license: record.license ?? '',
    profile_image_base64: record.profile_image_base64 ?? '',
    verification_docs_base64: Array.isArray(record.verification_docs_base64)
      ? record.verification_docs_base64.filter((item): item is string => typeof item === 'string')
      : [],
    approval_status: record.approval_status ?? DOCTOR_APPROVAL_STATUS.PENDING,
    created_at: record.created_at ?? new Date(0).toISOString(),
    updated_at: record.updated_at ?? new Date(0).toISOString(),
  };
}

export class DoctorProfilesRepository {
  public constructor(private readonly db: Firestore) {}

  public async findByUid(uid: string): Promise<DoctorProfileDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.DOCTOR_PROFILES).doc(uid).get();
    if (!snapshot.exists) {
      return null;
    }
    return normalizeDoctorProfileDoc(snapshot.data());
  }

  public async upsert(profile: DoctorProfileDoc): Promise<DoctorProfileDoc> {
    await this.db.collection(COLLECTIONS.DOCTOR_PROFILES).doc(profile.uid).set(profile, { merge: true });
    return profile;
  }

  public async listByApprovalStatus(status: DoctorProfileDoc['approval_status']): Promise<DoctorProfileDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.DOCTOR_PROFILES)
      .where('approval_status', '==', status)
      .get();
    return snapshot.docs
      .map((doc) => normalizeDoctorProfileDoc(doc.data()))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  public async listAll(): Promise<DoctorProfileDoc[]> {
    const snapshot = await this.db.collection(COLLECTIONS.DOCTOR_PROFILES).get();
    return snapshot.docs
      .map((doc) => normalizeDoctorProfileDoc(doc.data()))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }
}
