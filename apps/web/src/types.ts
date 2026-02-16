export const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type DoctorApprovalStatus = 'not_applicable' | 'pending' | 'approved' | 'denied';

export type AppUser = {
  uid: string;
  email: string;
  role: Role;
  displayName?: string;
  phone?: string;
  hospitalId?: string;
  doctorApprovalStatus: DoctorApprovalStatus;
  patientVerificationStatus?: 'not_applicable' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type PatientProfile = {
  owner_uid: string;
  global_patient_identifier: string;
  demographics: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
  };
  contact: {
    email: string;
    phone: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
  blood_group: string;
  allergies: string[];
  profile_image_base64: string;
  aadhaar_card_base64: string;
  created_by?: {
    doctor_uid: string;
    doctor_name: string;
    hospital_id: string;
    created_at: string;
  };
  hereditary_history: Array<{
    relation: string;
    condition: string;
    age_of_detection: number | null;
    status: string;
    affected_person_name: string;
    affected_people_count: number | null;
    doctor_report_image_base64: string;
    notes: string;
  }>;
};

export type DoctorProfile = {
  uid: string;
  doctor_name: string;
  doctor_email: string;
  doctor_phone: string;
  hospital_id: string;
  hospital_logo_base64: string;
  specializations: string[];
  qualification: string;
  license: string;
  profile_image_base64: string;
  verification_docs_base64: string[];
  approval_status: 'pending' | 'approved' | 'denied' | 'not_applicable';
};

export type AccessRequest = {
  id: string;
  doctor_uid: string;
  doctor_hospital_id: string;
  doctor_name?: string;
  doctor_phone?: string;
  hospital_logo_base64?: string;
  patient_uid: string;
  patient_identifier: string;
  reason: string;
  status: 'waiting' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  patient_uid: string;
  patient_identifier: string;
  doctor_uid: string;
  doctor_name?: string;
  doctor_phone?: string;
  hospital_logo_base64?: string;
  hospital_id: string;
  diagnosis: string;
  prescription: string;
  paper_prescription_image_base64?: string;
  clinical_reports_base64?: string[];
  reports_base64: string[];
  treatment_status:
    | 'active'
    | 'improving'
    | 'stable'
    | 'critical'
    | 'completed'
    | 'one_time_complete';
  created_at: string;
  updated_at: string;
};

export type SupportRequestCategory = 'help' | 'report' | 'contact';
export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved';

export type SupportRequest = {
  id: string;
  actor_uid: string;
  actor_role: 'patient' | 'doctor';
  actor_name: string;
  actor_email: string;
  actor_phone: string;
  hospital_id: string;
  category: SupportRequestCategory;
  subject: string;
  message: string;
  status: SupportRequestStatus;
  created_at: string;
  updated_at: string;
  resolved_by_uid?: string;
  resolved_by_email?: string;
};
