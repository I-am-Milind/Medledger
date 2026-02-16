import { Router } from 'express';
import { firestore } from '../../config/firebaseAdmin';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { ROLES } from '../../domain/roles';
import { AccessRequestsRepository } from '../common/accessRequests.repository';
import { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { PatientsRepository } from '../common/patients.repository';
import { SupportRequestsRepository } from '../common/supportRequests.repository';
import { VisitsRepository } from '../common/visits.repository';
import { createPatientController } from './patient.controller';
import {
  createSupportRequestSchema,
  decideAccessRequestSchema,
  updatePatientProfileSchema,
} from './patient.schemas';
import { PatientService } from './patient.service';

const patientsRepository = new PatientsRepository(firestore);
const accessRequestsRepository = new AccessRequestsRepository(firestore);
const visitsRepository = new VisitsRepository(firestore);
const doctorProfilesRepository = new DoctorProfilesRepository(firestore);
const supportRequestsRepository = new SupportRequestsRepository(firestore);
const patientService = new PatientService(
  patientsRepository,
  accessRequestsRepository,
  visitsRepository,
  doctorProfilesRepository,
  supportRequestsRepository,
);
const patientController = createPatientController(patientService);

export const patientRouter = Router();

patientRouter.use(authMiddleware);
patientRouter.use(requireRoles([ROLES.PATIENT]));

patientRouter.get('/profile', patientController.getProfile);
patientRouter.put('/profile', validateBody(updatePatientProfileSchema), patientController.updateProfile);

patientRouter.get('/access-requests', patientController.listAccessRequests);
patientRouter.patch(
  '/access-requests/:requestId',
  validateBody(decideAccessRequestSchema),
  patientController.decideAccessRequest,
);

patientRouter.get('/visits', patientController.listVisits);
patientRouter.post(
  '/support',
  validateBody(createSupportRequestSchema),
  patientController.createSupportRequest,
);
patientRouter.get('/support', patientController.listSupportRequests);
