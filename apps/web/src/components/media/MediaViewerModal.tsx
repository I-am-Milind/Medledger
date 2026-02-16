import { useEffect } from 'react';
import styles from './MediaViewerModal.module.css';

type MediaViewerModalProps = {
  isOpen: boolean;
  title: string;
  src: string;
  kind: 'image' | 'pdf' | 'other';
  onClose: () => void;
};

export function MediaViewerModal({ isOpen, title, src, kind, onClose }: MediaViewerModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Media preview"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article className={styles.dialog}>
        <header className={styles.header}>
          <p className={styles.title} title={title}>
            {title}
          </p>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            Back
          </button>
        </header>
        <div className={styles.body}>
          {kind === 'image' ? (
            <img className={styles.image} src={src} alt={title} />
          ) : kind === 'pdf' ? (
            <object className={styles.frame} data={src} type="application/pdf">
              <a className={styles.fallback} href={src} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </object>
          ) : (
            <a className={styles.fallback} href={src} target="_blank" rel="noreferrer">
              Open file
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
