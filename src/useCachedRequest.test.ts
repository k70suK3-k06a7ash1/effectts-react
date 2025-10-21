import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCachedRequest } from './useCachedRequest';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Duration from 'effect/Duration';

// Define test request types
interface GetUser extends Request.Request<{ id: string; name: string }, Error> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

// Mock API call counter
let apiCallCount = 0;

// Create a simple resolver for testing
const createUserResolver = () => {
  apiCallCount = 0;
  return RequestResolver.fromEffect((req: GetUser) => {
    apiCallCount++;
    return Effect.succeed({ id: req.id, name: `User ${req.id}` });
  });
};

// Create a resolver that can fail
const createFailingUserResolver = () => {
  return RequestResolver.makeBatched((requests: readonly GetUser[]) =>
    Effect.gen(function* () {
      return requests.map((req) =>
        req.id === 'error'
          ? Request.completeEffect(req, Effect.fail(new Error('User not found')))
          : Request.completeEffect(req, Effect.succeed({ id: req.id, name: `User ${req.id}` }))
      );
    })
  );
};

describe('useCachedRequest', () => {
  beforeEach(() => {
    apiCallCount = 0;
  });

  describe('Basic functionality', () => {
    it('should initialize with default state', () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.execute).toBe('function');
      expect(typeof result.current.executePromise).toBe('function');
      expect(typeof result.current.clearCache).toBe('function');
      expect(typeof result.current.getCacheStats).toBe('function');
    });

    it('should execute a request successfully', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      const user = await result.current.executePromise(GetUser({ id: '1' }));

      expect(user).toEqual({ id: '1', name: 'User 1' });
      expect(apiCallCount).toBe(1);
    });

    it('should handle request errors', async () => {
      const testError = new Error('User not found');
      const resolver = RequestResolver.fromEffect((req: GetUser) =>
        Effect.fail(testError)
      );
      const { result } = renderHook(() => useCachedRequest(resolver));

      await expect(
        result.current.executePromise(GetUser({ id: 'error' }))
      ).rejects.toThrow('User not found');
    });
  });

  describe('Cache hit (within TTL)', () => {
    it('should return cached value on second request', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      // First request - cache miss
      const user1 = await result.current.executePromise(GetUser({ id: '1' }));
      expect(user1).toEqual({ id: '1', name: 'User 1' });
      expect(apiCallCount).toBe(1);

      // Second request - cache hit
      const user2 = await result.current.executePromise(GetUser({ id: '1' }));
      expect(user2).toEqual({ id: '1', name: 'User 1' });
      expect(apiCallCount).toBe(1); // Should not increment
    });

    it('should track cache hits in stats', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      // First request - miss
      await result.current.executePromise(GetUser({ id: '1' }));
      let stats = result.current.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.size).toBe(1);

      // Second request - hit
      await result.current.executePromise(GetUser({ id: '1' }));
      stats = result.current.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should call onCacheHit callback', async () => {
      const resolver = createUserResolver();
      const onCacheHit = vi.fn();
      const { result } = renderHook(() =>
        useCachedRequest(resolver, { onCacheHit })
      );

      await result.current.executePromise(GetUser({ id: '1' }));
      expect(onCacheHit).not.toHaveBeenCalled();

      await result.current.executePromise(GetUser({ id: '1' }));
      expect(onCacheHit).toHaveBeenCalledTimes(1);
      expect(onCacheHit).toHaveBeenCalledWith(expect.stringContaining('"id":"1"'));
    });
  });

  describe('Cache miss (initial access)', () => {
    it('should track cache misses in stats', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      await result.current.executePromise(GetUser({ id: '1' }));
      await result.current.executePromise(GetUser({ id: '2' }));

      const stats = result.current.getCacheStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
      expect(stats.size).toBe(2);
    });

    it('should call onCacheMiss callback', async () => {
      const resolver = createUserResolver();
      const onCacheMiss = vi.fn();
      const { result } = renderHook(() =>
        useCachedRequest(resolver, { onCacheMiss })
      );

      await result.current.executePromise(GetUser({ id: '1' }));
      expect(onCacheMiss).toHaveBeenCalledTimes(1);
      expect(onCacheMiss).toHaveBeenCalledWith(expect.stringContaining('"id":"1"'));
    });
  });

  describe('TTL expiration', () => {
    it('should refetch after TTL expires', async () => {
      vi.useFakeTimers();
      const resolver = createUserResolver();
      const { result } = renderHook(() =>
        useCachedRequest(resolver, {
          ttl: Duration.seconds(1),
        })
      );

      // First request
      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(1);

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      // Second request after TTL expiration
      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(2);

      vi.useRealTimers();
    });

    it('should track expired entries as cache misses', async () => {
      vi.useFakeTimers();
      const resolver = createUserResolver();
      const { result } = renderHook(() =>
        useCachedRequest(resolver, {
          ttl: Duration.seconds(1),
        })
      );

      await result.current.executePromise(GetUser({ id: '1' }));
      let stats = result.current.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      vi.advanceTimersByTime(1100);

      await result.current.executePromise(GetUser({ id: '1' }));
      stats = result.current.getCacheStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Capacity limit', () => {
    it('should evict oldest entry when capacity is reached', async () => {
      vi.useFakeTimers();
      const resolver = createUserResolver();
      const { result } = renderHook(() =>
        useCachedRequest(resolver, {
          capacity: 2,
        })
      );

      // Fill cache to capacity
      await result.current.executePromise(GetUser({ id: '1' }));
      vi.advanceTimersByTime(10);
      await result.current.executePromise(GetUser({ id: '2' }));
      vi.advanceTimersByTime(10);

      let stats = result.current.getCacheStats();
      expect(stats.size).toBe(2);

      // Add third entry - should evict oldest (id: '1')
      await result.current.executePromise(GetUser({ id: '3' }));
      stats = result.current.getCacheStats();
      expect(stats.size).toBe(2);

      // Request evicted entry - should be a miss
      const initialMisses = stats.misses;
      await result.current.executePromise(GetUser({ id: '1' }));
      stats = result.current.getCacheStats();
      expect(stats.misses).toBe(initialMisses + 1);

      vi.useRealTimers();
    });
  });

  describe('Cache clearing', () => {
    it('should clear all cache when called without predicate', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      await result.current.executePromise(GetUser({ id: '1' }));
      await result.current.executePromise(GetUser({ id: '2' }));

      let stats = result.current.getCacheStats();
      expect(stats.size).toBe(2);

      result.current.clearCache();

      stats = result.current.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear cache entries matching predicate', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      await result.current.executePromise(GetUser({ id: '1' }));
      await result.current.executePromise(GetUser({ id: '2' }));
      await result.current.executePromise(GetUser({ id: '3' }));

      let stats = result.current.getCacheStats();
      expect(stats.size).toBe(3);

      // Clear only entries containing id: '2'
      result.current.clearCache((key) => key.includes('"id":"2"'));

      stats = result.current.getCacheStats();
      expect(stats.size).toBe(2);

      // Verify the right entry was cleared
      const initialApiCalls = apiCallCount;
      await result.current.executePromise(GetUser({ id: '2' }));
      expect(apiCallCount).toBe(initialApiCalls + 1); // Should refetch

      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(initialApiCalls + 1); // Should use cache
    });
  });

  describe('Cache statistics', () => {
    it('should provide accurate cache statistics', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      let stats = result.current.getCacheStats();
      expect(stats).toEqual({ hits: 0, misses: 0, size: 0 });

      // Add 3 unique entries
      await result.current.executePromise(GetUser({ id: '1' }));
      await result.current.executePromise(GetUser({ id: '2' }));
      await result.current.executePromise(GetUser({ id: '3' }));

      stats = result.current.getCacheStats();
      expect(stats).toEqual({ hits: 0, misses: 3, size: 3 });

      // Hit cached entries
      await result.current.executePromise(GetUser({ id: '1' }));
      await result.current.executePromise(GetUser({ id: '2' }));

      stats = result.current.getCacheStats();
      expect(stats).toEqual({ hits: 2, misses: 3, size: 3 });
    });

    it('should return a copy of stats object', () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      const stats1 = result.current.getCacheStats();
      const stats2 = result.current.getCacheStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Different objects
    });
  });

  describe('Execute Effect API', () => {
    it('should return an Effect when using execute', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      const effect = result.current.execute(GetUser({ id: '1' }));
      const user = await Effect.runPromise(effect);

      expect(user).toEqual({ id: '1', name: 'User 1' });
    });

    it('should cache results from execute calls', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));
      expect(apiCallCount).toBe(1);

      await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));
      expect(apiCallCount).toBe(1); // Should use cache
    });
  });

  describe('Loading and error state', () => {
    it('should update loading state during executePromise', async () => {
      const resolver = RequestResolver.fromEffect((req: GetUser) =>
        Effect.delay(Effect.succeed({ id: req.id, name: `User ${req.id}` }), 50)
      );
      const { result } = renderHook(() => useCachedRequest(resolver));

      expect(result.current.loading).toBe(false);

      const promise = result.current.executePromise(GetUser({ id: '1' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await promise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should update error state on failure', async () => {
      const testError = new Error('User not found');
      const resolver = RequestResolver.fromEffect((req: GetUser) =>
        Effect.fail(testError)
      );
      const { result } = renderHook(() => useCachedRequest(resolver));

      expect(result.current.error).toBe(null);

      await expect(
        result.current.executePromise(GetUser({ id: 'error' }))
      ).rejects.toThrow('User not found');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error.message).toBe('User not found');
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear error on successful request', async () => {
      let shouldFail = true;
      const resolver = RequestResolver.fromEffect((req: GetUser) =>
        shouldFail
          ? Effect.fail(new Error('Failed'))
          : Effect.succeed({ id: req.id, name: `User ${req.id}` })
      );
      const { result } = renderHook(() => useCachedRequest(resolver));

      // First request - fail
      await expect(
        result.current.executePromise(GetUser({ id: '1' }))
      ).rejects.toThrow('Failed');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error.message).toBe('Failed');
      });

      // Second request - succeed
      shouldFail = false;
      const data = await result.current.executePromise(GetUser({ id: '1' }));

      expect(data).toEqual({ id: '1', name: 'User 1' });
      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Concurrent requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      const promises = [
        result.current.executePromise(GetUser({ id: '1' })),
        result.current.executePromise(GetUser({ id: '2' })),
        result.current.executePromise(GetUser({ id: '3' })),
      ];

      const users = await Promise.all(promises);

      expect(users).toHaveLength(3);
      expect(users[0]).toEqual({ id: '1', name: 'User 1' });
      expect(users[1]).toEqual({ id: '2', name: 'User 2' });
      expect(users[2]).toEqual({ id: '3', name: 'User 3' });

      const stats = result.current.getCacheStats();
      expect(stats.size).toBe(3);
    });

    it('should deduplicate concurrent identical requests', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      // Make same request multiple times concurrently
      const promises = [
        result.current.executePromise(GetUser({ id: '1' })),
        result.current.executePromise(GetUser({ id: '1' })),
        result.current.executePromise(GetUser({ id: '1' })),
      ];

      const users = await Promise.all(promises);

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user).toEqual({ id: '1', name: 'User 1' });
      });

      // After all complete, should have only 1 cache entry
      const stats = result.current.getCacheStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('Default options', () => {
    it('should use default TTL of 5 minutes', async () => {
      vi.useFakeTimers();
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(1);

      // 4 minutes - still cached
      vi.advanceTimersByTime(4 * 60 * 1000);
      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(1);

      // 6 minutes total - expired
      vi.advanceTimersByTime(2 * 60 * 1000);
      await result.current.executePromise(GetUser({ id: '1' }));
      expect(apiCallCount).toBe(2);

      vi.useRealTimers();
    });

    it('should use default capacity of 100', async () => {
      const resolver = createUserResolver();
      const { result } = renderHook(() => useCachedRequest(resolver));

      // Add 100 entries
      const promises = Array.from({ length: 100 }, (_, i) =>
        result.current.executePromise(GetUser({ id: String(i) }))
      );
      await Promise.all(promises);

      let stats = result.current.getCacheStats();
      expect(stats.size).toBe(100);

      // Add one more - should trigger eviction
      await result.current.executePromise(GetUser({ id: '100' }));
      stats = result.current.getCacheStats();
      expect(stats.size).toBe(100);
    });
  });
});
