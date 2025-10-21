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

  scheduleRef.current = schedule;
  optionsRef.current = options;

  const reset = useCallback(() => {
    setStats({ attempts: 0, lastDelay: null });
  }, []);

  const applySchedule = useCallback(
    <E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      return effect.pipe(
        Effect.retry({
          schedule: scheduleRef.current.pipe(
            Schedule.tapOutput((output, delay) =>
              Effect.sync(() => {
                setStats((prev) => ({
                  attempts: prev.attempts + 1,
                  lastDelay: delay,
                }));
                optionsRef.current?.onRetry?.(
                  stats.attempts + 1,
                  delay
                );
              })
            )
          ),
        }),
        Effect.tap((result) =>
          Effect.sync(() => {
            optionsRef.current?.onComplete?.(stats.attempts, result as Out);
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            optionsRef.current?.onFailure?.(error);
          })
        )
      );
    },
    [stats.attempts]
  );

  return {
    schedule: scheduleRef.current,
    applySchedule,
    reset,
    stats,
  };
}
