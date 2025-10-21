import { useState, useEffect, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useEffectRun<A, E = never>(
  effect: Effect.Effect<A, E, never>,
  options?: {
    deps?: React.DependencyList;
    onSuccess?: (_value: A) => void;
    onFailure?: (_error: E) => void;
    onDefect?: (_cause: Cause.Cause<never>) => void;
  }
): {
  data: A | null;
  error: E | null;
  loading: boolean;
  fiber: Fiber.RuntimeFiber<A, E> | null;
  rerun: () => void;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
    fiber: Fiber.RuntimeFiber<A, E> | null;
  }>({
    data: null,
    error: null,
    loading: true,
    fiber: null,
  });

  const [rerunCounter, setRerunCounter] = useState(0);
  const deps = options?.deps || [];

  useEffect(() => {
    // Start loading
    setState((prev) => ({ ...prev, loading: true, error: null }));

    // Run the effect and get the fiber
    const fiber = Effect.runFork(effect);

    // Store fiber in state
    setState((prev) => ({ ...prev, fiber }));

    // Wait for fiber completion using Effect.runPromise
    Fiber.await(fiber)
      .pipe(
        Effect.flatMap((exit) =>
          Effect.sync(() => {
            if (Exit.isSuccess(exit)) {
              // Success
              setState({
                data: exit.value,
                error: null,
                loading: false,
                fiber: null,
              });
              options?.onSuccess?.(exit.value);
            } else {
              // Failure or interruption
              const failure = Cause.failureOption(exit.cause);

              if (failure._tag === 'Some') {
                // Normal error
                setState({
                  data: null,
                  error: failure.value,
                  loading: false,
                  fiber: null,
                });
                options?.onFailure?.(failure.value);
              } else {
                // Defect or interruption
                setState({
                  data: null,
                  error: null,
                  loading: false,
                  fiber: null,
                });
                // For defects, we need to extract the cause without the error type
                if (options?.onDefect) {
                  const defectCause = exit.cause as unknown as Cause.Cause<never>;
                  options.onDefect(defectCause);
                }
              }
            }
          })
        ),
        Effect.catchAllDefect(() => Effect.void),
        Effect.runPromise
      )
      .catch(() => {
        // Silently handle interruption errors
      });

    // Cleanup: interrupt the fiber
    return () => {
      Effect.runFork(
        Fiber.interrupt(fiber).pipe(Effect.catchAll(() => Effect.void))
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, rerunCounter]);

  const rerun = useCallback(() => {
    setRerunCounter((prev) => prev + 1);
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    fiber: state.fiber,
    rerun,
  };
}
