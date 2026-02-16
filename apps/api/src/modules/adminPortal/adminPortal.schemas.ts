import { z } from 'zod';
import {
  DOCTOR_APPROVAL_STATUS,
  PATIENT_VERIFICATION_STATUS,
  SUPPORT_REQUEST_STATUS,
} from '../../domain/roles';

export const adminPortalLoginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(3).max(160),
});

export const adminPortalDoctorVerificationSchema = z.object({
  status: z.enum([
    DOCTOR_APPROVAL_STATUS.PENDING,
    DOCTOR_APPROVAL_STATUS.APPROVED,
    DOCTOR_APPROVAL_STATUS.DENIED,
  ]),
});

export const adminPortalPatientVerificationSchema = z.object({
  status: z.enum([
    PATIENT_VERIFICATION_STATUS.PENDING,
    PATIENT_VERIFICATION_STATUS.VERIFIED,
    PATIENT_VERIFICATION_STATUS.REJECTED,
  ]),
});

export const adminPortalSupportUpdateSchema = z.object({
  status: z.enum([
    SUPPORT_REQUEST_STATUS.OPEN,
    SUPPORT_REQUEST_STATUS.IN_PROGRESS,
    SUPPORT_REQUEST_STATUS.RESOLVED,
  ]),
});
