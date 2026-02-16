import { useEffect, useState } from 'react';
import { adminApi } from '../../api/services';
import { DashboardPanel, DashboardStat, StatusPill } from '../../components/dashboard';
import styles from './AdminDashboard.module.css';

type DoctorApplication = {
  uid: string;
  doctor_name: string;
  doctor_email: string;
  doctor_phone: string;
  hospital_id: string;
  specializations: string[];
  qualification: string;
  license: string;
  approval_status: 'pending' | 'approved' | 'denied' | 'not_applicable';
};

export function AdminDashboard() {
  const [applications, setApplications] = useState<DoctorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pendingCount = applications.filter((application) => application.approval_status === 'pending').length;
  const approvedCount = applications.filter((application) => application.approval_status === 'approved').length;
  const deniedCount = applications.filter((application) => application.approval_status === 'denied').length;

  async function load(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.listDoctorApplications();
      setApplications(result.applications as DoctorApplication[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(doctorUid: string, status: 'approved' | 'denied'): Promise<void> {
    try {
      await adminApi.decideDoctorApplication(doctorUid, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application');
    }
  }

  if (loading) {
    return (
      <section className={styles.dashboard}>
        <DashboardPanel title="Admin Dashboard" subtitle="Loading approval pipeline...">
          <p className={styles.empty}>Loading admin dashboard...</p>
        </DashboardPanel>
      </section>
    );
  }

  return (
    <section className={styles.dashboard}>
      <section className={styles.stats}>
        <DashboardStat label="Total Applications" value={applications.length} tone="primary" />
        <DashboardStat label="Pending" value={pendingCount} tone="warning" />
        <DashboardStat label="Approved" value={approvedCount} tone="success" />
        <DashboardStat label="Denied" value={deniedCount} tone="danger" />
      </section>

      <DashboardPanel
        title="Doctor Approval Queue"
        subtitle="Review doctor profiles and approve hospital-bound access."
      >
        {error ? <p className={styles.error}>{error}</p> : null}
        {applications.length === 0 ? <p className={styles.empty}>No applications found.</p> : null}
        <div className={styles.list}>
          {applications.map((application) => (
            <article className={styles.item} key={application.uid}>
              <div className={styles.itemHeader}>
                <div>
                  <p className={styles.name}>{application.doctor_name || application.uid}</p>
                  <p className={styles.meta}>
                    {application.doctor_email || 'No email'} | {application.doctor_phone || 'No phone'}
                  </p>
                </div>
                <StatusPill
                  label={application.approval_status}
                  tone={
                    application.approval_status === 'approved'
                      ? 'success'
                      : application.approval_status === 'denied'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </div>

              <p className={styles.meta}>UID: {application.uid}</p>
              <p className={styles.meta}>Hospital: {application.hospital_id || 'Not provided'}</p>
              <p className={styles.meta}>
                Specializations:{' '}
                {application.specializations.length === 0
                  ? 'Not provided'
                  : application.specializations.join(', ')}
              </p>
              <p className={styles.meta}>Qualification: {application.qualification || 'Not provided'}</p>
              <p className={styles.meta}>License: {application.license || 'Not provided'}</p>

              <div className={styles.actions}>
                <button
                  className={styles.approveButton}
                  type="button"
                  onClick={() => {
                    void decide(application.uid, 'approved');
                  }}
                >
                  Approve
                </button>
                <button
                  className={styles.denyButton}
                  type="button"
                  onClick={() => {
                    void decide(application.uid, 'denied');
                  }}
                >
                  Deny
                </button>
              </div>
            </article>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}
