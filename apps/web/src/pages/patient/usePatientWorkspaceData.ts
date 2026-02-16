import { useCallback, useEffect, useState } from 'react';
import { patientApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { useLiveSyncRefresh } from '../../realtime/useLiveSyncRefresh';
import { loadCachedResource, readCachedResource } from '../../utils/resourceCache';
import type { AccessRequest, PatientProfile, Visit } from '../../types';

export type PatientWorkspaceData = {
  profile: PatientProfile;
  accessRequests: AccessRequest[];
  visits: Visit[];
  partialErrors: string[];
  syncedAt: number;
};

async function fetchPatientWorkspaceData(): Promise<PatientWorkspaceData> {
  const profileResult = await patientApi.getProfile();
  const partialErrors: string[] = [];

  const [requestsResult, visitsResult] = await Promise.allSettled([
    patientApi.listAccessRequests(),
    patientApi.listVisits(),
  ]);

  const accessRequests =
    requestsResult.status === 'fulfilled' ? requestsResult.value.requests : [];
  if (requestsResult.status === 'rejected') {
    partialErrors.push('Unable to refresh access requests.');
  }

  const visits = visitsResult.status === 'fulfilled' ? visitsResult.value.visits : [];
  if (visitsResult.status === 'rejected') {
    partialErrors.push('Unable to refresh visits.');
  }

  return {
    profile: profileResult.profile,
    accessRequests,
    visits,
    partialErrors,
    syncedAt: Date.now(),
  };
}

export function usePatientWorkspaceData() {
  const { appUser } = useAuth();
  const cacheKey = `patient-dashboard:${appUser?.uid ?? 'anonymous'}`;
  const cachedData = readCachedResource<PatientWorkspaceData>(cacheKey);

  const [data, setData] = useState<PatientWorkspaceData | null>(cachedData);
  const [error, setError] = useState(cachedData?.partialErrors.join(' ') ?? '');
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}): Promise<void> => {
      const silent = options.silent ?? false;
      const force = options.force ?? false;
      const hasCached = Boolean(readCachedResource<PatientWorkspaceData>(cacheKey));

      if (!silent && !hasCached) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await loadCachedResource(cacheKey, fetchPatientWorkspaceData, {
          maxAgeMs: 15_000,
          force,
        });
        setData(next);
        setError(next.partialErrors.join(' '));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    const latestCache = readCachedResource<PatientWorkspaceData>(cacheKey);
    if (latestCache) {
      setData(latestCache);
      setError(latestCache.partialErrors.join(' '));
      setLoading(false);
      void loadData({ silent: true });
    } else {
      setData(null);
      setError('');
      setLoading(true);
      void loadData();
    }
  }, [cacheKey, loadData]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') {
        void loadData({ silent: true, force: true });
      }
    };

    const intervalId = window.setInterval(sync, 15_000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [loadData]);

  useLiveSyncRefresh(() => {
    void loadData({ silent: true, force: true });
  });

  const decideAccessRequest = useCallback(
    async (requestId: string, status: 'approved' | 'denied'): Promise<void> => {
      try {
        await patientApi.decideAccessRequest(requestId, status);
        await loadData({ silent: true, force: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update request');
      }
    },
    [loadData],
  );

  return {
    cacheKey,
    data,
    error,
    loading,
    refreshing,
    loadData,
    decideAccessRequest,
  };
}
