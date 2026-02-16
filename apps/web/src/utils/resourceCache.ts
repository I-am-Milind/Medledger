type CacheEntry<T> = {
  data?: T;
  updatedAt: number;
  inFlight?: Promise<T>;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export function readCachedResource<T>(key: string): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry || entry.data === undefined) {
    return null;
  }
  return entry.data;
}

export function writeCachedResource<T>(key: string, data: T): void {
  cacheStore.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

type LoadCachedResourceOptions = {
  maxAgeMs?: number;
  force?: boolean;
};

export async function loadCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: LoadCachedResourceOptions = {},
): Promise<T> {
  const maxAgeMs = options.maxAgeMs ?? 0;
  const force = options.force ?? false;
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (
    !force &&
    existing?.data !== undefined &&
    (maxAgeMs <= 0 || now - existing.updatedAt <= maxAgeMs)
  ) {
    return existing.data;
  }

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const inFlight = fetcher()
    .then((data) => {
      cacheStore.set(key, {
        data,
        updatedAt: Date.now(),
      });
      return data;
    })
    .catch((error) => {
      if (existing?.data !== undefined) {
        cacheStore.set(key, {
          data: existing.data,
          updatedAt: existing.updatedAt,
        });
      } else {
        cacheStore.delete(key);
      }
      throw error;
    });

  cacheStore.set(key, {
    data: existing?.data,
    updatedAt: existing?.updatedAt ?? 0,
    inFlight,
  });

  return inFlight;
}

export function clearCachedResource(key: string): void {
  cacheStore.delete(key);
}
