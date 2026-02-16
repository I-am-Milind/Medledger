import { z } from 'zod';
import { DOCTOR_APPROVAL_STATUS } from '../../domain/roles';

export const decideDoctorApplicationSchema = z.object({
  status: z.enum([DOCTOR_APPROVAL_STATUS.APPROVED, DOCTOR_APPROVAL_STATUS.DENIED]),
});
