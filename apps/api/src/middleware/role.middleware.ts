import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../core/errors/AppError';
import { DOCTOR_APPROVAL_STATUS, ROLES, type Role } from '../domain/roles';

type RequireRolesOptions = {
  requireDoctorApproved?: boolean;
};

export function requireRoles(
  allowedRoles: Role[],
  options: RequireRolesOptions = {},
): RequestHandler {
  return (req, _res, next) => {
    const actor = req.actor;

    if (!actor) {
      next(new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED'));
      return;
    }

    if (!allowedRoles.includes(actor.role)) {
      next(new AppError('Access denied by role policy', StatusCodes.FORBIDDEN, 'FORBIDDEN'));
      return;
    }

    if (
      options.requireDoctorApproved &&
      actor.role === ROLES.DOCTOR &&
      actor.doctorApprovalStatus !== DOCTOR_APPROVAL_STATUS.APPROVED
    ) {
      next(
        new AppError(
          'Doctor access requires admin approval',
          StatusCodes.FORBIDDEN,
          'FORBIDDEN',
          { approvalStatus: actor.doctorApprovalStatus },
        ),
      );
      return;
    }

    next();
  };
}
