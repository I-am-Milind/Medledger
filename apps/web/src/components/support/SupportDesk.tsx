import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, HelpCircle, MessageSquareWarning, PhoneCall, Search, Send } from 'lucide-react';
import { DashboardPanel, StatusPill } from '../dashboard';
import { toastError, toastSuccess } from '../toast';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import type { SupportRequest, SupportRequestCategory } from '../../types';
import styles from './SupportDesk.module.css';

type SupportDeskProps = {
  heading: string;
  subtitle: string;
  actorLabel: 'Doctor' | 'Patient';
  loadRequests: () => Promise<{ requests: SupportRequest[] }>;
  createRequest: (payload: {
    category: SupportRequestCategory;
    subject: string;
    message: string;
  }) => Promise<{ request: SupportRequest }>;
};

type CategoryFilter = 'all' | SupportRequestCategory;

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }
  return parsed.toLocaleString();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function supportTone(status: SupportRequest['status']): 'warning' | 'info' | 'success' {
  if (status === 'resolved') {
    return 'success';
  }
  if (status === 'in_progress') {
    return 'info';
  }
  return 'warning';
}

function categoryLabel(category: SupportRequest['category']): string {
  if (category === 'report') {
    return 'Report';
  }
  if (category === 'contact') {
    return 'Contact';
  }
  return 'Help';
}

function categoryIcon(category: SupportRequestCategory) {
  if (category === 'report') {
    return <MessageSquareWarning size={14} />;
  }
  if (category === 'contact') {
    return <PhoneCall size={14} />;
  }
  return <HelpCircle size={14} />;
}

export function SupportDesk({
  heading,
  subtitle,
  actorLabel,
  loadRequests,
  createRequest,
}: SupportDeskProps) {
  const [category, setCategory] = useState<SupportRequestCategory>('help');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshRequests = useCallback(
    async (options: { silent?: boolean } = {}): Promise<void> => {
      if (options.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const response = await loadRequests();
        setRequests(response.requests);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load support requests.';
        setError(message);
        toastError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadRequests],
  );

  useEffect(() => {
    void refreshRequests();
    const intervalId = window.setInterval(() => {
      void refreshRequests({ silent: true });
    }, 12_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshRequests]);

  useLiveSyncRefresh(() => {
    void refreshRequests({ silent: true });
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();
    if (!normalizedSubject || !normalizedMessage) {
      const validationMessage = 'Subject and message are required.';
      setError(validationMessage);
      toastError(validationMessage);
      return;
    }

    if (normalizedSubject.length < 3) {
      const validationMessage = 'Subject must be at least 3 characters.';
      setError(validationMessage);
      toastError(validationMessage);
      return;
    }

    if (normalizedMessage.length < 3) {
      const validationMessage = 'Message must be at least 3 characters.';
      setError(validationMessage);
      toastError(validationMessage);
      return;
    }

    setSubmitting(true);
    try {
      await createRequest({
        category,
        subject: normalizedSubject,
        message: normalizedMessage,
      });
      setSubject('');
      setMessage('');
      const successMessage = `${actorLabel} request submitted to admin inbox.`;
      setSuccess(successMessage);
      toastSuccess(successMessage);
      await refreshRequests({ silent: true });
    } catch (submitError) {
      const rawMessage = submitError instanceof Error ? submitError.message : 'Unable to submit request.';
      const mappedMessage = rawMessage.includes('Request body validation failed')
        ? 'Please enter valid request text. Subject and message should be at least 3 characters.'
        : rawMessage;
      setError(mappedMessage);
      toastError(mappedMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredRequests = useMemo(() => {
    const normalizedSearch = normalize(search);
    return requests.filter((item) => {
      if (filter !== 'all' && item.category !== filter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const values = [
        item.subject,
        item.message,
        item.status,
        item.category,
        item.hospital_id,
        item.actor_email,
        item.created_at,
      ];
      return values.some((value) => normalize(value).includes(normalizedSearch));
    });
  }, [filter, requests, search]);

  const summary = useMemo(
    () => ({
      open: requests.filter((item) => item.status === 'open').length,
      inProgress: requests.filter((item) => item.status === 'in_progress').length,
      resolved: requests.filter((item) => item.status === 'resolved').length,
    }),
    [requests],
  );

  return (
    <section className={styles.page}>
      <div className={styles.columns}>
        <DashboardPanel
          className={styles.formPanel}
          title={heading}
          subtitle={subtitle}
          actions={
            <span className={styles.liveBadge}>
              <Activity size={14} />
              {refreshing ? 'Syncing...' : 'Live Synced'}
            </span>
          }
        >
          <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
            <label className={styles.field}>
              <span>Request Type</span>
              <div className={styles.selectWrap}>
                <span className={styles.fieldIcon}>{categoryIcon(category)}</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as SupportRequestCategory)}
                >
                  <option value="help">Help</option>
                  <option value="report">Report Issue</option>
                  <option value="contact">Contact Admin</option>
                </select>
              </div>
            </label>

            <label className={styles.field}>
              <span>Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Short title for this request"
                maxLength={140}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe the issue or help needed."
                rows={6}
                maxLength={4000}
                required
              />
            </label>

            <button className={styles.submitButton} type="submit" disabled={submitting}>
              <Send size={14} />
              {submitting ? 'Submitting...' : 'Submit to Admin'}
            </button>
          </form>

          {success ? <p className={styles.success}>{success}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </DashboardPanel>

        <DashboardPanel
          className={styles.inboxPanel}
          title={`${actorLabel} Support Requests`}
          subtitle="Track current request status from admin."
          actions={<StatusPill label={String(filteredRequests.length)} tone="info" />}
        >
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <p>Open</p>
              <strong>{summary.open}</strong>
            </article>
            <article className={styles.summaryCard}>
              <p>In Progress</p>
              <strong>{summary.inProgress}</strong>
            </article>
            <article className={styles.summaryCard}>
              <p>Resolved</p>
              <strong>{summary.resolved}</strong>
            </article>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.fieldIcon}>
              <Search size={14} />
            </span>
            <input
              placeholder="Search by subject, message, status, date"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterButton} ${filter === 'all' ? styles.filterButtonActive : ''}`.trim()}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filter === 'help' ? styles.filterButtonActive : ''}`.trim()}
              onClick={() => setFilter('help')}
            >
              Help
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filter === 'report' ? styles.filterButtonActive : ''}`.trim()}
              onClick={() => setFilter('report')}
            >
              Report
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filter === 'contact' ? styles.filterButtonActive : ''}`.trim()}
              onClick={() => setFilter('contact')}
            >
              Contact
            </button>
          </div>

          {loading ? <p className={styles.empty}>Loading support requests...</p> : null}
          {!loading && filteredRequests.length === 0 ? (
            <p className={styles.empty}>No support requests found.</p>
          ) : null}

          <div className={styles.requestList}>
            {filteredRequests.map((item) => (
              <article className={styles.requestCard} key={item.id}>
                <div className={styles.requestHeader}>
                  <div className={styles.requestTitleWrap}>
                    <span className={styles.categoryIcon}>{categoryIcon(item.category)}</span>
                    <p className={styles.requestTitle}>{item.subject}</p>
                  </div>
                  <StatusPill label={item.status} tone={supportTone(item.status)} />
                </div>
                <p className={styles.requestMeta}>
                  {categoryLabel(item.category)} | {formatDateTime(item.created_at)}
                </p>
                <p className={styles.requestMessage}>{item.message}</p>
              </article>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </section>
  );
}
