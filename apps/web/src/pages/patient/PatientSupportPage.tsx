import { patientApi } from '../../api/services';
import { SupportDesk } from '../../components/support/SupportDesk';

export function PatientSupportPage() {
  return (
    <SupportDesk
      heading="Patient Help / Report"
      subtitle="Submit support, report, or contact messages to MedLedger admin."
      actorLabel="Patient"
      loadRequests={patientApi.listSupportRequests}
      createRequest={patientApi.createSupportRequest}
    />
  );
}
