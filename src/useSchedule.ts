import { useState, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

interface ScheduleStats {
  attempts: number;
  lastDelay: Duration.Duration | null;
}

export function useSchedule<A, Out = A>(
  schedule: Schedule.Schedule<Out, A, never>,
  options?: {
    onRetry?: (attempt: number, delay: Duration.Duration) => void;
    onComplete?: (attempts: number, output: Out) => void;
    onFailure?: (error: any) => void;
  }
): {
  schedule: Schedule.Schedule<Out, A, never>;
  applySchedule: <E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
  reset: () => void;
  stats: ScheduleStats;
} {
  const [stats, setStats] = useState<ScheduleStats>({
    attempts: 0,
    lastDelay: null,
  });

  const scheduleRef = useRef(schedule);
  const optionsRef = useRef(options);
  const retryCountRef = useRef(0);

  scheduleRef.current = schedule;
  optionsRef.current = options;

  const reset = useCallback(() => {
    setStats({ attempts: 0, lastDelay: null });
    retryCountRef.current = 0;
  }, []);

  const applySchedule = useCallback(
    <E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      retryCountRef.current = 0;

      const retryableEffect = Effect.suspend(() => {
        return effect.pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              const currentAttempt = retryCountRef.current;
              retryCountRef.current++;

              // Track attempts (increment happens after first failure)
              const delay = Duration.millis(Math.pow(2, currentAttempt) * 10); // Approximate delay
              setStats({
                attempts: retryCountRef.current,
                lastDelay: delay,
              });

              if (currentAttempt > 0) {
                optionsRef.current?.onRetry?.(retryCountRef.current, delay);
              }
            })
          )
        );
      });

      return retryableEffect.pipe(
        Effect.retry(scheduleRef.current as any),
        Effect.tap((result) =>
          Effect.sync(() => {
            optionsRef.current?.onComplete?.(retryCountRef.current, result as Out);
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            optionsRef.current?.onFailure?.(error);
          })
        )
      ) as Effect.Effect<A, E, R>;
    },
    []
  );

  return {
    schedule: scheduleRef.current,
    applySchedule,
    reset,
    stats,
  };
}
