import styles from './StatusPill.module.css';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return <span className={`${styles.pill} ${styles[tone]}`.trim()}>{label}</span>;
}
