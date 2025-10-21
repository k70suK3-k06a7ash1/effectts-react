import { useCallback, useState, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Runtime from 'effect/Runtime';

/**
 * React hook for Effect Request/RequestResolver - enables request batching and N+1 optimization
 *
 * @param resolver - The RequestResolver that handles batching requests
 * @param options - Optional configuration including custom runtime
 * @returns Object containing execute, executePromise, loading, and error state
 */
export function useRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    runtime?: Runtime.Runtime<never>;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const resolverRef = useRef(resolver);

  // Update resolver reference when it changes
  resolverRef.current = resolver;

  const execute = useCallback(
    <E, R>(request: Request.Request<E, R>): Effect.Effect<E, any> => {
      return Effect.request(request, resolverRef.current);
    },
    []
  );

  const executePromise = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      setLoading(true);
      setError(null);

      try {
        const effect = Effect.request(request, resolverRef.current);
        const result = options?.runtime
          ? await Runtime.runPromise(options.runtime)(effect)
          : await Effect.runPromise(effect);

        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [options?.runtime]
  );

  return { execute, executePromise, loading, error };
}
