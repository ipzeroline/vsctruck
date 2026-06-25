type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getTimedCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
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
