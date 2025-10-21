import React, { createContext, ReactNode, ReactElement } from 'react';
import * as Context from 'effect/Context';

// WeakMap to store React Context for each service tag
const ServiceContextMap = new WeakMap<
  Context.Tag<any, any>,
  React.Context<any>
>();

/**
 * Gets or creates a React Context for a given service tag.
 * Uses WeakMap to ensure each tag gets its own Context instance.
 */
function getOrCreateServiceContext<I, S>(
  tag: Context.Tag<I, S>
): React.Context<S | null> {
  if (ServiceContextMap.has(tag)) {
    return ServiceContextMap.get(tag)!;
  }

  const context = createContext<S | null>(null);
  ServiceContextMap.set(tag, context);
  return context;
}

export interface ProvideServiceProps<I, S> {
  tag: Context.Tag<I, S>;
  service: S;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ProvideService component provides a single Effect service to its children.
 * This is a simpler alternative to EffectProvider when you don't need Layer composition.
 *
 * @example
 * ```tsx
 * const logger = {
 *   log: (msg: string) => Effect.sync(() => console.log(msg))
 * };
 *
 * <ProvideService tag={LoggerService} service={logger}>
 *   <MyComponent />
 * </ProvideService>
 * ```
 */
export function ProvideService<I, S>({
  tag,
  service,
  children,
  fallback,
}: ProvideServiceProps<I, S>): ReactElement {
  const ServiceContext = getOrCreateServiceContext(tag);

  // If service is null/undefined and fallback is provided, show fallback
  if (!service && fallback) {
    return <>{fallback}</>;
  }

  return (
    <ServiceContext.Provider value={service}>
      {children}
    </ServiceContext.Provider>
  );
}

// Export the helper function for use in useService hook
export { getOrCreateServiceContext };
