import { z } from 'zod';
import {
  DOCTOR_SPECIALIZATIONS,
  MAX_DOCTOR_SPECIALIZATIONS,
} from '../../domain/doctorSpecializations';
import { SUPPORT_REQUEST_CATEGORY, TREATMENT_STATUS } from '../../domain/roles';

export const doctorProfileSchema = z.object({
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

export const doctorSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(160),
});

export const createAccessRequestSchema = z.object({
  patient_identifier: z.string().trim().min(4).max(64),
  reason: z.string().trim().min(3).max(400),
});

export const createSupportRequestSchema = z.object({
  category: z.enum([
    SUPPORT_REQUEST_CATEGORY.HELP,
    SUPPORT_REQUEST_CATEGORY.REPORT,
    SUPPORT_REQUEST_CATEGORY.CONTACT,
  ]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(5000),
});

export const createVisitSchema = z.object({
  patient_identifier: z.string().trim().min(4).max(64),
  diagnosis: z.string().trim().min(2).max(4000),
  prescription: z.string().trim().max(4000).default(''),
  paper_prescription_image_base64: z.string().max(3_000_000).default(''),
  clinical_reports_base64: z.array(z.string().max(3_000_000)).max(6).default([]),
  reports_base64: z.array(z.string().max(3_000_000)).max(10).default([]),
  treatment_status: z.enum([
    TREATMENT_STATUS.ACTIVE,
    TREATMENT_STATUS.IMPROVING,
    TREATMENT_STATUS.STABLE,
    TREATMENT_STATUS.CRITICAL,
    TREATMENT_STATUS.COMPLETED,
    TREATMENT_STATUS.ONE_TIME_COMPLETE,
  ]),
});

export const updateVisitSchema = z.object({
  diagnosis: z.string().trim().min(2).max(4000).optional(),
  prescription: z.string().trim().max(4000).optional(),
  paper_prescription_image_base64: z.string().max(3_000_000).optional(),
  clinical_reports_base64: z.array(z.string().max(3_000_000)).max(6).optional(),
  reports_base64: z.array(z.string().max(3_000_000)).max(10).optional(),
  treatment_status: z
    .enum([
      TREATMENT_STATUS.ACTIVE,
      TREATMENT_STATUS.IMPROVING,
      TREATMENT_STATUS.STABLE,
      TREATMENT_STATUS.CRITICAL,
      TREATMENT_STATUS.COMPLETED,
      TREATMENT_STATUS.ONE_TIME_COMPLETE,
    ])
    .optional(),
});

const patientHereditaryConditionSchema = z.object({
  relation: z.string().trim().min(1).max(80),
  condition: z.string().trim().min(1).max(120),
  age_of_detection: z.number().int().min(0).max(120).nullable(),
  status: z.string().trim().min(1).max(80),
  affected_person_name: z.string().trim().max(120).default(''),
  affected_people_count: z.number().int().min(1).max(1000).nullable().default(null),
  doctor_report_image_base64: z.string().max(3_000_000).default(''),
  notes: z.string().trim().max(1000).default(''),
});

const patientProfileForDoctorSchema = z.object({
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
  hereditary_history: z.array(patientHereditaryConditionSchema).max(50).default([]),
});

export const createDoctorPatientSchema = z.object({
  temporary_password: z.string().min(8).max(128),
  patient_profile: patientProfileForDoctorSchema,
  initial_visit: z
    .object({
      illness_or_problem: z.string().trim().max(4000).default(''),
      prescription: z.string().trim().max(4000).default(''),
      prescription_image_base64: z.string().max(3_000_000).default(''),
      reports_base64: z.array(z.string().max(3_000_000)).max(6).default([]),
      treatment_status: z
        .enum([
          TREATMENT_STATUS.ACTIVE,
          TREATMENT_STATUS.IMPROVING,
          TREATMENT_STATUS.STABLE,
          TREATMENT_STATUS.CRITICAL,
          TREATMENT_STATUS.COMPLETED,
          TREATMENT_STATUS.ONE_TIME_COMPLETE,
        ])
        .default(TREATMENT_STATUS.ACTIVE),
    })
    .optional(),
});

export const doctorExportQuerySchema = z
  .object({
    date_from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (value) => {
      if (!value.date_from || !value.date_to) return true;
      return value.date_from <= value.date_to;
    },
    {
      message: 'date_from must be less than or equal to date_to',
      path: ['date_from'],
    },
  );
