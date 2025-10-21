import { useState, useEffect } from 'react';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';

export function useStreamValue<A, E = never>(
  stream: Stream.Stream<A, E, never>,
  options?: {
    initialValue?: A;
    onError?: (_error: E) => void;
    onDone?: () => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
} {
  const [value, setValue] = useState<A | null>(options?.initialValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Subscribe to stream and update only the latest value
    const effect = Stream.runForEach(stream, (newValue) =>
      Effect.sync(() => {
        if (cancelled) return;

        // Update latest value
        setValue(newValue);

        // Set loading to false on first data reception
        setLoading(false);
      })
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          if (!cancelled) {
            setDone(true);
            setLoading(false);
            options?.onDone?.();
          }
        })
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          if (!cancelled) {
            setError(err);
            setLoading(false);
            options?.onError?.(err);
          }
        })
      )
    );

    // Run the effect
    Effect.runPromise(effect).catch(() => {
      // Errors are already handled in catchAll
    });

    // Cleanup
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, options?.onError, options?.onDone]);

  return {
    value,
    loading,
    error,
    done,
  };
}
