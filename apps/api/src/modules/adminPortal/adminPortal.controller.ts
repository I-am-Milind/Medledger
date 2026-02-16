import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AdminPortalService } from './adminPortal.service';

export function createAdminPortalController(adminPortalService: AdminPortalService): {
  login: RequestHandler;
  logout: RequestHandler;
  getLiveData: RequestHandler;
  verifyDoctor: RequestHandler;
  verifyPatient: RequestHandler;
  updateSupportRequest: RequestHandler;
} {
  return {
    login: asyncHandler(async (req, res) => {
      const body = req.body as { email: string; password: string };
      const session = adminPortalService.login(body.email, body.password);
      res.status(StatusCodes.CREATED).json({ session });
    }),
    logout: asyncHandler(async (req, res) => {
      const token = String(req.header('x-admin-portal-token') ?? '');
      if (token) {
        adminPortalService.logout(token);
      }
      res.status(StatusCodes.NO_CONTENT).send();
    }),
    getLiveData: asyncHandler(async (_req, res) => {
      const payload = await adminPortalService.getLiveData();
      res.json(payload);
    }),
    verifyDoctor: asyncHandler(async (req, res) => {
      const doctorUid = String(req.params.doctorUid ?? '');
      const body = req.body as { status: 'pending' | 'approved' | 'denied' };
      const profile = await adminPortalService.verifyDoctor(doctorUid, body.status);
      res.json({ profile });
    }),
    verifyPatient: asyncHandler(async (req, res) => {
      const patientUid = String(req.params.patientUid ?? '');
      const body = req.body as { status: 'pending' | 'verified' | 'rejected' };
      const user = await adminPortalService.verifyPatient(patientUid, body.status);
      res.json({ user });
    }),
    updateSupportRequest: asyncHandler(async (req, res) => {
      const requestId = String(req.params.requestId ?? '');
      const body = req.body as { status: 'open' | 'in_progress' | 'resolved' };
      const adminEmail = String(res.locals.adminPortalEmail ?? '');
      if (!adminEmail) {
        throw new AppError('Admin session is required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const request = await adminPortalService.updateSupportRequestStatus(
        requestId,
        body.status,
        {
          uid: 'static-admin',
          email: adminEmail,
        },
      );
      res.json({ request });
    }),
  };
}
