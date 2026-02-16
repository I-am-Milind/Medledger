import { useEffect, useRef } from 'react';
import { subscribeLiveSync } from './liveSync';

type UseLiveSyncRefreshOptions = {
  throttleMs?: number;
};

export function useLiveSyncRefresh(
  onRefresh: () => void,
  options: UseLiveSyncRefreshOptions = {},
): void {
  const throttleMs = options.throttleMs ?? 1200;
  const callbackRef = useRef(onRefresh);
  const lastRunRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    return subscribeLiveSync((payload) => {
      if (payload.type !== 'data_changed') {
        return;
      }

      const now = Date.now();
      if (now - lastRunRef.current < throttleMs) {
        return;
      }

      lastRunRef.current = now;
      callbackRef.current();
    });
  }, [throttleMs]);
}
