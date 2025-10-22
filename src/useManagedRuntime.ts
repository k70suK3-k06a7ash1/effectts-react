import { useEffect, useState } from 'react';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/**
 * React hook for managing Effect ManagedRuntime
 * Creates a runtime from a Layer and handles resource lifecycle
 *
 * @param layer - The Layer to convert into a runtime
 * @param options - Optional configuration including error callback
 * @returns Object containing runtime, loading state, and error
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
    let managedRuntime: ManagedRuntime.ManagedRuntime<R, E> | null = null;

    // Create ManagedRuntime synchronously
    try {
      managedRuntime = ManagedRuntime.make(layer);

      // Wait for runtime to be ready
      managedRuntime
        .runtime()
        .then(() => {
          if (!cancelled) {
            setState({
              runtime: managedRuntime,
              loading: false,
              error: null,
            });
          }
        })
        .catch((err: E) => {
          if (!cancelled) {
            setState({
              runtime: null,
              loading: false,
              error: err,
            });
            options?.onError?.(err);
          }
        });
    } catch (err) {
      if (!cancelled) {
        setState({
          runtime: null,
          loading: false,
          error: err as E,
        });
        options?.onError?.(err as E);
      }
    }

    // Cleanup: dispose runtime
    return () => {
      cancelled = true;

      if (managedRuntime) {
        managedRuntime.dispose().catch((error) => {
          console.error('Failed to dispose runtime:', error);
        });
      }
    };
  }, [layer, options?.onError]);

  return state;
}
