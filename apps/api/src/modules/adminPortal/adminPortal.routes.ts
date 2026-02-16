import { Router, type RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { firestore } from '../../config/firebaseAdmin';
import { AppError } from '../../core/errors/AppError';
import { validateBody } from '../../middleware/validate.middleware';
import { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { PatientsRepository } from '../common/patients.repository';
import { SupportRequestsRepository } from '../common/supportRequests.repository';
import { UsersRepository } from '../common/users.repository';
import { createAdminPortalController } from './adminPortal.controller';
import {
  adminPortalDoctorVerificationSchema,
  adminPortalLoginSchema,
  adminPortalPatientVerificationSchema,
  adminPortalSupportUpdateSchema,
} from './adminPortal.schemas';
import { AdminPortalService } from './adminPortal.service';

const usersRepository = new UsersRepository(firestore);
const doctorProfilesRepository = new DoctorProfilesRepository(firestore);
const patientsRepository = new PatientsRepository(firestore);
const supportRequestsRepository = new SupportRequestsRepository(firestore);
const adminPortalService = new AdminPortalService(
  usersRepository,
  doctorProfilesRepository,
  patientsRepository,
  supportRequestsRepository,
);
const adminPortalController = createAdminPortalController(adminPortalService);

const adminPortalSessionMiddleware: RequestHandler = (req, res, next) => {
  const token = String(req.header('x-admin-portal-token') ?? '');
  if (!token) {
    next(new AppError('Admin portal token is required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED'));
    return;
  }

  const email = adminPortalService.validateSessionToken(token);
  if (!email) {
    next(new AppError('Admin portal session expired', StatusCodes.UNAUTHORIZED, 'AUTH_INVALID'));
    return;
  }

  res.locals.adminPortalEmail = email;
  next();
};

export const adminPortalRouter = Router();

adminPortalRouter.post('/login', validateBody(adminPortalLoginSchema), adminPortalController.login);
adminPortalRouter.use(adminPortalSessionMiddleware);
adminPortalRouter.post('/logout', adminPortalController.logout);
adminPortalRouter.get('/live-data', adminPortalController.getLiveData);
adminPortalRouter.patch(
  '/doctor-verifications/:doctorUid',
  validateBody(adminPortalDoctorVerificationSchema),
  adminPortalController.verifyDoctor,
);
adminPortalRouter.patch(
  '/patient-verifications/:patientUid',
  validateBody(adminPortalPatientVerificationSchema),
  adminPortalController.verifyPatient,
);
adminPortalRouter.patch(
  '/support-requests/:requestId',
  validateBody(adminPortalSupportUpdateSchema),
  adminPortalController.updateSupportRequest,
);
