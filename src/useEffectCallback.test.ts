import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useEffectCallback } from './useEffectCallback';
import * as Effect from 'effect/Effect';

describe('useEffectCallback', () => {
  afterEach(() => {
    cleanup();
  });

  it('should execute the effect with arguments', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: string) => Effect.succeed(value.toUpperCase()))
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await result.current.execute('hello');

    await waitFor(() => {
      expect(result.current.data).toBe('HELLO');
      expect(result.current.loading).toBe(false);
    });
  });

  it('should manage loading state correctly', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: number) =>
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return value * 2;
        })
      )
    );

    expect(result.current.loading).toBe(false);

    const executePromise = result.current.execute(21);

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await executePromise;

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(42);
    });
  });

  it('should set data on success', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((a: number, b: number) => Effect.succeed(a + b))
    );

    await result.current.execute(10, 32);

    await waitFor(() => {
      expect(result.current.data).toBe(42);
      expect(result.current.error).toBeNull();
    });
  });

  it('should set error on failure', async () => {
    const testError = new Error('Test error');
    const { result } = renderHook(() =>
      useEffectCallback(() => Effect.fail(testError))
    );

    await result.current.execute();

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useEffectCallback((value: string) => Effect.succeed(value), {
        onSuccess,
      })
    );

    await result.current.execute('test');

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('test');
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onFailure callback', async () => {
    const testError = new Error('Test error');
    const onFailure = vi.fn();
    const { result } = renderHook(() =>
      useEffectCallback(() => Effect.fail(testError), {
        onFailure,
      })
    );

    await result.current.execute();

    await waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(testError);
      expect(onFailure).toHaveBeenCalledTimes(1);
    });
  });

  it('should reset state', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: string) => Effect.succeed(value))
    );

    await result.current.execute('test');

    await waitFor(() => {
      expect(result.current.data).toBe('test');
    });

    result.current.reset();

    await waitFor(() => {
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it('should allow re-execute after reset', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: number) => Effect.succeed(value * 2))
    );

    await result.current.execute(5);
    await waitFor(() => {
      expect(result.current.data).toBe(10);
    });

    result.current.reset();
    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });

    await result.current.execute(7);
    await waitFor(() => {
      expect(result.current.data).toBe(14);
    });
  });

  it('should handle consecutive executes', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: number) =>
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return value;
        })
      )
    );

    await result.current.execute(1);
    await result.current.execute(2);

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });

  it('should work without options', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: string) => Effect.succeed(value))
    );

    await result.current.execute('test');

    await waitFor(() => {
      expect(result.current.data).toBe('test');
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle multiple arguments', async () => {
    const { result } = renderHook(() =>
      useEffectCallback(
        (a: number, b: number, c: number) => Effect.succeed(a + b + c)
      )
    );

    await result.current.execute(1, 2, 3);

    await waitFor(() => {
      expect(result.current.data).toBe(6);
    });
  });

  it('should handle no arguments', async () => {
    const { result } = renderHook(() =>
      useEffectCallback(() => Effect.succeed('no args'))
    );

    await result.current.execute();

    await waitFor(() => {
      expect(result.current.data).toBe('no args');
    });
  });

  it('should clear previous data when starting new execution', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((value: string) =>
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return value;
        })
      )
    );

    await result.current.execute('first');
    await waitFor(() => {
      expect(result.current.data).toBe('first');
    });

    // Start new execution - should clear previous data
    const secondPromise = result.current.execute('second');

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
    });

    await secondPromise;

    await waitFor(() => {
      expect(result.current.data).toBe('second');
    });
  });

  it('should clear previous error when starting new execution', async () => {
    const { result } = renderHook(() =>
      useEffectCallback((shouldFail: boolean) =>
        shouldFail ? Effect.fail(new Error('fail')) : Effect.succeed('success')
      )
    );

    await result.current.execute(true);
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    await result.current.execute(false);

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('success');
    });
  });
});
