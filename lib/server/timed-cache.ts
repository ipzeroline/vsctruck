type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_MAX_ENTRIES = 100;
const CACHE_PRUNE_INTERVAL_MS = 60_000;
let lastPrunedAt = 0;

export async function getTimedCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  pruneCache(now);
  const current = cache.get(key) as CacheEntry<T> | undefined;

  if (current?.value !== undefined && current.expiresAt > now) {
    return { value: current.value, hit: true };
  }

  if (current?.promise) {
    return { value: await current.promise, hit: true };
  }

  const promise = loader()
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    promise,
    expiresAt: now + ttlMs,
  });

  return { value: await promise, hit: false };
}

export function deleteTimedCache(keyPrefix: string): void {
  for (const key of cache.keys()) {
    if (key === keyPrefix || key.startsWith(`${keyPrefix}:`)) {
      cache.delete(key);
    }
  }
}

function pruneCache(now: number): void {
  if (cache.size <= CACHE_MAX_ENTRIES && now - lastPrunedAt < CACHE_PRUNE_INTERVAL_MS) {
    return;
  }

  lastPrunedAt = now;
  for (const [key, entry] of cache.entries()) {
    if (!entry.promise && entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}
