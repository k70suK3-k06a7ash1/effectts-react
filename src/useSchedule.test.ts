import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useSchedule } from './useSchedule';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

describe('useSchedule', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with initial state', () => {
    const schedule = Schedule.recurs(3);
    const { result } = renderHook(() => useSchedule(schedule));

    expect(result.current.schedule).toBeDefined();
    expect(result.current.stats.attempts).toBe(0);
    expect(result.current.stats.lastDelay).toBe(null);
    expect(typeof result.current.applySchedule).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should apply schedule to effect and track retry attempts', async () => {
    let attemptCount = 0;
    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);

    await waitFor(() => {
      expect(result.current.stats.attempts).toBeGreaterThan(0);
    });
  });

  it('should call onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    let attemptCount = 0;

    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() =>
      useSchedule(schedule, { onRetry })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    await Effect.runPromise(wrappedEffect);

    expect(onRetry).toHaveBeenCalled();
  });

  it('should call onComplete callback on success', async () => {
    const onComplete = vi.fn();
    let attemptCount = 0;

    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() =>
      useSchedule(schedule, { onComplete })
    );

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 2) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    await Effect.runPromise(wrappedEffect);

    expect(onComplete).toHaveBeenCalled();
  });

  it('should call onFailure callback when effect fails after all retries', async () => {
    const onFailure = vi.fn();

    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(2))
    );

    const { result } = renderHook(() =>
      useSchedule(schedule, { onFailure })
    );

    const effect = Effect.fail(new Error('always fail'));
    const wrappedEffect = result.current.applySchedule(effect);

    await expect(Effect.runPromise(wrappedEffect)).rejects.toThrow('always fail');

    expect(onFailure).toHaveBeenCalled();
  });

  it('should reset stats', async () => {
    let attemptCount = 0;
    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 2) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    await Effect.runPromise(wrappedEffect);

    await waitFor(() => {
      expect(result.current.stats.attempts).toBeGreaterThan(0);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.stats.attempts).toBe(0);
    expect(result.current.stats.lastDelay).toBe(null);
  });

  it('should work with fixed interval schedule', async () => {
    let attemptCount = 0;
    const schedule = Schedule.spaced(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should work with linear backoff schedule', async () => {
    let attemptCount = 0;
    const schedule = Schedule.linear(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should track last delay in stats', async () => {
    let attemptCount = 0;
    const schedule = Schedule.exponential(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(3))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 2) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    await Effect.runPromise(wrappedEffect);

    await waitFor(() => {
      expect(result.current.stats.lastDelay).not.toBe(null);
    });
  });

  it('should not retry on immediate success', async () => {
    const onRetry = vi.fn();
    const schedule = Schedule.recurs(3);

    const { result } = renderHook(() =>
      useSchedule(schedule, { onRetry })
    );

    const effect = Effect.succeed(42);
    const wrappedEffect = result.current.applySchedule(effect);
    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe(42);
    expect(onRetry).not.toHaveBeenCalled();
    expect(result.current.stats.attempts).toBe(0);
  });

  it('should work with fibonacci backoff schedule', async () => {
    let attemptCount = 0;
    const schedule = Schedule.fibonacci(Duration.millis(10)).pipe(
      Schedule.compose(Schedule.recurs(4))
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      if (attemptCount < 3) {
        return yield* Effect.fail(new Error('retry'));
      }
      return yield* Effect.succeed('fibonacci success');
    });

    const wrappedEffect = result.current.applySchedule(effect);
    const value = await Effect.runPromise(wrappedEffect);

    expect(value).toBe('fibonacci success');
    expect(attemptCount).toBe(3);
  });

  it('should handle multiple applySchedule calls independently', async () => {
    const schedule = Schedule.recurs(2);
    const { result } = renderHook(() => useSchedule(schedule));

    let attempt1 = 0;
    const effect1 = Effect.gen(function* () {
      attempt1++;
      if (attempt1 < 2) {
        return yield* Effect.fail(new Error('retry1'));
      }
      return yield* Effect.succeed('result1');
    });

    let attempt2 = 0;
    const effect2 = Effect.gen(function* () {
      attempt2++;
      if (attempt2 < 2) {
        return yield* Effect.fail(new Error('retry2'));
      }
      return yield* Effect.succeed('result2');
    });

    const wrapped1 = result.current.applySchedule(effect1);
    const wrapped2 = result.current.applySchedule(effect2);

    const [value1, value2] = await Promise.all([
      Effect.runPromise(wrapped1),
      Effect.runPromise(wrapped2),
    ]);

    expect(value1).toBe('result1');
    expect(value2).toBe('result2');
  });

  it('should maintain schedule reference stability', () => {
    const schedule = Schedule.recurs(3);
    const { result, rerender } = renderHook(() => useSchedule(schedule));

    const firstSchedule = result.current.schedule;
    rerender();
    const secondSchedule = result.current.schedule;

    expect(firstSchedule).toBe(secondSchedule);
  });

  it('should work with conditional retry schedules', async () => {
    let attemptCount = 0;
    // Retry only first 2 times
    const schedule = Schedule.recurs(5).pipe(
      Schedule.whileOutput((n) => n < 2)
    );

    const { result } = renderHook(() => useSchedule(schedule));

    const effect = Effect.gen(function* () {
      attemptCount++;
      return yield* Effect.fail(new Error('always fail'));
    });

    const wrappedEffect = result.current.applySchedule(effect);

    await expect(Effect.runPromise(wrappedEffect)).rejects.toThrow('always fail');

    // Initial attempt + 2 retries = 3 total attempts
    expect(attemptCount).toBe(3);
  });

  it('should handle cleanup on unmount', async () => {
    const schedule = Schedule.recurs(3);
    const { result, unmount } = renderHook(() => useSchedule(schedule));

    const effect = Effect.succeed(42);
    const wrappedEffect = result.current.applySchedule(effect);

    unmount();

    // Should not throw after unmount
    const value = await Effect.runPromise(wrappedEffect);
    expect(value).toBe(42);
  });
});
