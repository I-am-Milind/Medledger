import type { DoctorApprovalStatus, Role } from '../../domain/roles';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      requestSignature: string;
      validatedQuery?: unknown;
      actor?: {
        uid: string;
        email: string;
        role: Role;
        hospitalId?: string;
        doctorApprovalStatus: DoctorApprovalStatus;
      };
    }
  }
}

export {};
