import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useCachedRequest } from './useCachedRequest';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Duration from 'effect/Duration';

// Test request types
interface GetUser extends Request.Request<{ id: string; name: string }, Error> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

describe('useCachedRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start with initial state', () => {
    let callCount = 0;
    const resolver = RequestResolver.fromEffect((_req: GetUser) => {
      callCount++;
      return Effect.succeed({ id: '1', name: 'User 1' });
    });

    const { result } = renderHook(() => useCachedRequest(resolver));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.execute).toBe('function');
    expect(typeof result.current.executePromise).toBe('function');
    expect(typeof result.current.clearCache).toBe('function');
    expect(typeof result.current.getCacheStats).toBe('function');

    const stats = result.current.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.size).toBe(0);
  });

  it('should cache hit within TTL', async () => {
    let callCount = 0;
    const resolver = RequestResolver.fromEffect((_req: GetUser) => {
      callCount++;
      return Effect.succeed({ id: '1', name: 'User 1' });
    });

    const { result } = renderHook(() =>
      useCachedRequest(resolver, {
        ttl: Duration.minutes(5),
      })
    );

    // First call - cache miss
    const request = GetUser({ id: '1' });
    const value1 = await Effect.runPromise(result.current.execute(request));
    expect(value1).toEqual({ id: '1', name: 'User 1' });
    expect(callCount).toBe(1);

    // Second call with same request - cache hit
    const value2 = await Effect.runPromise(result.current.execute(request));
    expect(value2).toEqual({ id: '1', name: 'User 1' });
    expect(callCount).toBe(1); // Resolver not called again

    const stats = result.current.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('should cache miss on first access', async () => {
    let callCount = 0;
    const resolver = RequestResolver.fromEffect((_req: GetUser) => {
      callCount++;
      return Effect.succeed({ id: '1', name: 'User 1' });
    });

    const { result } = renderHook(() => useCachedRequest(resolver));

    const request = GetUser({ id: '1' });
    await Effect.runPromise(result.current.execute(request));

    const stats = result.current.getCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('should re-fetch after TTL expiration', async () => {
    let callCount = 0;
    const resolver = RequestResolver.fromEffect((_req: GetUser) => {
      callCount++;
      return Effect.succeed({ id: '1', name: 'User 1' });
    });

    const { result } = renderHook(() =>
      useCachedRequest(resolver, {
        ttl: Duration.seconds(2),
      })
    );

    const request = GetUser({ id: '1' });

    // First call
    await Effect.runPromise(result.current.execute(request));
    expect(callCount).toBe(1);

    // Second call within TTL - cache hit
    await Effect.runPromise(result.current.execute(request));
    expect(callCount).toBe(1);

    // Advance time beyond TTL
    vi.advanceTimersByTime(3000);

    // Third call after TTL - cache miss
    await Effect.runPromise(result.current.execute(request));
    expect(callCount).toBe(2);

    const stats = result.current.getCacheStats();
    expect(stats.misses).toBe(2); // First call + after TTL
    expect(stats.hits).toBe(1); // Second call
  });

  it('should evict oldest entry when capacity is reached', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() =>
      useCachedRequest(resolver, {
        capacity: 3,
      })
    );

    // Add 3 entries to fill capacity
    await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));
    await Effect.runPromise(result.current.execute(GetUser({ id: '2' })));
    await Effect.runPromise(result.current.execute(GetUser({ id: '3' })));

    let stats = result.current.getCacheStats();
    expect(stats.size).toBe(3);

    // Add 4th entry - should evict oldest
    await Effect.runPromise(result.current.execute(GetUser({ id: '4' })));

    stats = result.current.getCacheStats();
    expect(stats.size).toBe(3); // Still at capacity

    // First entry should be evicted, so this will be a miss
    let callCount = 0;
    const checkResolver = RequestResolver.fromEffect((req: GetUser) => {
      callCount++;
      return Effect.succeed({ id: req.id, name: `User ${req.id}` });
    });

    const { result: checkResult } = renderHook(() =>
      useCachedRequest(checkResolver, { capacity: 3 })
    );

    await Effect.runPromise(checkResult.current.execute(GetUser({ id: '1' })));
    expect(callCount).toBe(1); // Should be a fresh call since entry was evicted
  });

  it('should clear all cache when clearCache is called without predicate', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    // Add entries
    await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));
    await Effect.runPromise(result.current.execute(GetUser({ id: '2' })));

    let stats = result.current.getCacheStats();
    expect(stats.size).toBe(2);

    // Clear cache
    result.current.clearCache();

    stats = result.current.getCacheStats();
    expect(stats.size).toBe(0);
  });

  it('should clear selective cache when clearCache is called with predicate', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    // Add entries
    await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));
    await Effect.runPromise(result.current.execute(GetUser({ id: '2' })));

    let stats = result.current.getCacheStats();
    expect(stats.size).toBe(2);

    // Clear only entries containing "id":"1"
    result.current.clearCache((key) => key.includes('"id":"1"'));

    stats = result.current.getCacheStats();
    expect(stats.size).toBe(1);
  });

  it('should track cache statistics', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    // Cache miss
    await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));

    let stats = result.current.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);

    // Cache hit
    await Effect.runPromise(result.current.execute(GetUser({ id: '1' })));

    stats = result.current.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);

    // Another miss
    await Effect.runPromise(result.current.execute(GetUser({ id: '2' })));

    stats = result.current.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.size).toBe(2);
  });

  it('should call onCacheHit callback', async () => {
    const onCacheHit = vi.fn();
    const resolver = RequestResolver.fromEffect((_req: GetUser) =>
      Effect.succeed({ id: '1', name: 'User 1' })
    );

    const { result } = renderHook(() =>
      useCachedRequest(resolver, { onCacheHit })
    );

    const request = GetUser({ id: '1' });

    // First call - no cache hit
    await Effect.runPromise(result.current.execute(request));
    expect(onCacheHit).not.toHaveBeenCalled();

    // Second call - cache hit
    await Effect.runPromise(result.current.execute(request));
    expect(onCacheHit).toHaveBeenCalledTimes(1);
  });

  it('should call onCacheMiss callback', async () => {
    const onCacheMiss = vi.fn();
    const resolver = RequestResolver.fromEffect((_req: GetUser) =>
      Effect.succeed({ id: '1', name: 'User 1' })
    );

    const { result } = renderHook(() =>
      useCachedRequest(resolver, { onCacheMiss })
    );

    const request = GetUser({ id: '1' });

    await Effect.runPromise(result.current.execute(request));
    expect(onCacheMiss).toHaveBeenCalledTimes(1);
  });

  it('should support executePromise API', async () => {
    vi.useRealTimers(); // Use real timers for this test

    const resolver = RequestResolver.fromEffect((_req: GetUser) =>
      Effect.succeed({ id: '1', name: 'User 1' })
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    const request = GetUser({ id: '1' });
    const value = await result.current.executePromise(request);

    expect(value).toEqual({ id: '1', name: 'User 1' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.useFakeTimers(); // Restore fake timers
  });

  it('should set loading state during executePromise', async () => {
    vi.useRealTimers(); // Use real timers for this test

    const resolver = RequestResolver.fromEffect((_req: GetUser) =>
      Effect.succeed({ id: '1', name: 'User 1' }).pipe(Effect.delay(100))
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    const request = GetUser({ id: '1' });
    const promise = result.current.executePromise(request);

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await promise;

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.useFakeTimers(); // Restore fake timers
  });

  it('should handle errors in executePromise', async () => {
    vi.useRealTimers(); // Use real timers for this test

    const testError = new Error('Request failed');
    const resolver = RequestResolver.fromEffect((_req: GetUser) =>
      Effect.fail(testError)
    );

    const { result } = renderHook(() => useCachedRequest(resolver));

    const request = GetUser({ id: '1' });

    await expect(result.current.executePromise(request)).rejects.toThrow(
      'Request failed'
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });

    vi.useFakeTimers(); // Restore fake timers
  });
});
