import { env } from '../config/env';

export type LiveSyncPayload = {
  type: 'connected' | 'heartbeat' | 'data_changed';
  timestamp: string;
  method?: string;
  path?: string;
  requestId?: string;
};

type Listener = (payload: LiveSyncPayload) => void;

const listeners = new Set<Listener>();

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;

function buildWebSocketUrl(): string {
  const url = new URL(env.apiBaseUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const apiPath = url.pathname.replace(/\/+$/, '');
  const basePath = apiPath.endsWith('/api') ? apiPath.slice(0, -4) : apiPath;
  const normalizedPath = `${basePath}/ws/live`.replace(/\/{2,}/g, '/');
  return `${protocol}//${url.host}${normalizedPath}`;
}

function emit(payload: LiveSyncPayload): void {
  listeners.forEach((listener) => listener(payload));
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) {
    return;
  }

  const delay = Math.min(10_000, 1000 * 2 ** Math.min(reconnectAttempt, 4));
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectLiveSync();
  }, delay);
}

function connectLiveSync(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = buildWebSocketUrl();
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    reconnectAttempt = 0;
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as LiveSyncPayload;
      if (!parsed || typeof parsed.type !== 'string') {
        return;
      }
      emit(parsed);
    } catch {
      // Ignore malformed payloads.
    }
  };

  socket.onerror = () => {
    socket?.close();
  };

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };
}

export function subscribeLiveSync(listener: Listener): () => void {
  listeners.add(listener);
  connectLiveSync();
  return () => {
    listeners.delete(listener);
  };
}

export function ensureLiveSyncConnection(): void {
  connectLiveSync();
}
