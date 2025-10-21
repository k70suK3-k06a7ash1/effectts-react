import { useEffect as useReactEffect, useState } from 'react';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

/**
 * Run an Effect repeatedly at a specified interval
 *
 * @param effect - The Effect to run
 * @param intervalMs - Interval in milliseconds
 * @param deps - Dependencies array
 * @returns Object containing loading state, data, and error
 */
export function usePoll<A, E>(
  effect: Effect.Effect<A, E>,
  intervalMs: number,
  deps: React.DependencyList = []
): {
  data: A | null;
  error: E | null;
  loading: boolean;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useReactEffect(() => {
    let cancelled = false;

    const runEffect = () => {
      if (cancelled) return;

      Effect.runPromiseExit(effect).then((exit) => {
        if (cancelled) return;

        if (Exit.isSuccess(exit)) {
          setState({ data: exit.value, error: null, loading: false });
        } else {
          const failure = Cause.failureOption(exit.cause);
          setState({
            data: null,
            error: failure._tag === 'Some' ? failure.value : null,
            loading: false
          });
        }
      });
    };

    // Run immediately
    runEffect();

    // Then run on interval
    const interval = setInterval(runEffect, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, deps);

  return state;
}
