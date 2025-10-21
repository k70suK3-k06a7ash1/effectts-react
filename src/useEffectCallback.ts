import { useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEffectCallback<A, E = never, Args extends any[] = []>(
  createEffect: (..._args: Args) => Effect.Effect<A, E>,
  options?: {
    onSuccess?: (_value: A) => void;
    onFailure?: (_error: E) => void;
  }
): {
  execute: (..._args: Args) => Promise<void>;
  data: A | null;
  error: E | null;
  loading: boolean;
  reset: () => void;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: false,
  });

  const execute = useCallback(
    async (..._args: Args) => {
      // Start loading, clear previous state
      setState({ data: null, error: null, loading: true });

      // Create and run the effect
      const effect = createEffect(..._args);
      const exit = await Effect.runPromiseExit(effect);

      if (Exit.isSuccess(exit)) {
        // Success
        setState({ data: exit.value, error: null, loading: false });
        options?.onSuccess?.(exit.value);
      } else {
        // Failure
        const failure = Cause.failureOption(exit.cause);
        const error = failure._tag === 'Some' ? failure.value : (null as E | null);

        setState({ data: null, error, loading: false });

        if (error) {
          options?.onFailure?.(error);
        }
      }
    },
    [createEffect, options?.onSuccess, options?.onFailure]
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    execute,
    data: state.data,
    error: state.error,
    loading: state.loading,
    reset,
  };
}
