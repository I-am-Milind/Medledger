export type Base64Attachment = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
};

export type MedicalRecord = {
  id: string;
  patientId: string;
  hospitalId: string;
  summary: string;
  tags: string[];
  attachments: Base64Attachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditAction =
  | 'RECORD_READ'
  | 'RECORD_WRITE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT';
