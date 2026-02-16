import { apiDownload, apiRequest, publicApiRequest } from './client';
import type {
  AccessRequest,
  AppUser,
  DoctorProfile,
  PatientProfile,
  SupportRequest,
  SupportRequestCategory,
  SupportRequestStatus,
  Visit,
} from '../types';

export const authApi = {
  session: () => apiRequest<{ user: AppUser }>('/auth/session'),
  bootstrap: (payload: {
    role: 'patient' | 'doctor';
    displayName: string;
    phone?: string;
    hospitalId?: string;
    patientProfile?: {
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
    doctorProfile?: {
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
    };
  }) => apiRequest<{ user: AppUser }>('/auth/bootstrap', { method: 'POST', body: payload }),
};

export const patientApi = {
  getProfile: () => apiRequest<{ profile: PatientProfile }>('/patient/profile'),
  updateProfile: (payload: Omit<PatientProfile, 'owner_uid' | 'global_patient_identifier'>) =>
    apiRequest<{ profile: PatientProfile }>('/patient/profile', { method: 'PUT', body: payload }),
  listAccessRequests: () => apiRequest<{ requests: AccessRequest[] }>('/patient/access-requests'),
  decideAccessRequest: (requestId: string, status: 'approved' | 'denied') =>
    apiRequest<{ request: AccessRequest }>(`/patient/access-requests/${requestId}`, {
      method: 'PATCH',
      body: { status },
    }),
  listVisits: () => apiRequest<{ visits: Visit[] }>('/patient/visits'),
  createSupportRequest: (payload: {
    category: SupportRequestCategory;
    subject: string;
    message: string;
  }) => apiRequest<{ request: SupportRequest }>('/patient/support', { method: 'POST', body: payload }),
  listSupportRequests: () => apiRequest<{ requests: SupportRequest[] }>('/patient/support'),
};

export const doctorApi = {
  getProfile: () => apiRequest<{ profile: DoctorProfile | null }>('/doctor/profile'),
  apply: (payload: {
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
  }) => apiRequest<{ profile: DoctorProfile }>('/doctor/apply', { method: 'POST', body: payload }),
  updateProfile: (payload: {
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
  }) => apiRequest<{ profile: DoctorProfile }>('/doctor/profile', { method: 'PUT', body: payload }),
  searchPatients: (query: string) =>
    apiRequest<{
      results: Array<{
        patient_uid: string;
        patient_identifier: string;
        demographics: PatientProfile['demographics'];
        contact: Pick<PatientProfile['contact'], 'email' | 'phone'>;
        blood_group: string;
        allergies: string[];
        access_status: 'waiting' | 'approved' | 'denied';
      }>;
    }>(`/doctor/patients/search?query=${encodeURIComponent(query)}`),
  createPatient: (payload: {
    temporary_password: string;
    patient_profile: {
      demographics: PatientProfile['demographics'];
      contact: PatientProfile['contact'];
      blood_group: string;
      allergies: string[];
      profile_image_base64: string;
      aadhaar_card_base64: string;
      hereditary_history: PatientProfile['hereditary_history'];
    };
    initial_visit?: {
      illness_or_problem: string;
      prescription: string;
      prescription_image_base64: string;
      reports_base64: string[];
      treatment_status:
        | 'active'
        | 'improving'
        | 'stable'
        | 'critical'
        | 'completed'
        | 'one_time_complete';
    };
  }) =>
    apiRequest<{
      user: AppUser;
      profile: PatientProfile;
      access_request: AccessRequest;
      initial_visit: Visit | null;
    }>('/doctor/patients', {
      method: 'POST',
      body: payload,
    }),
  createAccessRequest: (payload: { patient_identifier: string; reason: string }) =>
    apiRequest<{ accessRequest: AccessRequest }>('/doctor/access-requests', {
      method: 'POST',
      body: payload,
    }),
  listAccessRequests: () => apiRequest<{ requests: AccessRequest[] }>('/doctor/access-requests'),
  listVisitedPatients: () =>
    apiRequest<{
      patients: Array<{
        patient_uid: string;
        patient_identifier: string;
        patient_name: string;
        visit_count: number;
        latest_visit_at: string;
        latest_treatment_status:
          | 'active'
          | 'improving'
          | 'stable'
          | 'critical'
          | 'completed'
          | 'one_time_complete';
        latest_diagnosis: string;
        latest_hospital_id: string;
        hospital_ids: string[];
      }>;
    }>('/doctor/visited-patients'),
  lookupPatient: (identifier: string) =>
    apiRequest<{ patient: PatientProfile; visits: Visit[] }>(
      `/doctor/patients/lookup/${encodeURIComponent(identifier)}`,
    ),
  createVisit: (payload: {
    patient_identifier: string;
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
  }) => apiRequest<{ visit: Visit }>('/doctor/visits', { method: 'POST', body: payload }),
  exportPatientExcel: (identifier: string, filters?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (filters?.date_from) query.set('date_from', filters.date_from);
    if (filters?.date_to) query.set('date_to', filters.date_to);
    const suffix = query.toString();
    return apiDownload(
      `/doctor/patients/lookup/${encodeURIComponent(identifier)}/export${suffix ? `?${suffix}` : ''}`,
    );
  },
  updateVisit: (
    visitId: string,
    payload: Partial<{
      diagnosis: string;
      prescription: string;
      reports_base64: string[];
      treatment_status:
        | 'active'
        | 'improving'
        | 'stable'
        | 'critical'
        | 'completed'
        | 'one_time_complete';
    }>,
  ) => apiRequest<{ visit: Visit }>(`/doctor/visits/${visitId}`, { method: 'PATCH', body: payload }),
  createSupportRequest: (payload: {
    category: SupportRequestCategory;
    subject: string;
    message: string;
  }) => apiRequest<{ request: SupportRequest }>('/doctor/support', { method: 'POST', body: payload }),
  listSupportRequests: () => apiRequest<{ requests: SupportRequest[] }>('/doctor/support'),
};

export const adminApi = {
  listDoctorApplications: () =>
    apiRequest<{
      applications: Array<{
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
      }>;
    }>('/admin/doctor-applications'),
  decideDoctorApplication: (doctorUid: string, status: 'approved' | 'denied') =>
    apiRequest<{ profile: unknown }>(`/admin/doctor-applications/${doctorUid}`, {
      method: 'PATCH',
      body: { status },
    }),
};

export const adminPortalApi = {
  login: (payload: { email: string; password: string }) =>
    publicApiRequest<{ session: { token: string; email: string; expires_at: string } }>(
      '/admin-portal/login',
      {
        method: 'POST',
        body: payload,
      },
    ),
  logout: (token: string) =>
    publicApiRequest<void>('/admin-portal/logout', {
      method: 'POST',
      headers: {
        'x-admin-portal-token': token,
      },
    }),
  getLiveData: (token: string) =>
    publicApiRequest<{
      timestamp: string;
      summary: {
        total_doctors: number;
        doctor_pending: number;
        doctor_approved: number;
        doctor_denied: number;
        total_patients: number;
        patient_pending: number;
        patient_verified: number;
        patient_rejected: number;
        support_open: number;
        support_in_progress: number;
        support_resolved: number;
      };
      doctor_verifications: Array<{
        uid: string;
        doctor_name: string;
        doctor_email: string;
        doctor_phone: string;
        hospital_id: string;
        specializations: string[];
        qualification: string;
        license: string;
        approval_status: 'pending' | 'approved' | 'denied' | 'not_applicable';
        created_at: string;
        updated_at: string;
      }>;
      patient_verifications: Array<{
        uid: string;
        identifier: string;
        patient_name: string;
        email: string;
        phone: string;
        blood_group: string;
        verification_status: 'pending' | 'verified' | 'rejected' | 'not_applicable';
        created_at: string;
        updated_at: string;
      }>;
      doctor_database: Array<{
        uid: string;
        doctor_name: string;
        doctor_email: string;
        doctor_phone: string;
        hospital_id: string;
        specializations: string[];
        qualification: string;
        license: string;
        approval_status: 'pending' | 'approved' | 'denied' | 'not_applicable';
        created_at: string;
        updated_at: string;
      }>;
      patient_database: Array<{
        uid: string;
        identifier: string;
        patient_name: string;
        email: string;
        phone: string;
        blood_group: string;
        verification_status: 'pending' | 'verified' | 'rejected' | 'not_applicable';
        created_at: string;
        updated_at: string;
      }>;
      support_inbox: SupportRequest[];
    }>('/admin-portal/live-data', {
      headers: {
        'x-admin-portal-token': token,
      },
    }),
  verifyDoctor: (
    token: string,
    doctorUid: string,
    status: 'pending' | 'approved' | 'denied',
  ) =>
    publicApiRequest<{ profile: unknown }>(`/admin-portal/doctor-verifications/${doctorUid}`, {
      method: 'PATCH',
      headers: {
        'x-admin-portal-token': token,
      },
      body: { status },
    }),
  verifyPatient: (
    token: string,
    patientUid: string,
    status: 'pending' | 'verified' | 'rejected',
  ) =>
    publicApiRequest<{ user: unknown }>(`/admin-portal/patient-verifications/${patientUid}`, {
      method: 'PATCH',
      headers: {
        'x-admin-portal-token': token,
      },
      body: { status },
    }),
  updateSupportRequest: (
    token: string,
    requestId: string,
    status: SupportRequestStatus,
  ) =>
    publicApiRequest<{ request: SupportRequest }>(`/admin-portal/support-requests/${requestId}`, {
      method: 'PATCH',
      headers: {
        'x-admin-portal-token': token,
      },
      body: { status },
    }),
};
