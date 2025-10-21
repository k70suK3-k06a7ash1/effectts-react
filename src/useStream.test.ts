import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useStream } from './useStream';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';

describe('useStream', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with loading state', () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStream(stream));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.latest).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.done).toBe(false);
  });

  it('should receive stream values and add to data array', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.data).toEqual([1, 2, 3]);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.done).toBe(true);
  });

  it('should update latest value', async () => {
    const stream = Stream.make('first', 'second', 'third');
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.latest).toBe('third');
    });

    expect(result.current.data).toEqual(['first', 'second', 'third']);
  });

  it('should set loading to false after receiving first value', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStream(stream));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should limit array size with bufferSize', async () => {
    const stream = Stream.make(1, 2, 3, 4, 5);
    const { result } = renderHook(() =>
      useStream(stream, { bufferSize: 3 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([3, 4, 5]);
    });

    expect(result.current.data.length).toBe(3);
  });

  it('should automatically delete old values when exceeding buffer size', async () => {
    const stream = Stream.range(1, 10);
    const { result } = renderHook(() =>
      useStream(stream, { bufferSize: 5 })
    );

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.data.length).toBe(5);
    expect(result.current.data).toEqual([6, 7, 8, 9, 10]);
  });

  it('should support unlimited buffer by default', async () => {
    const stream = Stream.range(1, 20);
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.data.length).toBe(20);
  });

  it('should set done flag on stream completion', async () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should call onDone callback on stream completion', async () => {
    const onDone = vi.fn();
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() =>
      useStream(stream, { onDone })
    );

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('should set loading to false after stream completion', async () => {
    const stream = Stream.make(1);
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should set error on stream failure', async () => {
    const testError = new Error('stream error');
    const stream = Stream.fail(testError);
    const { result } = renderHook(() => useStream(stream));

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
      useStream(stream, { onError })
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
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.done).toBe(false);
    expect(result.current.data).toEqual([]);
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

    const { result, unmount } = renderHook(() => useStream(stream));

    expect(result.current.loading).toBe(true);

    unmount();

    // State should remain as it was
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('should use initialValue for latest', () => {
    const stream = Stream.make(1, 2, 3);
    const { result } = renderHook(() =>
      useStream(stream, { initialValue: 0 })
    );

    expect(result.current.latest).toBe(0);
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

    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.data).toEqual([2, 4, 6]);
    expect(result.current.latest).toBe(6);
  });

  it('should handle empty stream', async () => {
    const stream = Stream.empty;
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(result.current.latest).toBeNull();
  });

  it('should handle stream with single value', async () => {
    const stream = Stream.make('single');
    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.data).toEqual(['single']);
    expect(result.current.latest).toBe('single');
  });

  it('should handle complex stream transformations', async () => {
    const stream = Stream.range(1, 5).pipe(
      Stream.map((n) => n * 2),
      Stream.filter((n) => n > 4)
    );

    const { result } = renderHook(() => useStream(stream));

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });

    expect(result.current.data).toEqual([6, 8, 10]);
    expect(result.current.latest).toBe(10);
  });
});
