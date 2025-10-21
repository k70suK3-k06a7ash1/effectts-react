import { useEffect as useReactEffect, useState } from 'react';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

/**
 * Run an Effect and return its result in a React component
 *
 * @param effect - The Effect to run
 * @param deps - Dependencies array (like useEffect)
 * @returns Object containing loading state, data, and error
 */
export function useEffectQuery<A, E>(
  effect: Effect.Effect<A, E>,
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

    setState({ data: null, error: null, loading: true });

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

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}
