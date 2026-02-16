import type { Firestore } from 'firebase-admin/firestore';
import type { UserDoc } from '../../domain/models';
import { DOCTOR_APPROVAL_STATUS, PATIENT_VERIFICATION_STATUS } from '../../domain/roles';
import { COLLECTIONS } from './collections';

function normalizeUserDoc(raw: unknown): UserDoc {
  const record = (raw ?? {}) as Partial<UserDoc>;
  const now = new Date(0).toISOString();

  return {
    uid: record.uid ?? '',
    email: record.email ?? '',
    role: record.role ?? 'patient',
    displayName: record.displayName ?? undefined,
    phone: record.phone ?? undefined,
    hospitalId: record.hospitalId ?? undefined,
    doctorApprovalStatus: record.doctorApprovalStatus ?? DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
    patientVerificationStatus:
      record.patientVerificationStatus ?? PATIENT_VERIFICATION_STATUS.NOT_APPLICABLE,
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export class UsersRepository {
  public constructor(private readonly db: Firestore) {}

  public async findByUid(uid: string): Promise<UserDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!snapshot.exists) {
      return null;
    }
    return normalizeUserDoc(snapshot.data());
  }

  public async upsert(user: UserDoc): Promise<UserDoc> {
    await this.db.collection(COLLECTIONS.USERS).doc(user.uid).set(user, { merge: true });
    return user;
  }

  public async findByEmail(email: string): Promise<UserDoc | null> {
    const snapshot = await this.db
      .collection(COLLECTIONS.USERS)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }
    return normalizeUserDoc(firstDoc.data());
  }

  public async findByPhone(phone: string): Promise<UserDoc | null> {
    const snapshot = await this.db
      .collection(COLLECTIONS.USERS)
      .where('phone', '==', phone)
      .limit(1)
      .get();
    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }
    return normalizeUserDoc(firstDoc.data());
  }

  public async listByRole(role: UserDoc['role']): Promise<UserDoc[]> {
    const snapshot = await this.db.collection(COLLECTIONS.USERS).where('role', '==', role).get();
    return snapshot.docs
      .map((doc) => normalizeUserDoc(doc.data()))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public async listAll(): Promise<UserDoc[]> {
    const snapshot = await this.db.collection(COLLECTIONS.USERS).get();
    return snapshot.docs
      .map((doc) => normalizeUserDoc(doc.data()))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
