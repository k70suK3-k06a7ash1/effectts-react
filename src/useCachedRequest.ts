import { useCallback, useState, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Runtime from 'effect/Runtime';
import * as Duration from 'effect/Duration';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export function useCachedRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    ttl?: Duration.Duration;
    capacity?: number;
    runtime?: Runtime.Runtime<never>;
    onCacheHit?: (key: string) => void;
    onCacheMiss?: (key: string) => void;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  clearCache: (predicate?: (key: string) => boolean) => void;
  getCacheStats: () => CacheStats;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const cacheRef = useRef(new Map<string, CacheEntry<any>>());
  const statsRef = useRef<CacheStats>({ hits: 0, misses: 0, size: 0 });
  const resolverRef = useRef(resolver);

  resolverRef.current = resolver;

  const getCacheKey = useCallback((request: any): string => {
    return JSON.stringify(request);
  }, []);

  const isExpired = useCallback(
    (entry: CacheEntry<any>): boolean => {
      const ttlMs = options?.ttl
        ? Duration.toMillis(options.ttl)
        : 5 * 60 * 1000; // Default 5 minutes
      const now = Date.now();
      return now - entry.timestamp > ttlMs;
    },
    [options?.ttl]
  );

  const evictOldest = useCallback(() => {
    if (cacheRef.current.size === 0) return;

    const oldestKey = Array.from(cacheRef.current.entries()).reduce(
      (oldest, [key, entry]) => {
        return entry.timestamp < oldest.timestamp
          ? { key, timestamp: entry.timestamp }
          : oldest;
      },
      { key: '', timestamp: Infinity }
    ).key;

    if (oldestKey) {
      cacheRef.current.delete(oldestKey);
    }
  }, []);

  const getCachedValue = useCallback(
    <E,>(cacheKey: string): E | null => {
      const cached = cacheRef.current.get(cacheKey);

      if (!cached) {
        statsRef.current.misses++;
        options?.onCacheMiss?.(cacheKey);
        return null;
      }

      if (isExpired(cached)) {
        cacheRef.current.delete(cacheKey);
        statsRef.current.misses++;
        statsRef.current.size = cacheRef.current.size;
        options?.onCacheMiss?.(cacheKey);
        return null;
      }

      statsRef.current.hits++;
      options?.onCacheHit?.(cacheKey);
      return cached.value as E;
    },
    [isExpired, options]
  );

  const setCachedValue = useCallback(
    (cacheKey: string, value: any) => {
      // Capacity limit check
      const capacity = options?.capacity ?? 100;
      if (cacheRef.current.size >= capacity) {
        evictOldest();
      }

      cacheRef.current.set(cacheKey, {
        value,
        timestamp: Date.now(),
      });

      statsRef.current.size = cacheRef.current.size;
    },
    [options?.capacity, evictOldest]
  );

  const execute = useCallback(
    <E, R>(request: Request.Request<E, R>): Effect.Effect<E, any> => {
      const cacheKey = getCacheKey(request);
      const cached = getCachedValue<E>(cacheKey);

      if (cached !== null) {
        return Effect.succeed(cached);
      }

      return Effect.request(request, resolverRef.current).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            setCachedValue(cacheKey, result);
          })
        )
      );
    },
    [getCacheKey, getCachedValue, setCachedValue]
  );

  const executePromise = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      setLoading(true);
      setError(null);

      try {
        const effect = execute(request);
        const result = options?.runtime
          ? await Runtime.runPromise(options.runtime)(effect)
          : await Effect.runPromise(effect);

        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [execute, options?.runtime]
  );

  const clearCache = useCallback((predicate?: (key: string) => boolean) => {
    if (!predicate) {
      cacheRef.current.clear();
      statsRef.current.size = 0;
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of cacheRef.current.keys()) {
      if (predicate(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => cacheRef.current.delete(key));
    statsRef.current.size = cacheRef.current.size;
  }, []);

  const getCacheStats = useCallback((): CacheStats => {
    return { ...statsRef.current };
  }, []);

  return {
    execute,
    executePromise,
    clearCache,
    getCacheStats,
    loading,
    error,
  };
}
