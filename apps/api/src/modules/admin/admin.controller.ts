import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AdminService } from './admin.service';

export function createAdminController(adminService: AdminService): {
  listDoctorApplications: RequestHandler;
  decideDoctorApplication: RequestHandler;
} {
  return {
    listDoctorApplications: asyncHandler(async (_req, res) => {
      const applications = await adminService.listDoctorApplications();
      res.json({ applications });
    }),
    decideDoctorApplication: asyncHandler(async (req, res) => {
      const status = (req.body as { status: 'approved' | 'denied' }).status;
      const doctorUid = String(req.params.doctorUid ?? '');
      const profile = await adminService.decideDoctorApplication(doctorUid, status);
      res.json({ profile });
    }),
  };
}
