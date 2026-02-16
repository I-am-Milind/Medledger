export const DOCTOR_SPECIALIZATIONS = [
  'General Doctor',
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Gynecology',
  'Ophthalmology',
  'ENT',
  'Psychiatry',
  'Oncology',
  'Radiology',
  'Anesthesiology',
  'Nephrology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Urology',
  'Emergency Medicine',
  'General Surgery',
] as const;

export const MAX_DOCTOR_SPECIALIZATIONS = 3;

export type DoctorSpecialization = (typeof DOCTOR_SPECIALIZATIONS)[number];
