import { AuthPortal } from './AuthPortal';

export function PatientAuthPage() {
  return (
    <AuthPortal
      portalRole="patient"
      heading="Patient Portal"
      description="Manage your profile, control medical-record access, and share your secure MedLedger identifier."
      highlights={[
        'Patient remains the data owner for record access.',
        'Approve or deny doctor requests from one dashboard.',
        'Generate and print your patient QR at any time.',
      ]}
    />
  );
}
