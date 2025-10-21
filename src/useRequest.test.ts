import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRequest } from './useRequest';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Runtime from 'effect/Runtime';

// Test request types
interface GetUser extends Request.Request<{ id: string; name: string }, Error> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

interface GetProduct extends Request.Request<{ id: string; price: number }, Error> {
  readonly _tag: 'GetProduct';
  readonly id: string;
}

const GetProduct = Request.tagged<GetProduct>('GetProduct');

describe('useRequest', () => {
  it('should initialize with loading false and no error', () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useRequest(resolver));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.execute).toBe('function');
    expect(typeof result.current.executePromise).toBe('function');
  });

  it('should return an execute function that creates an Effect', () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useRequest(resolver));
    const request = GetUser({ id: '1' });
    const effect = result.current.execute(request);

    // Effect should be an object with pipe method
    expect(effect).toHaveProperty('pipe');
  });

  it('should execute a request and return data via executePromise', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useRequest(resolver));
    const request = GetUser({ id: '1' });

    const data = await result.current.executePromise(request);

    expect(data).toEqual({ id: '1', name: 'User 1' });
  });

  it('should set loading state during executePromise', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.delay(Effect.succeed({ id: req.id, name: `User ${req.id}` }), 50)
    );

    const { result } = renderHook(() => useRequest(resolver));
    const request = GetUser({ id: '1' });

    const promise = result.current.executePromise(request);

    // Wait for loading state to be set
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await promise;

    // Should not be loading after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle errors in executePromise', async () => {
    const testError = new Error('User not found');
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.fail(testError)
    );

    const { result } = renderHook(() => useRequest(resolver));
    const request = GetUser({ id: '1' });

    await expect(result.current.executePromise(request)).rejects.toThrow('User not found');

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).toBe('User not found');
      expect(result.current.loading).toBe(false);
    });
  });

  it('should batch multiple requests together', async () => {
    const batchFn = vi.fn((requests: readonly GetUser[]) => {
      return Effect.forEach(requests, (req) =>
        Request.completeEffect(req, Effect.succeed({ id: req.id, name: `User ${req.id}` }))
      );
    });

    const resolver = RequestResolver.makeBatched(batchFn);

    const { result } = renderHook(() => useRequest(resolver));

    // Execute multiple requests
    const requests = [
      GetUser({ id: '1' }),
      GetUser({ id: '2' }),
      GetUser({ id: '3' }),
    ];

    const effects = requests.map((req) => result.current.execute(req));

    // Run all effects with batching enabled
    const results = await Effect.runPromise(
      Effect.all(effects, { batching: true })
    );

    // Should batch all requests into a single call
    expect(batchFn).toHaveBeenCalledTimes(1);
    expect(batchFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({ id: '2' }),
        expect.objectContaining({ id: '3' }),
      ])
    );

    expect(results).toEqual([
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
      { id: '3', name: 'User 3' },
    ]);
  });

  it('should handle individual request failures in a batch', async () => {
    const resolver = RequestResolver.makeBatched((requests: readonly GetUser[]) => {
      return Effect.forEach(requests, (req) => {
        if (req.id === '2') {
          return Request.completeEffect(
            req,
            Effect.fail(new Error(`User ${req.id} not found`))
          );
        }
        return Request.completeEffect(
          req,
          Effect.succeed({ id: req.id, name: `User ${req.id}` })
        );
      });
    });

    const { result } = renderHook(() => useRequest(resolver));

    const requests = [
      GetUser({ id: '1' }),
      GetUser({ id: '2' }),
      GetUser({ id: '3' }),
    ];

    const effects = requests.map((req) => result.current.execute(req));

    // Run effects with batching
    const resultsEffect = Effect.all(
      effects.map((effect) => Effect.either(effect)),
      { batching: true }
    );

    const results = await Effect.runPromise(resultsEffect);

    // First request should succeed
    expect(results[0]._tag).toBe('Right');
    if (results[0]._tag === 'Right') {
      expect(results[0].right).toEqual({ id: '1', name: 'User 1' });
    }

    // Second request should fail
    expect(results[1]._tag).toBe('Left');
    if (results[1]._tag === 'Left') {
      expect(results[1].left.message).toBe('User 2 not found');
    }

    // Third request should succeed
    expect(results[2]._tag).toBe('Right');
    if (results[2]._tag === 'Right') {
      expect(results[2].right).toEqual({ id: '3', name: 'User 3' });
    }
  });

  it('should use custom runtime when provided', async () => {
    const customRuntime = Runtime.defaultRuntime;
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() =>
      useRequest(resolver, { runtime: customRuntime })
    );

    const request = GetUser({ id: '1' });
    const data = await result.current.executePromise(request);

    expect(data).toEqual({ id: '1', name: 'User 1' });
  });

  it('should work with multiple different request types', async () => {
    const userResolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const productResolver = RequestResolver.fromEffect((req: GetProduct) =>
      Effect.succeed({ id: req.id, price: Number(req.id) * 100 })
    );

    const { result: userHook } = renderHook(() => useRequest(userResolver));
    const { result: productHook } = renderHook(() => useRequest(productResolver));

    const userData = await userHook.current.executePromise(GetUser({ id: '1' }));
    const productData = await productHook.current.executePromise(GetProduct({ id: '2' }));

    expect(userData).toEqual({ id: '1', name: 'User 1' });
    expect(productData).toEqual({ id: '2', price: 200 });
  });

  it('should handle cleanup on unmount', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result, unmount } = renderHook(() => useRequest(resolver));

    const request = GetUser({ id: '1' });
    const promise = result.current.executePromise(request);

    unmount();

    // Should still complete even after unmount
    await expect(promise).resolves.toEqual({ id: '1', name: 'User 1' });
  });

  it('should maintain stable execute function reference', () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result, rerender } = renderHook(() => useRequest(resolver));

    const execute1 = result.current.execute;
    rerender();
    const execute2 = result.current.execute;

    expect(execute1).toBe(execute2);
  });

  it('should update resolver when changed', async () => {
    let resolverVersion = 1;

    const createResolver = (version: number) =>
      RequestResolver.fromEffect((req: GetUser) =>
        Effect.succeed({ id: req.id, name: `User ${req.id} v${version}` })
      );

    const { result, rerender } = renderHook(
      ({ version }) => useRequest(createResolver(version)),
      { initialProps: { version: resolverVersion } }
    );

    const data1 = await result.current.executePromise(GetUser({ id: '1' }));
    expect(data1).toEqual({ id: '1', name: 'User 1 v1' });

    resolverVersion = 2;
    rerender({ version: resolverVersion });

    const data2 = await result.current.executePromise(GetUser({ id: '1' }));
    expect(data2).toEqual({ id: '1', name: 'User 1 v2' });
  });

  it('should clear error state on successful executePromise', async () => {
    let shouldFail = true;

    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      shouldFail
        ? Effect.fail(new Error('Failed'))
        : Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useRequest(resolver));

    // First call fails
    await expect(result.current.executePromise(GetUser({ id: '1' }))).rejects.toThrow('Failed');

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).toBe('Failed');
    });

    // Second call succeeds
    shouldFail = false;
    const data = await result.current.executePromise(GetUser({ id: '1' }));

    expect(data).toEqual({ id: '1', name: 'User 1' });
    await waitFor(() => {
      expect(result.current.error).toBe(null);
    });
  });

  it('should handle concurrent executePromise calls', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.delay(
        Effect.succeed({ id: req.id, name: `User ${req.id}` }),
        Math.random() * 50
      )
    );

    const { result } = renderHook(() => useRequest(resolver));

    const promises = [
      result.current.executePromise(GetUser({ id: '1' })),
      result.current.executePromise(GetUser({ id: '2' })),
      result.current.executePromise(GetUser({ id: '3' })),
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
      { id: '3', name: 'User 3' },
    ]);
  });

  it('should execute Effect requests successfully with execute method', async () => {
    const resolver = RequestResolver.fromEffect((req: GetUser) =>
      Effect.succeed({ id: req.id, name: `User ${req.id}` })
    );

    const { result } = renderHook(() => useRequest(resolver));

    const effect = Effect.gen(function* () {
      const user1 = yield* result.current.execute(GetUser({ id: '1' }));
      const user2 = yield* result.current.execute(GetUser({ id: '2' }));
      return [user1, user2];
    });

    const data = await Effect.runPromise(effect);

    expect(data).toEqual([
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
    ]);
  });
});
