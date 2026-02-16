import type { Firestore } from 'firebase-admin/firestore';
import type { SupportRequestDoc } from '../../domain/models';
import { SUPPORT_REQUEST_STATUS } from '../../domain/roles';
import { COLLECTIONS } from './collections';

function normalizeSupportRequest(raw: unknown): SupportRequestDoc {
  const record = (raw ?? {}) as Partial<SupportRequestDoc>;
  const now = new Date(0).toISOString();

  return {
    id: record.id ?? '',
    actor_uid: record.actor_uid ?? '',
    actor_role: record.actor_role ?? 'patient',
    actor_name: record.actor_name ?? '',
    actor_email: record.actor_email ?? '',
    actor_phone: record.actor_phone ?? '',
    hospital_id: record.hospital_id ?? '',
    category: record.category ?? 'help',
    subject: record.subject ?? '',
    message: record.message ?? '',
    status: record.status ?? SUPPORT_REQUEST_STATUS.OPEN,
    created_at: record.created_at ?? now,
    updated_at: record.updated_at ?? now,
    resolved_by_uid: record.resolved_by_uid ?? undefined,
    resolved_by_email: record.resolved_by_email ?? undefined,
  };
}

function sortByCreatedAtDesc(items: SupportRequestDoc[]): SupportRequestDoc[] {
  return [...items].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export class SupportRequestsRepository {
  public constructor(private readonly db: Firestore) {}

  public async create(item: SupportRequestDoc): Promise<SupportRequestDoc> {
    await this.db.collection(COLLECTIONS.SUPPORT_REQUESTS).doc(item.id).set(item);
    return item;
  }

  public async update(item: SupportRequestDoc): Promise<SupportRequestDoc> {
    await this.db.collection(COLLECTIONS.SUPPORT_REQUESTS).doc(item.id).set(item, { merge: true });
    return item;
  }

  public async findById(id: string): Promise<SupportRequestDoc | null> {
    const snapshot = await this.db.collection(COLLECTIONS.SUPPORT_REQUESTS).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return normalizeSupportRequest(snapshot.data());
  }

  public async listByActor(actorUid: string): Promise<SupportRequestDoc[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.SUPPORT_REQUESTS)
      .where('actor_uid', '==', actorUid)
      .get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => normalizeSupportRequest(doc.data())));
  }

  public async listAll(): Promise<SupportRequestDoc[]> {
    const snapshot = await this.db.collection(COLLECTIONS.SUPPORT_REQUESTS).get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => normalizeSupportRequest(doc.data())));
  }
}
