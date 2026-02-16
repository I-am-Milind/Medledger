import type { MouseEventHandler } from 'react';
import styles from './MediaIconButton.module.css';

type MediaIconButtonProps = {
  type: 'view' | 'camera';
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 5c5.31 0 9.34 3.18 10.85 6.56a1.04 1.04 0 0 1 0 .88C21.34 15.82 17.31 19 12 19s-9.34-3.18-10.85-6.56a1.04 1.04 0 0 1 0-.88C2.66 8.18 6.69 5 12 5Zm0 2C7.73 7 4.4 9.5 3.17 12c1.23 2.5 4.56 5 8.83 5s7.6-2.5 8.83-5c-1.23-2.5-4.56-5-8.83-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6Z"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.2 4a2 2 0 0 0-1.73 1H4a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-2.47A2 2 0 0 0 15.8 4H8.2Zm3.8 4a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}

export function MediaIconButton({
  type,
  label,
  onClick,
  disabled = false,
  className = '',
}: MediaIconButtonProps) {
  return (
    <button
      className={`${styles.button} ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {type === 'view' ? <EyeIcon /> : <CameraIcon />}
    </button>
  );
}
