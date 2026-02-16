import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { DoctorService } from './doctor.service';

export function createDoctorController(doctorService: DoctorService): {
  getProfile: RequestHandler;
  apply: RequestHandler;
  updateProfile: RequestHandler;
  searchPatients: RequestHandler;
  createPatient: RequestHandler;
  exportPatientExcel: RequestHandler;
  createSupportRequest: RequestHandler;
  listSupportRequests: RequestHandler;
  createAccessRequest: RequestHandler;
  listAccessRequests: RequestHandler;
  listVisitedPatients: RequestHandler;
  lookupPatient: RequestHandler;
  createVisit: RequestHandler;
  updateVisit: RequestHandler;
} {
  return {
    getProfile: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const profile = await doctorService.getProfile(req.actor);
      res.json({ profile });
    }),
    apply: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const profile = await doctorService.apply(req.actor, req.body);
      res.status(StatusCodes.CREATED).json({ profile });
    }),
    updateProfile: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const profile = await doctorService.updateProfile(req.actor, req.body);
      res.json({ profile });
    }),
    searchPatients: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const validatedQuery = req.validatedQuery as { query?: string } | undefined;
      const query = String(validatedQuery?.query ?? req.query.query ?? '');
      const results = await doctorService.searchPatients(req.actor, query);
      res.json({ results });
    }),
    createPatient: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const result = await doctorService.createPatient(req.actor, req.body);
      res.status(StatusCodes.CREATED).json(result);
    }),
    exportPatientExcel: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const identifier = String(req.params.identifier ?? '');
      const validatedQuery = (req.validatedQuery ?? req.query) as
        | { date_from?: string; date_to?: string }
        | undefined;
      const dateFrom = validatedQuery?.date_from;
      const dateTo = validatedQuery?.date_to;
      const payload = await doctorService.exportPatientData(req.actor, identifier, {
        date_from: dateFrom,
        date_to: dateTo,
      });

      const sanitizedIdentifier = identifier.replace(/[^a-zA-Z0-9-_]/g, '_');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const filename = `medledger-${sanitizedIdentifier}-${dateSuffix}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');

      const stream = new PassThrough();
      stream.pipe(res);

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream,
        useStyles: true,
        useSharedStrings: true,
      });
      workbook.creator = 'MedLedger';
      workbook.created = new Date();
      workbook.modified = new Date();

      const summarySheet = workbook.addWorksheet('summary');
      summarySheet.columns = [
        { header: 'field', key: 'field', width: 28 },
        { header: 'value', key: 'value', width: 52 },
      ];
      [
        ['patient_identifier', payload.patient.global_patient_identifier],
        [
          'patient_name',
          `${payload.patient.demographics.first_name} ${payload.patient.demographics.last_name}`.trim(),
        ],
        ['patient_phone', payload.patient.contact.phone],
        ['patient_email', payload.patient.contact.email],
        ['blood_group', payload.patient.blood_group],
        ['allergies', payload.patient.allergies.join(', ') || 'none'],
        ['filter_date_from', payload.applied_filters.date_from ?? 'not set'],
        ['filter_date_to', payload.applied_filters.date_to ?? 'not set'],
        ['generated_at', payload.generated_at],
        ['visits_count', String(payload.visits.length)],
        ['medications_count', String(payload.medications.length)],
        ['admissions_count', String(payload.admissions.length)],
        ['report_metadata_count', String(payload.report_metadata.length)],
      ].forEach(([field, value]) => {
        summarySheet.addRow({ field, value }).commit();
      });
      summarySheet.commit();

      const visitsSheet = workbook.addWorksheet('visits');
      visitsSheet.columns = [
        { header: 'visit_id', key: 'visit_id', width: 38 },
        { header: 'visit_at', key: 'visit_at', width: 28 },
        { header: 'updated_at', key: 'updated_at', width: 28 },
        { header: 'patient_identifier', key: 'patient_identifier', width: 24 },
        { header: 'patient_name', key: 'patient_name', width: 24 },
        { header: 'patient_phone', key: 'patient_phone', width: 18 },
        { header: 'hospital_id', key: 'hospital_id', width: 20 },
        { header: 'doctor_name', key: 'doctor_name', width: 24 },
        { header: 'doctor_phone', key: 'doctor_phone', width: 18 },
        { header: 'illness_or_problem', key: 'illness_or_problem', width: 40 },
        { header: 'treatment_status', key: 'treatment_status', width: 18 },
        { header: 'prescription_summary', key: 'prescription_summary', width: 60 },
      ];
      payload.visits.forEach((row) => visitsSheet.addRow(row).commit());
      visitsSheet.commit();

      const medicationsSheet = workbook.addWorksheet('medications');
      medicationsSheet.columns = [
        { header: 'visit_id', key: 'visit_id', width: 38 },
        { header: 'visit_at', key: 'visit_at', width: 28 },
        { header: 'patient_identifier', key: 'patient_identifier', width: 24 },
        { header: 'patient_name', key: 'patient_name', width: 24 },
        { header: 'medication_notes', key: 'medication_notes', width: 80 },
        { header: 'doctor_name', key: 'doctor_name', width: 24 },
        { header: 'hospital_id', key: 'hospital_id', width: 20 },
      ];
      payload.medications.forEach((row) => medicationsSheet.addRow(row).commit());
      medicationsSheet.commit();

      const admissionsSheet = workbook.addWorksheet('admissions');
      admissionsSheet.columns = [
        { header: 'admission_id', key: 'admission_id', width: 42 },
        { header: 'visit_id', key: 'visit_id', width: 38 },
        { header: 'admitted_at', key: 'admitted_at', width: 28 },
        { header: 'patient_identifier', key: 'patient_identifier', width: 24 },
        { header: 'patient_name', key: 'patient_name', width: 24 },
        { header: 'hospital_id', key: 'hospital_id', width: 20 },
        { header: 'attending_doctor', key: 'attending_doctor', width: 24 },
        { header: 'treatment_status', key: 'treatment_status', width: 18 },
        { header: 'discharge_state', key: 'discharge_state', width: 16 },
      ];
      payload.admissions.forEach((row) => admissionsSheet.addRow(row).commit());
      admissionsSheet.commit();

      const reportsSheet = workbook.addWorksheet('report_metadata');
      reportsSheet.columns = [
        { header: 'visit_id', key: 'visit_id', width: 38 },
        { header: 'visit_at', key: 'visit_at', width: 28 },
        { header: 'patient_identifier', key: 'patient_identifier', width: 24 },
        { header: 'patient_name', key: 'patient_name', width: 24 },
        { header: 'report_type', key: 'report_type', width: 18 },
        { header: 'file_kind', key: 'file_kind', width: 14 },
        { header: 'file_size_estimate_kb', key: 'file_size_estimate_kb', width: 22 },
        { header: 'index_in_visit', key: 'index_in_visit', width: 14 },
      ];
      payload.report_metadata.forEach((row) => reportsSheet.addRow(row).commit());
      reportsSheet.commit();

      await workbook.commit();
    }),
    createSupportRequest: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const request = await doctorService.createSupportRequest(req.actor, req.body);
      res.status(StatusCodes.CREATED).json({ request });
    }),
    listSupportRequests: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const requests = await doctorService.listSupportRequests(req.actor);
      res.json({ requests });
    }),
    createAccessRequest: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const accessRequest = await doctorService.createAccessRequest(req.actor, req.body);
      res.status(StatusCodes.CREATED).json({ accessRequest });
    }),
    listAccessRequests: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const requests = await doctorService.listAccessRequests(req.actor);
      res.json({ requests });
    }),
    listVisitedPatients: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const patients = await doctorService.listVisitedPatients(req.actor);
      res.json({ patients });
    }),
    lookupPatient: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const identifier = String(req.params.identifier ?? '');
      const result = await doctorService.lookupPatientByIdentifier(req.actor, identifier);
      res.json(result);
    }),
    createVisit: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const visit = await doctorService.createVisit(req.actor, req.body);
      res.status(StatusCodes.CREATED).json({ visit });
    }),
    updateVisit: asyncHandler(async (req, res) => {
      if (!req.actor) {
        throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
      }
      const visitId = String(req.params.visitId ?? '');
      const visit = await doctorService.updateVisit(req.actor, visitId, req.body);
      res.json({ visit });
    }),
  };
}
