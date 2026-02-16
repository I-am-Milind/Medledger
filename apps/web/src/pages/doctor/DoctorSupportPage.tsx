import { doctorApi } from '../../api/services';
import { SupportDesk } from '../../components/support/SupportDesk';

export function DoctorSupportPage() {
  return (
    <SupportDesk
      heading="Doctor Help / Report"
      subtitle="Send support requests, incident reports, or admin contact messages."
      actorLabel="Doctor"
      loadRequests={doctorApi.listSupportRequests}
      createRequest={doctorApi.createSupportRequest}
    />
  );
}
