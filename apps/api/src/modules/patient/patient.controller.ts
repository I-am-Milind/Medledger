import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { PatientService } from './patient.service';
import type { AccessRequestStatus } from '../../domain/roles';

export function createPatientController(patientService: PatientService): {
  getProfile: RequestHandler;
  updateProfile: RequestHandler;
  listAccessRequests: RequestHandler;
  decideAccessRequest: RequestHandler;
  listVisits: RequestHandler;
  createSupportRequest: RequestHandler;
  listSupportRequests: RequestHandler;
} {
  return {
    getProfile: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }

      const profile = await patientService.getProfile(req.actor.uid, req.actor.email);
      res.json({ profile });
    }),
    updateProfile: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }

      const profile = await patientService.updateProfile(req.actor.uid, req.body);
      res.json({ profile });
    }),
    listAccessRequests: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const requests = await patientService.listAccessRequests(req.actor.uid);
      res.json({ requests });
    }),
    decideAccessRequest: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const requestId = String(req.params.requestId ?? '');
      const status = (req.body as { status: AccessRequestStatus }).status;
      const request = await patientService.decideAccessRequest(req.actor.uid, requestId, status);
      res.json({ request });
    }),
    listVisits: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const visits = await patientService.listVisits(req.actor.uid);
      res.json({ visits });
    }),
    createSupportRequest: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const request = await patientService.createSupportRequest(req.actor, req.body);
      res.status(StatusCodes.CREATED).json({ request });
    }),
    listSupportRequests: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const requests = await patientService.listSupportRequests(req.actor.uid);
      res.json({ requests });
    }),
  };
}
