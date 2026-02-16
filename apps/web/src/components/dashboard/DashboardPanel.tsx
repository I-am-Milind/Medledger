import type { PropsWithChildren, ReactNode } from 'react';
import styles from './DashboardPanel.module.css';

type DashboardPanelProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}>;

export function DashboardPanel({
  title,
  subtitle,
  actions,
  className = '',
  children,
}: DashboardPanelProps) {
  return (
    <article className={`${styles.panel} ${className}`.trim()}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.content}>{children}</div>
    </article>
  );
}
