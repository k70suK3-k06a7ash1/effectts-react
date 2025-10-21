import { useEffect, useState, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';

export function useFiber<A, E = never>(
  effect: Effect.Effect<A, E, never>,
  options?: {
    autoStart?: boolean;
    onSuccess?: (_value: A) => void;
    onFailure?: (_error: E) => void;
  }
): {
  start: () => void;
  interrupt: () => void;
  status: 'idle' | 'running' | 'done' | 'failed' | 'interrupted';
  result: A | null;
  error: E | null;
} {
  const [status, setStatus] = useState<
    'idle' | 'running' | 'done' | 'failed' | 'interrupted'
  >('idle');
  const [result, setResult] = useState<A | null>(null);
  const [error, setError] = useState<E | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);

  const start = useCallback(() => {
    setStatus('running');
    setResult(null);
    setError(null);

    const fiber = Effect.runFork(effect);
    fiberRef.current = fiber;

    Fiber.join(fiber).pipe(
      Effect.flatMap((value) =>
        Effect.sync(() => {
          setResult(value);
          setStatus('done');
          options?.onSuccess?.(value);
        })
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          setError(err);
          setStatus('failed');
          options?.onFailure?.(err);
        })
      ),
      Effect.catchAllDefect(() => Effect.void),
      Effect.runPromise
    ).catch(() => {
      // Silently handle any interruption errors
    });
  }, [effect, options?.onSuccess, options?.onFailure]);

  const interrupt = useCallback(() => {
    if (fiberRef.current) {
      Fiber.interrupt(fiberRef.current).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.runPromise
      );
      setStatus('interrupted');
      fiberRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (options?.autoStart) {
      start();
    }

    return () => {
      if (fiberRef.current) {
        Fiber.interrupt(fiberRef.current).pipe(
          Effect.catchAll(() => Effect.void),
          Effect.runPromise
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, interrupt, status, result, error };
}
