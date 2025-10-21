import { useState, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

export function useRetry<A, E = never>(
  options?: {
    maxAttempts?: number;
    delay?: Duration.Duration | 'exponential' | 'linear';
    shouldRetry?: (_error: E, _attempt: number) => boolean;
    onRetry?: (_error: E, _attempt: number) => void;
    onSuccess?: (_value: A, _attempts: number) => void;
    onFailure?: (_error: E, _attempts: number) => void;
  }
): {
  execute: (effect: Effect.Effect<A, E, never>) => Promise<A>;
  executeEffect: (effect: Effect.Effect<A, E, never>) => Effect.Effect<A, E, never>;
  retry: <R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  attempts: number;
  isRetrying: boolean;
  reset: () => void;
} {
  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const optionsRef = useRef(options);

  optionsRef.current = options;

  const getSchedule = useCallback((): Schedule.Schedule<any, E, never> => {
    const maxAttempts = optionsRef.current?.maxAttempts ?? 3;
    const delay = optionsRef.current?.delay ?? 'exponential';

    let baseSchedule: Schedule.Schedule<any, any, never>;

    if (typeof delay === 'string') {
      switch (delay) {
        case 'exponential':
          baseSchedule = Schedule.exponential(Duration.millis(100));
          break;
        case 'linear':
          baseSchedule = Schedule.linear(Duration.millis(100));
          break;
        default:
          baseSchedule = Schedule.exponential(Duration.millis(100));
      }
    } else {
      baseSchedule = Schedule.spaced(delay);
    }

    // Limit retries to maxAttempts - 1 (first attempt + retries)
    let schedule: Schedule.Schedule<any, E, never> = baseSchedule.pipe(
      Schedule.compose(Schedule.recurs(maxAttempts - 1))
    );

    // Add retry condition if provided
    if (optionsRef.current?.shouldRetry) {
      const shouldRetry = optionsRef.current.shouldRetry;
      schedule = schedule.pipe(
        Schedule.whileInput((error: E) => {
          const currentAttempt = attempts + 1;
          return shouldRetry(error, currentAttempt);
        })
      );
    }

    return schedule;
  }, [attempts]);

  const retry = useCallback(
    <R,>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      let retryCount = 0;
      let lastError: E | null = null;

      return effect.pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            lastError = error;
          })
        ),
        Effect.retry({
          schedule: getSchedule().pipe(
            Schedule.tapOutput(() =>
              Effect.sync(() => {
                retryCount++;
                setAttempts((prev) => prev + 1);
                setIsRetrying(true);
                // Call onRetry for each retry attempt
                if (lastError !== null) {
                  optionsRef.current?.onRetry?.(lastError, retryCount);
                }
              })
            )
          ),
        }),
        Effect.tap((value) =>
          Effect.sync(() => {
            setIsRetrying(false);
            optionsRef.current?.onSuccess?.(value, retryCount);
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            setIsRetrying(false);
            optionsRef.current?.onFailure?.(error, retryCount + 1);
          })
        )
      );
    },
    [getSchedule]
  );

  const executeEffect = useCallback(
    (effect: Effect.Effect<A, E, never>): Effect.Effect<A, E, never> => {
      return retry(effect);
    },
    [retry]
  );

  const execute = useCallback(
    async (effect: Effect.Effect<A, E, never>): Promise<A> => {
      setIsRetrying(true);
      try {
        const result = await Effect.runPromise(retry(effect));
        return result;
      } catch (error) {
        throw error;
      } finally {
        setIsRetrying(false);
      }
    },
    [retry]
  );

  const reset = useCallback(() => {
    setAttempts(0);
    setIsRetrying(false);
  }, []);

  return {
    execute,
    executeEffect,
    retry,
    attempts,
    isRetrying,
    reset,
  };
}
