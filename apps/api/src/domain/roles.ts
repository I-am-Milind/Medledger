export const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DOCTOR_APPROVAL_STATUS = {
  NOT_APPLICABLE: 'not_applicable',
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;

export type DoctorApprovalStatus =
  (typeof DOCTOR_APPROVAL_STATUS)[keyof typeof DOCTOR_APPROVAL_STATUS];

export const PATIENT_VERIFICATION_STATUS = {
  NOT_APPLICABLE: 'not_applicable',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export type PatientVerificationStatus =
  (typeof PATIENT_VERIFICATION_STATUS)[keyof typeof PATIENT_VERIFICATION_STATUS];

export const ACCESS_REQUEST_STATUS = {
  WAITING: 'waiting',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;

export type AccessRequestStatus =
  (typeof ACCESS_REQUEST_STATUS)[keyof typeof ACCESS_REQUEST_STATUS];

export const TREATMENT_STATUS = {
  ACTIVE: 'active',
  IMPROVING: 'improving',
  STABLE: 'stable',
  CRITICAL: 'critical',
  COMPLETED: 'completed',
  ONE_TIME_COMPLETE: 'one_time_complete',
} as const;

export type TreatmentStatus = (typeof TREATMENT_STATUS)[keyof typeof TREATMENT_STATUS];

export const SUPPORT_REQUEST_CATEGORY = {
  HELP: 'help',
  REPORT: 'report',
  CONTACT: 'contact',
} as const;

export type SupportRequestCategory =
  (typeof SUPPORT_REQUEST_CATEGORY)[keyof typeof SUPPORT_REQUEST_CATEGORY];

export const SUPPORT_REQUEST_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
} as const;

export type SupportRequestStatus =
  (typeof SUPPORT_REQUEST_STATUS)[keyof typeof SUPPORT_REQUEST_STATUS];
