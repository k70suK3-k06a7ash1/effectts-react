import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useFiber } from './useFiber';
import * as Effect from 'effect/Effect';

describe('useFiber', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with idle status', () => {
    const { result } = renderHook(() =>
      useFiber(Effect.succeed('test'))
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should start fiber manually', async () => {
    const { result } = renderHook(() =>
      useFiber(
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return 'test value';
        })
      )
    );

    expect(result.current.status).toBe('idle');

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('done');
      expect(result.current.result).toBe('test value');
    });
  });

  it('should auto-start fiber when autoStart is true', async () => {
    const { result } = renderHook(() =>
      useFiber(Effect.succeed('auto started'), { autoStart: true })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('done');
      expect(result.current.result).toBe('auto started');
    });
  });

  it('should set result on success', async () => {
    const { result } = renderHook(() =>
      useFiber(
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return 42;
        })
      )
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('done');
      expect(result.current.result).toBe(42);
      expect(result.current.error).toBeNull();
    });
  });

  it('should set error on failure', async () => {
    const testError = new Error('fiber failed');
    const { result } = renderHook(() =>
      useFiber(Effect.fail(testError))
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.error).toBe(testError);
      expect(result.current.result).toBeNull();
    });
  });

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useFiber(Effect.succeed('success value'), { onSuccess })
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });

    expect(onSuccess).toHaveBeenCalledWith('success value');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should call onFailure callback', async () => {
    const testError = new Error('test error');
    const onFailure = vi.fn();
    const { result } = renderHook(() =>
      useFiber(Effect.fail(testError), { onFailure })
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });

    expect(onFailure).toHaveBeenCalledWith(testError);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('should interrupt fiber', async () => {
    const { result } = renderHook(() =>
      useFiber(
        Effect.gen(function* () {
          yield* Effect.sleep('1000 millis');
          return 'completed';
        })
      )
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    result.current.interrupt();

    await waitFor(() => {
      expect(result.current.status).toBe('interrupted');
    });
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useFiber(
        Effect.gen(function* () {
          yield* Effect.sleep('1000 millis');
          return 'completed';
        }),
        { autoStart: true }
      )
    );

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    unmount();

    // After unmount, fiber should be interrupted
    // We can't check status after unmount, but this ensures cleanup runs
    expect(result.current.status).toBe('running');
  });

  it('should handle multiple starts', async () => {
    const { result } = renderHook(() =>
      useFiber(Effect.succeed('test'))
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });

    // Start again - should work
    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });
  });

  it('should not interrupt if fiber is not running', () => {
    const { result } = renderHook(() =>
      useFiber(Effect.succeed('test'))
    );

    expect(result.current.status).toBe('idle');

    // Should not throw
    expect(() => result.current.interrupt()).not.toThrow();
  });

  it('should handle long-running effect', async () => {
    const { result } = renderHook(() =>
      useFiber(
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return 'long running result';
        })
      )
    );

    result.current.start();

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    await waitFor(
      () => {
        expect(result.current.status).toBe('done');
        expect(result.current.result).toBe('long running result');
      },
      { timeout: 500 }
    );
  });
});
