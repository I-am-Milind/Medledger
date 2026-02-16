import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { firebaseAdminAuth } from '../config/firebaseAdmin';
import { env } from '../config/env';
import { AppError } from '../core/errors/AppError';
import { DOCTOR_APPROVAL_STATUS, ROLES, type Role } from '../domain/roles';
import { UsersRepository } from '../modules/common/users.repository';
import { DoctorProfilesRepository } from '../modules/common/doctorProfiles.repository';
import { firestore } from '../config/firebaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';

const usersRepository = new UsersRepository(firestore);
const doctorProfilesRepository = new DoctorProfilesRepository(firestore);

function isFirebaseAdminConfigurationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code = (error as { code?: string }).code?.toLowerCase() ?? '';

  return (
    code.startsWith('app/') ||
    code.includes('credential') ||
    message.includes('default credentials') ||
    message.includes('google_application_credentials') ||
    message.includes('oauth2.googleapis.com/token') ||
    message.includes('service account')
  );
}

function parseBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new AppError('Authorization header is required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new AppError('Invalid authorization header', StatusCodes.UNAUTHORIZED, 'AUTH_INVALID');
  }

  return token;
}

export const authMiddleware: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = parseBearerToken(req.header('authorization'));
  let decoded: Awaited<ReturnType<typeof firebaseAdminAuth.verifyIdToken>>;

  try {
    decoded = await firebaseAdminAuth.verifyIdToken(token, true);
  } catch (error) {
    if (isFirebaseAdminConfigurationError(error)) {
      throw new AppError(
        'Firebase Admin credentials are missing or invalid. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in apps/api/.env.',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
      );
    }

    throw new AppError('Invalid or expired authentication token', StatusCodes.UNAUTHORIZED, 'AUTH_INVALID');
  }

  if (!decoded.email) {
    throw new AppError('Authenticated user has no email', StatusCodes.UNAUTHORIZED, 'AUTH_INVALID');
  }

  const normalizedEmail = decoded.email.toLowerCase();
  let userDoc: Awaited<ReturnType<typeof usersRepository.findByUid>>;

  try {
    userDoc = await usersRepository.findByUid(decoded.uid);
  } catch (error) {
    if (isFirebaseAdminConfigurationError(error)) {
      throw new AppError(
        'Firestore access failed because Firebase Admin credentials are missing or invalid.',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
      );
    }
    throw error;
  }

  const allowlistedAdmin = env.adminEmails.includes(normalizedEmail);
  const doctorProfile = await doctorProfilesRepository.findByUid(decoded.uid);
  const role: Role = allowlistedAdmin
    ? ROLES.ADMIN
    : doctorProfile
      ? ROLES.DOCTOR
      : userDoc?.role ?? ROLES.PATIENT;
  const doctorApprovalStatus =
    role === ROLES.ADMIN
      ? DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE
      : role === ROLES.DOCTOR
        ? doctorProfile?.approval_status ?? userDoc?.doctorApprovalStatus ?? DOCTOR_APPROVAL_STATUS.PENDING
        : userDoc?.doctorApprovalStatus ?? DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE;
  const hospitalId = role === ROLES.DOCTOR ? doctorProfile?.hospital_id : userDoc?.hospitalId;

  req.actor = {
    uid: decoded.uid,
    email: normalizedEmail,
    role,
    hospitalId,
    doctorApprovalStatus,
  };

  next();
});
