import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useStreamValue } from './useStreamValue';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';

describe('useStreamValue', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with loading state', () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStreamValue(stream));

    expect(result.current.loading).toBe(true);
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.done).toBe(false);
  });

  it('should receive stream value and update', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.value).toBe(3);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.done).toBe(true);
  });

  it('should set loading to false after receiving first value', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStreamValue(stream));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should only keep latest value (no history)', async () => {
    const stream = Stream.make('first', 'second', 'third');
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.value).toBe('third');
    });

    // Verify it only has the latest value, not an array
    expect(result.current.value).not.toBeInstanceOf(Array);
  });

  it('should use initialValue', () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() =>
      useStreamValue(stream, { initialValue: 0 })
    );

    expect(result.current.value).toBe(0);
    expect(result.current.loading).toBe(true);
  });

  it('should override initialValue with first stream value', async () => {
    const stream = Stream.make(42);
    const { result } = renderHook(() =>
      useStreamValue(stream, { initialValue: 0 })
    );

    expect(result.current.value).toBe(0);

    await waitFor(() => {
      expect(result.current.value).toBe(42);
    });
  });

  it('should return null when no initialValue provided', () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStreamValue(stream));

    expect(result.current.value).toBeNull();
  });

  it('should set done flag on stream completion', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should call onDone callback on stream completion', async () => {
    const onDone = vi.fn();
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() =>
      useStreamValue(stream, { onDone })
    );

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('should set loading to false after stream completion', async () => {
    const stream = Stream.make(1);
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should set error on stream failure', async () => {
    const testError = new Error('stream error');
    const stream = Stream.fail(testError);
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should call onError callback on stream error', async () => {
    const testError = new Error('test error');
    const onError = vi.fn();
    const stream = Stream.fail(testError);
    const { result } = renderHook(() =>
      useStreamValue(stream, { onError })
    );

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
    });

    expect(onError).toHaveBeenCalledWith(testError);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('should maintain state after error', async () => {
    const testError = new Error('error');
    const stream = Stream.fail(testError);
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.done).toBe(false);
    expect(result.current.value).toBeNull();
  });

  it('should not update state after unmount', async () => {
    const stream = Stream.fromEffect(
      Effect.gen(function* () {
        yield* Effect.sleep('100 millis');
        return 1;
      })
    ).pipe(
      Stream.flatMap(() => Stream.make(1, 2, 3))
    );

    const { result, unmount } = renderHook(() => useStreamValue(stream));

    expect(result.current.loading).toBe(true);

    unmount();

    // State should remain as it was
    expect(result.current.loading).toBe(true);
    expect(result.current.value).toBeNull();
  });

  it('should handle stream that emits values over time', async () => {
    const stream = Stream.make(1, 2, 3).pipe(
      Stream.mapEffect((n) =>
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return n * 2;
        })
      )
    );

    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.value).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.value).toBe(6);
  });

  it('should handle empty stream', async () => {
    const stream = Stream.empty;
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.value).toBeNull();
  });

  it('should handle empty stream with initialValue', async () => {
    const stream = Stream.empty;
    const { result } = renderHook(() =>
      useStreamValue(stream, { initialValue: 42 })
    );

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.value).toBe(42);
  });

  it('should handle stream with single value', async () => {
    const stream = Stream.make('single');
    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.value).toBe('single');
  });

  it('should update value multiple times as stream emits', async () => {
    const stream = Stream.make(10, 20, 30);

    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    // Should have the last emitted value
    expect(result.current.value).toBe(30);
  });

  it('should handle complex stream transformations', async () => {
    const stream = Stream.range(1, 5).pipe(
      Stream.map((n) => n * 2),
      Stream.filter((n) => n > 4)
    );

    const { result } = renderHook(() => useStreamValue(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    // Last value after filter should be 10 (5 * 2)
    expect(result.current.value).toBe(10);
  });
});
