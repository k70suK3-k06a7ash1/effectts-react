import { useEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Deferred from 'effect/Deferred';

export function useDeferred<A, E = never>(): {
  deferred: Deferred.Deferred<A, E> | null;
  succeed: (_value: A) => Promise<boolean>;
  fail: (_error: E) => Promise<boolean>;
  await: () => Promise<A>;
  isDone: boolean;
} {
  const [deferred, setDeferred] = useState<Deferred.Deferred<A, E> | null>(
    null
  );
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    Effect.runPromise(Deferred.make<A, E>()).then(setDeferred);
  }, []);

  const succeed = useCallback(
    async (_value: A): Promise<boolean> => {
      if (!deferred) return false;
      const result = await Effect.runPromise(Deferred.succeed(deferred, _value));
      setIsDone(true);
      return result;
    },
    [deferred]
  );

  const fail = useCallback(
    async (_error: E): Promise<boolean> => {
      if (!deferred) return false;
      const result = await Effect.runPromise(Deferred.fail(deferred, _error));
      setIsDone(true);
      return result;
    },
    [deferred]
  );

  const awaitDeferred = useCallback(async (): Promise<A> => {
    if (!deferred) throw new Error('Deferred not initialized');
    return Effect.runPromise(Deferred.await(deferred));
  }, [deferred]);

  return { deferred, succeed, fail, await: awaitDeferred, isDone };
}
