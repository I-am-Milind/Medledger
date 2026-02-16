import { Router } from 'express';
import { firestore } from '../../config/firebaseAdmin';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { ROLES } from '../../domain/roles';
import { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { UsersRepository } from '../common/users.repository';
import { PatientsRepository } from '../common/patients.repository';
import { bootstrapBodySchema } from './auth.schemas';
import { createAuthController } from './auth.controller';
import { AuthService } from './auth.service';

const usersRepository = new UsersRepository(firestore);
const patientsRepository = new PatientsRepository(firestore);
const doctorProfilesRepository = new DoctorProfilesRepository(firestore);
const authService = new AuthService(usersRepository, patientsRepository, doctorProfilesRepository);
const authController = createAuthController(authService);

export const authRouter = Router();

authRouter.use(authMiddleware);

authRouter.get('/session', requireRoles([ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN]), authController.session);
authRouter.post(
  '/bootstrap',
  requireRoles([ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN]),
  validateBody(bootstrapBodySchema),
  authController.bootstrap,
);
