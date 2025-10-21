import { useContext, useMemo } from 'react';
import * as Context from 'effect/Context';
import { EffectRuntimeContext } from './useService';

/**
 * Hook to get the current Effect Context from the nearest EffectProvider
 *
 * @returns The Effect Context if available, null otherwise
 *
 * @example
 * ```typescript
 * const context = useEffectContext<MyService>();
 *
 * if (context) {
 *   const maybeService = Context.getOption(context, MyService);
 *   if (Option.isSome(maybeService)) {
 *     // Use the service
 *   }
 * }
 * ```
 */
export function useEffectContext<R>(): Context.Context<R> | null {
  const runtime = useContext(EffectRuntimeContext);

  const context = useMemo(() => {
    if (!runtime) {
      return null;
    }

    try {
      // Extract the context from the runtime
      const ctx = runtime.context as Context.Context<R>;
      return ctx;
    } catch {
      return null;
    }
  }, [runtime]);

  return context;
}
