import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSynchronizedRef } from './useSynchronizedRef';
import * as Effect from 'effect/Effect';

describe('useSynchronizedRef', () => {
  it('should initialize with the initial value', async () => {
    const { result } = renderHook(() => useSynchronizedRef(42));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe(42);
  });

  it('should get the current value', async () => {
    const { result } = renderHook(() => useSynchronizedRef(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const value = await result.current.get();
    expect(value).toBe(10);
  });

  it('should set a new value', async () => {
    const { result } = renderHook(() => useSynchronizedRef(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.set(100);

    await waitFor(() => {
      expect(result.current.value).toBe(100);
    });
  });

  it('should update the value with a function', async () => {
    const { result } = renderHook(() => useSynchronizedRef(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.update((n) => n * 2);

    await waitFor(() => {
      expect(result.current.value).toBe(10);
    });
  });

  it('should update with an effectful operation', async () => {
    const { result } = renderHook(() => useSynchronizedRef<number[]>([]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate an effectful operation that fetches data
    await result.current.updateEffect((arr) =>
      Effect.gen(function* () {
        // Simulate async operation
        yield* Effect.sleep('10 millis');
        return [...arr, 1];
      })
    );

    await waitFor(() => {
      expect(result.current.value).toEqual([1]);
    });

    // Add another value
    await result.current.updateEffect((arr) =>
      Effect.gen(function* () {
        yield* Effect.sleep('10 millis');
        return [...arr, 2];
      })
    );

    await waitFor(() => {
      expect(result.current.value).toEqual([1, 2]);
    });
  });

  it('should modify and return a computed value', async () => {
    const { result } = renderHook(() => useSynchronizedRef(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const doubled = await result.current.modify((n) => [n * 2, n + 5]);

    expect(doubled).toBe(20);

    await waitFor(() => {
      expect(result.current.value).toBe(15);
    });
  });

  it('should handle concurrent updates sequentially', async () => {
    const { result } = renderHook(() => useSynchronizedRef<number[]>([]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Fire multiple updates concurrently
    const updates = Promise.all([
      result.current.updateEffect((arr) =>
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return [...arr, 1];
        })
      ),
      result.current.updateEffect((arr) =>
        Effect.gen(function* () {
          yield* Effect.sleep('5 millis');
          return [...arr, 2];
        })
      ),
      result.current.updateEffect((arr) =>
        Effect.gen(function* () {
          yield* Effect.sleep('3 millis');
          return [...arr, 3];
        })
      ),
    ]);

    await updates;

    await waitFor(() => {
      // All updates should be applied sequentially
      expect(result.current.value?.length).toBe(3);
    });
  });
});
