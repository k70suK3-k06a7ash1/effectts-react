import { useState, useEffect } from 'react';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Runtime from 'effect/Runtime';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

/**
 * React hook for building Effect Layers and accessing their Context
 *
 * @param layer - The Effect Layer to build
 * @param options - Optional configuration
 * @param options.runtime - Custom runtime for layer construction (required if RIn is not never)
 * @returns Object containing the built context, loading state, and error
 */
export function useLayer<R, E = never, RIn = never>(
  layer: Layer.Layer<R, E, RIn>,
  options?: {
    runtime?: Runtime.Runtime<RIn>;
  }
): {
  context: Context.Context<R> | null;
  loading: boolean;
  error: E | null;
} {
  const [state, setState] = useState<{
    context: Context.Context<R> | null;
    loading: boolean;
    error: E | null;
  }>({
    context: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    // Reset to loading state when layer changes
    setState({
      context: null,
      loading: true,
      error: null,
    });

    // Build the layer - Layer.build returns a scoped Effect
    // We need to run it in a scope and extract the context
    const buildEffect = Effect.scoped(
      Effect.map(Layer.build(layer), (ctx) => ctx)
    ) as Effect.Effect<Context.Context<R>, E, never>;

    // Use custom runtime if provided, otherwise use default
    const runEffect = options?.runtime
      ? Runtime.runPromiseExit(options.runtime)
      : Effect.runPromiseExit;

    runEffect(buildEffect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        // Success: set context
        setState({
          context: exit.value,
          loading: false,
          error: null,
        });
      } else {
        // Failure: set error
        const failure = Cause.failureOption(exit.cause);
        const error = failure._tag === 'Some' ? failure.value : null;

        setState({
          context: null,
          loading: false,
          error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [layer, options?.runtime]);

  return state;
}
