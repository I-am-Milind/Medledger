import type { Firestore } from 'firebase-admin/firestore';
import type { AccessRequestDoc } from '../../domain/models';
import { COLLECTIONS } from './collections';

function sortByCreatedAtDesc(items: AccessRequestDoc[]): AccessRequestDoc[] {
  return [...items].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export class AccessRequestsRepository {
  public constructor(private readonly db: Firestore) {}

  public async create(item: AccessRequestDoc): Promise<AccessRequestDoc> {
    await this.db.collection(COLLECTIONS.ACCESS_REQUESTS).doc(item.id).set(item);
    return item;
  }

  public async findById(id: string): Promise<AccessRequestDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.ACCESS_REQUESTS).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as AccessRequestDoc;
  }

  public async listForPatient(patientUid: string): Promise<AccessRequestDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.ACCESS_REQUESTS)
      .where('patient_uid', '==', patientUid)
      .get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data() as AccessRequestDoc));
  }

  public async listForDoctor(doctorUid: string): Promise<AccessRequestDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.ACCESS_REQUESTS)
      .where('doctor_uid', '==', doctorUid)
      .get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data() as AccessRequestDoc));
  }

  public async findByDoctorAndPatient(
    doctorUid: string,
    patientUid: string,
  ): Promise<AccessRequestDoc | null> {
    const snapshot = await this.db
      .collection(COLLECTIONS.ACCESS_REQUESTS)
      .where('doctor_uid', '==', doctorUid)
      .get();
    const existing = sortByCreatedAtDesc(
      snapshot.docs
        .map((doc) => doc.data() as AccessRequestDoc)
        .filter((item) => item.patient_uid === patientUid),
    )[0];
    if (!existing) {
      return null;
    }
    return existing;
  }

  public async update(item: AccessRequestDoc): Promise<AccessRequestDoc> {
    await this.db.collection(COLLECTIONS.ACCESS_REQUESTS).doc(item.id).set(item, { merge: true });
    return item;
  }
}
