import type { Firestore } from 'firebase-admin/firestore';
import type { PatientProfileDoc } from '../../domain/models';
import { COLLECTIONS } from './collections';

function normalizePatientProfile(raw: unknown): PatientProfileDoc {
  const record = (raw ?? {}) as Partial<PatientProfileDoc>;
  const now = new Date(0).toISOString();

  return {
    owner_uid: record.owner_uid ?? '',
    global_patient_identifier: record.global_patient_identifier ?? '',
    demographics: {
      first_name: record.demographics?.first_name ?? '',
      last_name: record.demographics?.last_name ?? '',
      date_of_birth: record.demographics?.date_of_birth ?? '',
      gender: record.demographics?.gender ?? '',
    },
    contact: {
      email: record.contact?.email ?? '',
      phone: record.contact?.phone ?? '',
      address_line_1: record.contact?.address_line_1 ?? '',
      address_line_2: record.contact?.address_line_2 ?? '',
      city: record.contact?.city ?? '',
      state: record.contact?.state ?? '',
      country: record.contact?.country ?? '',
      postal_code: record.contact?.postal_code ?? '',
    },
    blood_group: record.blood_group ?? '',
    allergies: Array.isArray(record.allergies)
      ? record.allergies.filter((item): item is string => typeof item === 'string')
      : [],
    profile_image_base64: record.profile_image_base64 ?? '',
    aadhaar_card_base64: record.aadhaar_card_base64 ?? '',
    hereditary_history: Array.isArray(record.hereditary_history)
      ? record.hereditary_history
          .map((item) => {
            if (!item || typeof item !== 'object') {
              return null;
            }
            const entry = item as PatientProfileDoc['hereditary_history'][number];
            return {
              relation: typeof entry.relation === 'string' ? entry.relation : '',
              condition: typeof entry.condition === 'string' ? entry.condition : '',
              age_of_detection:
                typeof entry.age_of_detection === 'number' ? entry.age_of_detection : null,
              status: typeof entry.status === 'string' ? entry.status : '',
              affected_person_name:
                typeof entry.affected_person_name === 'string' ? entry.affected_person_name : '',
              affected_people_count:
                typeof entry.affected_people_count === 'number' ? entry.affected_people_count : null,
              doctor_report_image_base64:
                typeof entry.doctor_report_image_base64 === 'string'
                  ? entry.doctor_report_image_base64
                  : '',
              notes: typeof entry.notes === 'string' ? entry.notes : '',
            };
          })
          .filter(
            (
              item,
            ): item is PatientProfileDoc['hereditary_history'][number] => item !== null,
          )
      : [],
    created_by:
      record.created_by && typeof record.created_by === 'object'
        ? {
            doctor_uid:
              typeof record.created_by.doctor_uid === 'string'
                ? record.created_by.doctor_uid
                : '',
            doctor_name:
              typeof record.created_by.doctor_name === 'string'
                ? record.created_by.doctor_name
                : '',
            hospital_id:
              typeof record.created_by.hospital_id === 'string'
                ? record.created_by.hospital_id
                : '',
            created_at:
              typeof record.created_by.created_at === 'string'
                ? record.created_by.created_at
                : now,
          }
        : undefined,
    created_at: record.created_at ?? now,
    updated_at: record.updated_at ?? now,
  };
}

export class PatientsRepository {
  public constructor(private readonly db: Firestore) {}

  public async findByOwnerUid(ownerUid: string): Promise<PatientProfileDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.PATIENTS).doc(ownerUid).get();
    if (!snapshot.exists) {
      return null;
    }
    return normalizePatientProfile(snapshot.data());
  }

  public async findByIdentifier(identifier: string): Promise<PatientProfileDoc | null> {
    const snapshot = await this.db
      .collection(COLLECTIONS.PATIENTS)
      .where('global_patient_identifier', '==', identifier)
      .limit(1)
      .get();
    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }
    return normalizePatientProfile(firstDoc.data());
  }

  public async upsert(profile: PatientProfileDoc): Promise<PatientProfileDoc> {
    await this.db.collection(COLLECTIONS.PATIENTS).doc(profile.owner_uid).set(profile, { merge: true });
    return profile;
  }

  public async listAll(): Promise<PatientProfileDoc[]> {
    const snapshot = await this.db.collection(COLLECTIONS.PATIENTS).get();
    return snapshot.docs
      .map((doc) => normalizePatientProfile(doc.data()))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }
}
