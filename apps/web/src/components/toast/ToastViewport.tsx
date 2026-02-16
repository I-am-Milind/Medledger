import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { subscribeToast, type ToastPayload } from './toastBus';
import styles from './ToastViewport.module.css';

function toneIcon(tone: ToastPayload['tone']) {
  if (tone === 'success') {
    return <CheckCircle2 size={16} />;
  }
  if (tone === 'error') {
    return <AlertTriangle size={16} />;
  }
  return <Info size={16} />;
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((previous) => [...previous, toast]);
      window.setTimeout(() => {
        setToasts((previous) => previous.filter((item) => item.id !== toast.id));
      }, toast.durationMs);
    });
  }, []);

  return (
    <section className={styles.viewport} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`${styles.toast} ${
            toast.tone === 'success'
              ? styles.success
              : toast.tone === 'error'
                ? styles.error
                : styles.info
          }`.trim()}
        >
          <span className={styles.icon}>{toneIcon(toast.tone)}</span>
          <p>{toast.message}</p>
          <button
            type="button"
            className={styles.close}
            onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))}
            aria-label="Dismiss notification"
          >
            x
          </button>
        </article>
      ))}
    </section>
  );
}
