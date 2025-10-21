import { useState, useEffect } from 'react';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export type EffectResult<A, E> =
  | { _tag: 'Initial' }
  | { _tag: 'Loading' }
  | { _tag: 'Success'; value: A }
  | { _tag: 'Failure'; error: E }
  | { _tag: 'Defect'; cause: Cause.Cause<never> };

export function useEffectResult<A, E = never>(
  effect: Effect.Effect<A, E, never>,
  options?: {
    deps?: React.DependencyList;
  }
): EffectResult<A, E> {
  const [result, setResult] = useState<EffectResult<A, E>>({
    _tag: 'Initial',
  });

  const deps = options?.deps || [];

  useEffect(() => {
    let cancelled = false;

    // Set loading state
    setResult({ _tag: 'Loading' });

    Effect.runPromiseExit(effect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        // Success
        setResult({ _tag: 'Success', value: exit.value });
      } else {
        // Failure or Defect
        const failure = Cause.failureOption(exit.cause);

        if (failure._tag === 'Some') {
          // Normal error (Failure)
          setResult({ _tag: 'Failure', error: failure.value });
        } else {
          // Unexpected error (Defect)
          const defectCause = exit.cause as unknown as Cause.Cause<never>;
          setResult({ _tag: 'Defect', cause: defectCause });
        }
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
