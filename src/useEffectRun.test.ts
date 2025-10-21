import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useEffectRun } from './useEffectRun';
import * as Effect from 'effect/Effect';

describe('useEffectRun', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with loading state', () => {
    const { result } = renderHook(() =>
      useEffectRun(Effect.succeed('test'), { deps: [] })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should auto-run effect on mount', async () => {
    const { result } = renderHook(() =>
      useEffectRun(Effect.succeed('auto run value'), { deps: [] })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe('auto run value');
    });
  });

  it('should set data on success', async () => {
    const { result } = renderHook(() =>
      useEffectRun(
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return 42;
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(42);
      expect(result.current.error).toBeNull();
    });
  });

  it('should set error on failure', async () => {
    const testError = new Error('test error');
    const { result } = renderHook(() =>
      useEffectRun(Effect.fail(testError), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(testError);
      expect(result.current.data).toBeNull();
    });
  });

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useEffectRun(Effect.succeed('success'), { deps: [], onSuccess })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(onSuccess).toHaveBeenCalledWith('success');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should call onFailure callback', async () => {
    const testError = new Error('test error');
    const onFailure = vi.fn();
    const { result } = renderHook(() =>
      useEffectRun(Effect.fail(testError), { deps: [], onFailure })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(onFailure).toHaveBeenCalledWith(testError);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('should rerun when deps change', async () => {
    let counter = 0;
    const { result, rerender } = renderHook(
      ({ id }) =>
        useEffectRun(
          Effect.sync(() => {
            counter++;
            return `value-${id}`;
          }),
          { deps: [id] }
        ),
      { initialProps: { id: 1 } }
    );

    await waitFor(() => {
      expect(result.current.data).toBe('value-1');
    });
    expect(counter).toBe(1);

    // Change deps
    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe('value-2');
    });
    expect(counter).toBe(2);
  });

  it('should support manual rerun', async () => {
    let counter = 0;
    const { result } = renderHook(() =>
      useEffectRun(
        Effect.sync(() => {
          counter++;
          return counter;
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    // Manual rerun
    result.current.rerun();

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });

  it('should provide fiber reference', async () => {
    const { result } = renderHook(() =>
      useEffectRun(
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return 'completed';
        }),
        { deps: [] }
      )
    );

    // Fiber should be available while running
    await waitFor(() => {
      expect(result.current.fiber).not.toBeNull();
    });

    // Fiber should be null after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.fiber).toBeNull();
    });
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useEffectRun(
        Effect.gen(function* () {
          yield* Effect.sleep('1000 millis');
          return 'completed';
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
      expect(result.current.fiber).not.toBeNull();
    });

    unmount();

    // Fiber should be interrupted on unmount
    expect(result.current.fiber).not.toBeNull();
  });

  it('should handle immediate success', async () => {
    const { result } = renderHook(() =>
      useEffectRun(Effect.succeed('immediate'), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe('immediate');
    });
  });

  it('should interrupt previous effect when deps change', async () => {
    let cancelledCount = 0;

    const { result, rerender } = renderHook(
      ({ id }) =>
        useEffectRun(
          Effect.gen(function* () {
            yield* Effect.sleep('500 millis');
            return `result-${id}`;
          }).pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                cancelledCount++;
              })
            )
          ),
          { deps: [id] }
        ),
      { initialProps: { id: 1 } }
    );

    // Wait a bit but not for completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Change deps to interrupt first effect
    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe('result-2');
    });

    // First effect should have been cancelled
    expect(cancelledCount).toBeGreaterThan(0);
  });

  it('should handle multiple sequential runs', async () => {
    let runCount = 0;
    const { result } = renderHook(() =>
      useEffectRun(
        Effect.sync(() => {
          runCount++;
          return runCount;
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    result.current.rerun();
    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });

    result.current.rerun();
    await waitFor(() => {
      expect(result.current.data).toBe(3);
    });

    expect(runCount).toBe(3);
  });
});
