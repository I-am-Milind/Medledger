export type ToastTone = 'success' | 'error' | 'info';

export type ToastPayload = {
  id: string;
  tone: ToastTone;
  message: string;
  durationMs: number;
};

type Listener = (toast: ToastPayload) => void;

const listeners = new Set<Listener>();

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emit(toast: ToastPayload): void {
  listeners.forEach((listener) => listener(toast));
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pushToast(
  tone: ToastTone,
  message: string,
  options: { durationMs?: number } = {},
): void {
  emit({
    id: nextId(),
    tone,
    message,
    durationMs: options.durationMs ?? 3400,
  });
}

export function toastSuccess(message: string): void {
  pushToast('success', message);
}

export function toastError(message: string): void {
  pushToast('error', message, { durationMs: 4200 });
}

export function toastInfo(message: string): void {
  pushToast('info', message);
}
