import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/role.middleware';
import { ROLES } from '../../domain/roles';

export const systemRouter = Router();

systemRouter.use(authMiddleware);
systemRouter.get('/ping', requireRoles([ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN]), (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    actor: req.actor,
  });
});
