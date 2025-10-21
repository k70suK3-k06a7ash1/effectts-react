import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubscriptionRef } from './useSubscriptionRef';
import * as Effect from 'effect/Effect';

describe('useSubscriptionRef', () => {
  it('should initialize with the initial value', async () => {
    const { result } = renderHook(() => useSubscriptionRef(42));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe(42);
  });

  it('should automatically update value on changes', async () => {
    const { result } = renderHook(() => useSubscriptionRef(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe(0);

    await result.current.set(10);

    // The subscription should automatically update the value
    await waitFor(() => {
      expect(result.current.value).toBe(10);
    });
  });

  it('should react to multiple updates', async () => {
    const { result } = renderHook(() => useSubscriptionRef(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.set(1);

    await waitFor(() => {
      expect(result.current.value).toBe(1);
    });

    await result.current.update((n) => n + 1);

    await waitFor(() => {
      expect(result.current.value).toBe(2);
    });

    await result.current.update((n) => n * 10);

    await waitFor(() => {
      expect(result.current.value).toBe(20);
    });
  });

  it('should handle effectful updates', async () => {
    const { result } = renderHook(() => useSubscriptionRef<number[]>([]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.updateEffect((arr) =>
      Effect.gen(function* () {
        yield* Effect.sleep('10 millis');
        return [...arr, 1];
      })
    );

    await waitFor(() => {
      expect(result.current.value).toEqual([1]);
    });

    await result.current.updateEffect((arr) =>
      Effect.gen(function* () {
        yield* Effect.sleep('10 millis');
        return [...arr, 2, 3];
      })
    );

    await waitFor(() => {
      expect(result.current.value).toEqual([1, 2, 3]);
    });
  });

  it('should handle modify operations', async () => {
    const { result } = renderHook(() => useSubscriptionRef(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const doubled = await result.current.modify((n) => [n * 2, n + 5]);

    expect(doubled).toBe(20);

    await waitFor(() => {
      expect(result.current.value).toBe(15);
    });
  });

  it('should handle string values', async () => {
    const { result } = renderHook(() => useSubscriptionRef('hello'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe('hello');

    await result.current.set('world');

    await waitFor(() => {
      expect(result.current.value).toBe('world');
    });
  });

  it('should handle complex object updates', async () => {
    interface User {
      name: string;
      age: number;
    }

    const { result } = renderHook(() =>
      useSubscriptionRef<User>({ name: 'Alice', age: 25 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.update((user) => ({ ...user, age: 26 }));

    await waitFor(() => {
      expect(result.current.value).toEqual({ name: 'Alice', age: 26 });
    });

    await result.current.set({ name: 'Bob', age: 30 });

    await waitFor(() => {
      expect(result.current.value).toEqual({ name: 'Bob', age: 30 });
    });
  });

  it('should handle rapid successive updates', async () => {
    const { result } = renderHook(() => useSubscriptionRef(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Perform rapid updates
    await result.current.set(1);
    await result.current.set(2);
    await result.current.set(3);

    await waitFor(() => {
      expect(result.current.value).toBe(3);
    });
  });
});
