import { z } from 'zod';
import { ACCESS_REQUEST_STATUS, SUPPORT_REQUEST_CATEGORY } from '../../domain/roles';

export const hereditaryConditionSchema = z.object({
  relation: z.string().trim().min(1).max(80),
  condition: z.string().trim().min(1).max(120),
  age_of_detection: z.number().int().min(0).max(120).nullable(),
  status: z.string().trim().min(1).max(80),
  affected_person_name: z.string().trim().max(120).default(''),
  affected_people_count: z.number().int().min(1).max(1000).nullable().default(null),
  doctor_report_image_base64: z.string().max(3_000_000).default(''),
  notes: z.string().trim().max(1000).default(''),
});

export const updatePatientProfileSchema = z.object({
  demographics: z.object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    date_of_birth: z.string().trim().min(4).max(40),
    gender: z.string().trim().min(1).max(40),
  }),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().trim().min(5).max(25),
    address_line_1: z.string().trim().max(160),
    address_line_2: z.string().trim().max(160).default(''),
    city: z.string().trim().max(100),
    state: z.string().trim().max(100),
    country: z.string().trim().max(100),
    postal_code: z.string().trim().max(20),
  }),
  blood_group: z.string().trim().max(20),
  allergies: z.array(z.string().trim().max(80)).max(100).default([]),
  profile_image_base64: z.string().max(3_000_000).default(''),
  aadhaar_card_base64: z.string().max(3_000_000).default(''),
  hereditary_history: z.array(hereditaryConditionSchema).max(50).default([]),
});

export const decideAccessRequestSchema = z.object({
  status: z.enum([ACCESS_REQUEST_STATUS.APPROVED, ACCESS_REQUEST_STATUS.DENIED]),
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
