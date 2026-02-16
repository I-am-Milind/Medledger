import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().optional(),
  REQUEST_SIGNING_SECRET: z.string().min(12).default('medledger-dev-signing-secret'),
  ADMIN_EMAILS: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment configuration: ${parsed.error.message}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  corsOrigin: raw.CORS_ORIGIN,
  requestSigningSecret: raw.REQUEST_SIGNING_SECRET,
  adminEmails: raw.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  firebase: {
    projectId: raw.FIREBASE_PROJECT_ID,
    clientEmail: raw.FIREBASE_CLIENT_EMAIL || undefined,
    privateKey: raw.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined,
    databaseURL: raw.FIREBASE_DATABASE_URL || undefined,
  },
} as const;
