import { useState, useEffect } from 'react';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

/**
 * React hook for managing Effect-TS ManagedRuntime lifecycle
 *
 * Creates a ManagedRuntime from a Layer and manages its lifecycle automatically.
 * Resources acquired in scoped layers are automatically released when the component unmounts.
 *
 * @param layer - The Effect Layer to build the runtime from
 * @param options - Optional configuration
 * @param options.onError - Callback invoked when runtime construction fails
 * @returns Object containing the runtime, loading state, and error
 */
export function useManagedRuntime<R, E = never>(
  layer: Layer.Layer<R, E, never>,
  options?: {
    onError?: (error: E) => void;
  }
): {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  loading: boolean;
  error: E | null;
} {
  const [state, setState] = useState<{
    runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
    loading: boolean;
    error: E | null;
  }>({
    runtime: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let currentRuntime: ManagedRuntime.ManagedRuntime<R, E> | null = null;

    // Reset to loading state when layer changes
    setState({
      runtime: null,
      loading: true,
      error: null,
    });

    // Create the ManagedRuntime
    const effect = ManagedRuntime.make(layer);

    // Execute the effect
    Effect.runPromiseExit(effect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        // Success: set runtime
        currentRuntime = exit.value;
        setState({
          runtime: exit.value,
          loading: false,
          error: null,
        });
      } else {
        // Failure: set error
        const failure = Cause.failureOption(exit.cause);
        const error = failure._tag === 'Some' ? failure.value : (null as E | null);

        setState({
          runtime: null,
          loading: false,
          error,
        });

        // Call onError callback if provided
        if (error !== null) {
          options?.onError?.(error);
        }
      }
    });

    // Cleanup: dispose the ManagedRuntime
    return () => {
      cancelled = true;

      if (currentRuntime) {
        // Dispose the runtime (releases all scoped resources)
        Effect.runPromise(currentRuntime.dispose()).catch((error) => {
          console.error('Failed to dispose runtime:', error);
        });
      }
    };
  }, [layer, options?.onError]);

  return state;
}
