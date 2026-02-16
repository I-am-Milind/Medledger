export const ROLES = {
  ADMIN: 'ADMIN',
  CLINICIAN: 'CLINICIAN',
  PATIENT: 'PATIENT',
  AUDITOR: 'AUDITOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type UserSession = {
  uid: string;
  email?: string;
  displayName?: string;
  role: Role;
};
