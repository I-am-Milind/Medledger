import { AuthPortal } from './AuthPortal';

export function DoctorAuthPage() {
  return (
    <AuthPortal
      portalRole="doctor"
      heading="Doctor Portal"
      description="Hospital-attached clinical access with secure patient lookup and controlled treatment updates."
      highlights={[
        'Hospital-linked doctor account is required before patient access workflows.',
        'Hospital isolation rules are enforced by backend policy.',
        'Visits, prescriptions, and reports are audit-ready.',
      ]}
    />
  );
}
