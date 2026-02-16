import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { env } from './env';

const app = initializeApp({
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
  measurementId: env.firebase.measurementId,
});

export const firebaseAuth = getAuth(app);
