import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useRetry } from './useRetry';
import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';

describe('useRetry', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with initial state', () => {
    const { result } = renderHook(() => useRetry());

    expect(result.current.attempts).toBe(0);
    expect(result.current.isRetrying).toBe(false);
    expect(typeof result.current.execute).toBe('function');
    expect(typeof result.current.executeEffect).toBe('function');
    expect(typeof result.current.retry).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should execute effect successfully without retry', async () => {
    const { result } = renderHook(() => useRetry());

    const effect = Effect.succeed(42);
    const value = await result.current.execute(effect);

    expect(value).toBe(42);
    expect(result.current.attempts).toBe(0);
  });

  it('should retry on failure and eventually succeed', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<string, Error>({
        maxAttempts: 3,
        delay: Duration.millis(10),
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const value = await result.current.execute(effect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should fail after max attempts', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<unknown, Error>({
        maxAttempts: 3,
        delay: Duration.millis(10),
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      return yield* Effect.fail(new Error('always fail'));
    });

    await expect(result.current.execute(effect)).rejects.toThrow('always fail');
    expect(attemptCount).toBe(3);
  });

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useRetry({
        onSuccess,
      })
    );

    await result.current.execute(Effect.succeed(42));

    expect(onSuccess).toHaveBeenCalledWith(42, 0);
  });

  it('should call onFailure callback after all retries', async () => {
    const onFailure = vi.fn();
    const testError = new Error('test error');

    const { result } = renderHook(() =>
      useRetry<unknown, Error>({
        maxAttempts: 2,
        delay: Duration.millis(10),
        onFailure,
      })
    );

    await expect(result.current.execute(Effect.fail(testError))).rejects.toThrow(
      'test error'
    );

    expect(onFailure).toHaveBeenCalled();
  });

  it('should call onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<string, Error>({
        maxAttempts: 3,
        delay: Duration.millis(10),
        onRetry,
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 2) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    await result.current.execute(effect);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should respect shouldRetry condition', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry({
        maxAttempts: 5,
        delay: Duration.millis(10),
        shouldRetry: (error: Error) => {
          // Don't retry if error message is 'no-retry'
          return error.message !== 'no-retry';
        },
      })
    );

    const effect = Effect.fail(new Error('no-retry'));

    await expect(result.current.execute(effect)).rejects.toThrow('no-retry');
    // Should fail immediately without retries
    expect(attemptCount).toBe(0);
  });

  it('should reset state', async () => {
    const { result } = renderHook(() =>
      useRetry<unknown, Error>({
        maxAttempts: 2,
        delay: Duration.millis(10),
      })
    );

    // First execution that fails
    await expect(
      result.current.execute(Effect.fail(new Error('fail')))
    ).rejects.toThrow();

    // Reset
    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.attempts).toBe(0);
      expect(result.current.isRetrying).toBe(false);
    });
  });

  it('should work with exponential backoff', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<string, Error>({
        maxAttempts: 3,
        delay: 'exponential',
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const value = await result.current.execute(effect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should work with linear backoff', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<string, Error>({
        maxAttempts: 3,
        delay: 'linear',
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const value = await result.current.execute(effect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should work with executeEffect', async () => {
    const { result } = renderHook(() =>
      useRetry({
        maxAttempts: 2,
        delay: Duration.millis(10),
      })
    );

    const baseEffect = Effect.succeed(42);
    const wrappedEffect = result.current.executeEffect(baseEffect);

    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe(42);
  });

  it('should work with retry method', async () => {
    let attemptCount = 0;

    const { result } = renderHook(() =>
      useRetry<string, Error>({
        maxAttempts: 3,
        delay: Duration.millis(10),
      })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const retriedEffect = result.current.retry(effect);
    const value = await Effect.runPromise(retriedEffect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should handle immediate success without setting isRetrying', async () => {
    const { result } = renderHook(() => useRetry());

    const promise = result.current.execute(Effect.succeed(42));
    const value = await promise;

    expect(value).toBe(42);
    expect(result.current.isRetrying).toBe(false);
  });
});
