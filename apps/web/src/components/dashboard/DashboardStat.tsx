import styles from './DashboardStat.module.css';

type DashboardStatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type DashboardStatProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: DashboardStatTone;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
};

export function DashboardStat({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  active = false,
  ariaLabel,
}: DashboardStatProps) {
  const className = `${styles.stat} ${styles[tone]} ${onClick ? styles.clickable : ''} ${active ? styles.active : ''}`.trim();

  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </button>
    );
  }

  return (
    <article className={className}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </article>
  );
}
