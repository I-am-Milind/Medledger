import { Router } from 'express';
import { firestore } from '../../config/firebaseAdmin';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { ROLES } from '../../domain/roles';
import { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import { UsersRepository } from '../common/users.repository';
import { createAdminController } from './admin.controller';
import { decideDoctorApplicationSchema } from './admin.schemas';
import { AdminService } from './admin.service';

const doctorProfilesRepository = new DoctorProfilesRepository(firestore);
const usersRepository = new UsersRepository(firestore);
const adminService = new AdminService(doctorProfilesRepository, usersRepository);
const adminController = createAdminController(adminService);

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireRoles([ROLES.ADMIN]));

adminRouter.get('/doctor-applications', adminController.listDoctorApplications);
adminRouter.patch(
  '/doctor-applications/:doctorUid',
  validateBody(decideDoctorApplicationSchema),
  adminController.decideDoctorApplication,
);
