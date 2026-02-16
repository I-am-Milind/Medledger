import type { Firestore } from 'firebase-admin/firestore';
import type { VisitDoc } from '../../domain/models';
import { COLLECTIONS } from './collections';

function sortByCreatedAtDesc(items: VisitDoc[]): VisitDoc[] {
  return [...items].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export class VisitsRepository {
  public constructor(private readonly db: Firestore) {}

  public async create(visit: VisitDoc): Promise<VisitDoc> {
    await this.db.collection(COLLECTIONS.VISITS).doc(visit.id).set(visit);
    return visit;
  }

  public async findById(id: string): Promise<VisitDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.VISITS).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as VisitDoc;
  }

  public async update(visit: VisitDoc): Promise<VisitDoc> {
    await this.db.collection(COLLECTIONS.VISITS).doc(visit.id).set(visit, { merge: true });
    return visit;
  }

  public async listByPatient(patientUid: string): Promise<VisitDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.VISITS)
      .where('patient_uid', '==', patientUid)
      .get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data() as VisitDoc));
  }

  public async listByDoctor(doctorUid: string): Promise<VisitDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.VISITS)
      .where('doctor_uid', '==', doctorUid)
      .get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data() as VisitDoc));
  }
}
