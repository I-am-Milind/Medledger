import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CameraCaptureModal.module.css';

type CameraCaptureModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
};

function mapCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return 'Unable to access camera. Please try again.';
  }

  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Camera access denied. Allow camera permission in browser site settings.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera was detected on this device.';
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Camera is busy in another app. Close other camera apps and retry.';
  }
  if (error.name === 'OverconstrainedError') {
    return 'Camera constraints are not supported on this device.';
  }
  return 'Camera is unavailable. Check permissions and retry.';
}

export function CameraCaptureModal({ isOpen, title, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (!streamRef.current) {
      return;
    }
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setStarting(true);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser/device does not support live camera capture.');
      setStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      setError(mapCameraError(err));
    } finally {
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

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

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCapture(dataUrl);
  }, [onCapture]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Live camera capture"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article className={styles.dialog}>
        <header className={styles.header}>
          <p className={styles.title}>{title}</p>
        </header>

        <div className={styles.body}>
          <div className={styles.videoWrap}>
            <video className={styles.video} ref={videoRef} playsInline muted autoPlay />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {!error ? <p className={styles.hint}>Allow camera access to capture a live image.</p> : null}
          <canvas className={styles.canvas} ref={canvasRef} aria-hidden="true" />
        </div>

        <footer className={styles.footer}>
          <button className={styles.buttonAlt} type="button" onClick={onClose}>
            Cancel
          </button>
          {error ? (
            <button className={styles.buttonAlt} type="button" onClick={() => void startCamera()} disabled={starting}>
              {starting ? 'Retrying...' : 'Retry Permission'}
            </button>
          ) : null}
          <button
            className={styles.button}
            type="button"
            onClick={handleCapture}
            disabled={starting || Boolean(error)}
          >
            {starting ? 'Starting camera...' : 'Capture'}
          </button>
        </footer>
      </article>
    </div>
  );
}
