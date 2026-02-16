import { z } from 'zod';
import {
  DOCTOR_SPECIALIZATIONS,
  MAX_DOCTOR_SPECIALIZATIONS,
} from '../../domain/doctorSpecializations';
import { ROLES } from '../../domain/roles';

const patientHereditaryConditionBootstrapSchema = z.object({
  relation: z.string().trim().min(1).max(80),
  condition: z.string().trim().min(1).max(120),
  age_of_detection: z.number().int().min(0).max(120).nullable(),
  status: z.string().trim().min(1).max(80),
  affected_person_name: z.string().trim().max(120).default(''),
  affected_people_count: z.number().int().min(1).max(1000).nullable().default(null),
  doctor_report_image_base64: z.string().max(3_000_000).default(''),
  notes: z.string().trim().max(1000).default(''),
});

const patientProfileBootstrapSchema = z.object({
  demographics: z.object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    date_of_birth: z.string().trim().min(4).max(40),
    gender: z.string().trim().min(1).max(40),
  }),
  contact: z.object({
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(5).max(25),
    address_line_1: z.string().trim().min(1).max(160),
    address_line_2: z.string().trim().max(160).default(''),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    country: z.string().trim().min(1).max(100),
    postal_code: z.string().trim().min(1).max(20),
  }),
  blood_group: z.string().trim().min(1).max(20),
  allergies: z.array(z.string().trim().max(80)).max(100).default([]),
  profile_image_base64: z.string().max(3_000_000),
  aadhaar_card_base64: z.string().max(3_000_000),
  hereditary_history: z.array(patientHereditaryConditionBootstrapSchema).max(50).default([]),
});

const doctorProfileBootstrapSchema = z.object({
  doctor_name: z.string().trim().min(2).max(120),
  doctor_email: z.string().trim().email().max(160),
  doctor_phone: z.string().trim().max(25).default(''),
  hospital_id: z.string().trim().min(2).max(120),
  hospital_logo_base64: z.string().max(3_000_000).default(''),
  specializations: z
    .array(z.enum(DOCTOR_SPECIALIZATIONS))
    .min(1)
    .max(MAX_DOCTOR_SPECIALIZATIONS)
    .refine((items) => new Set(items).size === items.length, {
      message: 'Specializations must be unique',
    }),
  qualification: z.string().trim().min(2).max(160),
  license: z.string().trim().min(2).max(120),
  profile_image_base64: z.string().max(3_000_000).default(''),
  verification_docs_base64: z.array(z.string().max(3_000_000)).max(10).default([]),
});

export const bootstrapBodySchema = z.object({
  role: z.enum([ROLES.PATIENT, ROLES.DOCTOR]).default(ROLES.PATIENT),
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(25).optional(),
  hospitalId: z.string().trim().min(2).max(120).optional(),
  patientProfile: patientProfileBootstrapSchema.optional(),
  doctorProfile: doctorProfileBootstrapSchema.optional(),
}).superRefine((value, context) => {
  if (value.role === ROLES.DOCTOR && !value.doctorProfile) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'doctorProfile is required for doctor bootstrap',
      path: ['doctorProfile'],
    });
  }

  if (value.role === ROLES.PATIENT && !value.patientProfile) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'patientProfile is required for patient bootstrap',
      path: ['patientProfile'],
    });
  }
});
