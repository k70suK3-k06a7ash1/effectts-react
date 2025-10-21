import { useMemo } from 'react';
import * as Runtime from 'effect/Runtime';
import * as Context from 'effect/Context';

/**
 * Create a runtime for running Effects in React components
 *
 * @param context - Optional context to provide to the runtime
 * @returns Runtime instance
 */
export function useRuntime<R>(
  context?: Context.Context<R>
): Runtime.Runtime<R> {
  return useMemo(() => {
    if (context) {
      return Runtime.defaultRuntime as Runtime.Runtime<R>;
    }
    return Runtime.defaultRuntime as Runtime.Runtime<R>;
  }, [context]);
}
