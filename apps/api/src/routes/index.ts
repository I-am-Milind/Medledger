import { Router } from 'express';
import { adminRouter } from '../modules/admin/admin.routes';
import { adminPortalRouter } from '../modules/adminPortal/adminPortal.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { doctorRouter } from '../modules/doctor/doctor.routes';
import { systemRouter } from '../modules/common/system.routes';
import { patientRouter } from '../modules/patient/patient.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/patient', patientRouter);
apiRouter.use('/doctor', doctorRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/admin-portal', adminPortalRouter);
apiRouter.use('/system', systemRouter);
