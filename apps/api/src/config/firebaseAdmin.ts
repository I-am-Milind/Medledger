import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';
import { logger } from './logger';

const hasServiceAccount = Boolean(env.firebase.clientEmail && env.firebase.privateKey);

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: hasServiceAccount
      ? cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey,
        })
      : applicationDefault(),
    projectId: env.firebase.projectId,
    databaseURL: env.firebase.databaseURL,
  });

if (!hasServiceAccount) {
  logger.warn(
    'Firebase initialized with application default credentials. Configure explicit service account for production.',
  );
}

export const firebaseAdminAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

firestore.settings({ ignoreUndefinedProperties: true });
