import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('MedLedger'),
  VITE_API_BASE_URL: z.string().url(),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(`Invalid web env: ${parsed.error.message}`);
}

const raw = parsed.data;

export const env = {
  appName: raw.VITE_APP_NAME,
  apiBaseUrl: raw.VITE_API_BASE_URL,
  firebase: {
    apiKey: raw.VITE_FIREBASE_API_KEY,
    authDomain: raw.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: raw.VITE_FIREBASE_PROJECT_ID,
    storageBucket: raw.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: raw.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: raw.VITE_FIREBASE_APP_ID,
    measurementId: raw.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  },
} as const;
