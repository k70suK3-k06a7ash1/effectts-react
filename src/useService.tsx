import React, { createContext, useContext, useMemo } from 'react';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Runtime from 'effect/Runtime';
import * as Effect from 'effect/Effect';

// React Context to hold the Effect Runtime
const EffectRuntimeContext = createContext<Runtime.Runtime<any> | null>(null);

// Export for use in other hooks
export { EffectRuntimeContext };

export interface EffectProviderProps {
  layer: Layer.Layer<any, never, never>;
  children: React.ReactNode;
}

export function EffectProvider({ layer, children }: EffectProviderProps) {
  const parentRuntime = useContext(EffectRuntimeContext);

  const runtime = useMemo(() => {
    // Build the layer into a runtime
    const runtimeLayer = Layer.toRuntime(layer);
    const newRuntime = Effect.runSync(
      Effect.scoped(runtimeLayer) as Effect.Effect<Runtime.Runtime<any>, never, never>
    );

    return newRuntime;
  }, [layer, parentRuntime]);

  return (
    <EffectRuntimeContext.Provider value={runtime}>
      {children}
    </EffectRuntimeContext.Provider>
  );
}

export function useService<I, S>(tag: Context.Tag<I, S>): S | null {
  const runtime = useContext(EffectRuntimeContext);

  const service = useMemo(() => {
    if (!runtime) {
      return null;
    }

    // Try to get the service from the runtime context
    try {
      const ctx = runtime.context as Context.Context<any>;
      return Context.getOption(ctx, tag);
    } catch {
      return null;
    }
  }, [runtime, tag]);

  // Return the service value if it exists
  if (service && '_tag' in service && service._tag === 'Some') {
    return service.value;
  }

  return null;
}
