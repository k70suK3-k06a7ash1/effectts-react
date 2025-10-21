import { useState, useEffect } from 'react';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';

export function useStream<A, E = never>(
  stream: Stream.Stream<A, E, never>,
  options?: {
    bufferSize?: number;
    initialValue?: A;
    onError?: (_error: E) => void;
    onDone?: () => void;
  }
): {
  data: A[];
  latest: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
} {
  const [data, setData] = useState<A[]>([]);
  const [latest, setLatest] = useState<A | null>(options?.initialValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxSize = options?.bufferSize ?? Infinity;

    // Subscribe to stream
    const effect = Stream.runForEach(stream, (value) =>
      Effect.sync(() => {
        if (cancelled) return;

        // Update latest value
        setLatest(value);

        // Update data array
        setData((prev) => {
          const next = [...prev, value];
          // Remove old data if buffer size is exceeded
          return next.length > maxSize ? next.slice(-maxSize) : next;
        });

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
  }, [stream, options?.bufferSize, options?.onError, options?.onDone]);

  return {
    data,
    latest,
    loading,
    error,
    done,
  };
}
