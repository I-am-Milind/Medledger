import { Router } from 'express';
import { firestore } from '../../config/firebaseAdmin';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { ROLES } from '../../domain/roles';
import { AccessRequestsRepository } from '../common/accessRequests.repository';
import { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { PatientsRepository } from '../common/patients.repository';
import { SupportRequestsRepository } from '../common/supportRequests.repository';
import { UsersRepository } from '../common/users.repository';
import { VisitsRepository } from '../common/visits.repository';
import { createDoctorController } from './doctor.controller';
import {
  createDoctorPatientSchema,
  createAccessRequestSchema,
  createSupportRequestSchema,
  createVisitSchema,
  doctorExportQuerySchema,
  doctorProfileSchema,
  doctorSearchQuerySchema,
  updateVisitSchema,
} from './doctor.schemas';
import { DoctorService } from './doctor.service';

const usersRepository = new UsersRepository(firestore);
const doctorProfilesRepository = new DoctorProfilesRepository(firestore);
const patientsRepository = new PatientsRepository(firestore);
const accessRequestsRepository = new AccessRequestsRepository(firestore);
const visitsRepository = new VisitsRepository(firestore);
const supportRequestsRepository = new SupportRequestsRepository(firestore);
const doctorService = new DoctorService(
  usersRepository,
  doctorProfilesRepository,
  patientsRepository,
  accessRequestsRepository,
  visitsRepository,
  supportRequestsRepository,
);
const doctorController = createDoctorController(doctorService);

export const doctorRouter = Router();

doctorRouter.use(authMiddleware);

doctorRouter.get(
  '/profile',
  requireRoles([ROLES.DOCTOR, ROLES.ADMIN]),
  doctorController.getProfile,
);
doctorRouter.post('/apply', requireRoles([ROLES.PATIENT, ROLES.DOCTOR]), validateBody(doctorProfileSchema), doctorController.apply);
doctorRouter.put(
  '/profile',
  requireRoles([ROLES.DOCTOR]),
  validateBody(doctorProfileSchema),
  doctorController.updateProfile,
);

doctorRouter.get(
  '/patients/search',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  validateQuery(doctorSearchQuerySchema),
  doctorController.searchPatients,
);
doctorRouter.post(
  '/patients',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  validateBody(createDoctorPatientSchema),
  doctorController.createPatient,
);
doctorRouter.post(
  '/support',
  requireRoles([ROLES.DOCTOR]),
  validateBody(createSupportRequestSchema),
  doctorController.createSupportRequest,
);
doctorRouter.get('/support', requireRoles([ROLES.DOCTOR]), doctorController.listSupportRequests);
doctorRouter.get(
  '/patients/lookup/:identifier/export',
  requireRoles([ROLES.DOCTOR, ROLES.ADMIN], { requireDoctorApproved: true }),
  validateQuery(doctorExportQuerySchema),
  doctorController.exportPatientExcel,
);
doctorRouter.get(
  '/patients/lookup/:identifier',
  requireRoles([ROLES.DOCTOR, ROLES.ADMIN], { requireDoctorApproved: true }),
  doctorController.lookupPatient,
);
doctorRouter.post(
  '/access-requests',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  validateBody(createAccessRequestSchema),
  doctorController.createAccessRequest,
);
doctorRouter.get(
  '/access-requests',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  doctorController.listAccessRequests,
);
doctorRouter.get(
  '/visited-patients',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  doctorController.listVisitedPatients,
);

doctorRouter.post(
  '/visits',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  validateBody(createVisitSchema),
  doctorController.createVisit,
);
doctorRouter.patch(
  '/visits/:visitId',
  requireRoles([ROLES.DOCTOR], { requireDoctorApproved: true }),
  validateBody(updateVisitSchema),
  doctorController.updateVisit,
);
