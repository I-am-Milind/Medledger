import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthService } from './auth.service';

type BootstrapPayload = {
  role: 'patient' | 'doctor';
  displayName: string;
  phone?: string;
  hospitalId?: string;
  patientProfile?: {
    demographics: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      gender: string;
    };
    contact: {
      email: string;
      phone: string;
      address_line_1: string;
      address_line_2: string;
      city: string;
      state: string;
      country: string;
      postal_code: string;
    };
    blood_group: string;
    allergies: string[];
    profile_image_base64: string;
    aadhaar_card_base64: string;
    hereditary_history: Array<{
      relation: string;
      condition: string;
      age_of_detection: number | null;
      status: string;
      affected_person_name: string;
      affected_people_count: number | null;
      doctor_report_image_base64: string;
      notes: string;
    }>;
  };
  doctorProfile?: {
    doctor_name: string;
    doctor_email: string;
    doctor_phone: string;
    hospital_id: string;
    hospital_logo_base64: string;
    specializations: string[];
    qualification: string;
    license: string;
    profile_image_base64: string;
    verification_docs_base64: string[];
  };
};

export function createAuthController(authService: AuthService): {
  bootstrap: RequestHandler;
  session: RequestHandler;
} {
  return {
    bootstrap: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }

      const payload = req.body as BootstrapPayload;
      const user = await authService.bootstrap(req.actor, payload);

      res.status(StatusCodes.CREATED).json({ user });
    }),
    session: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }

      const user = await authService.getSession(req.actor);
      res.json({ user });
    }),
  };
}
