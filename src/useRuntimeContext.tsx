import React, { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/**
 * React context for ManagedRuntime
 */
const RuntimeContext = createContext<
  ManagedRuntime.ManagedRuntime<any, any> | null | undefined
>(undefined);

/**
 * Props for RuntimeProvider
 */
export interface RuntimeProviderProps<R = any, E = never> {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  children: ReactNode;
}

/**
 * RuntimeProvider component
 * Provides a ManagedRuntime to its children via React context
 *
 * @param props - Provider props with runtime and children
 * @returns React element
 */
export function RuntimeProvider<R = any, E = never>({
  runtime,
  children,
}: RuntimeProviderProps<R, E>): ReactElement {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

/**
 * useRuntimeContext hook
 * Gets the ManagedRuntime from the nearest RuntimeProvider
 *
 * @throws Error if used outside of RuntimeProvider
 * @throws Error if runtime is null
 * @returns ManagedRuntime from context
 */
export function useRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<
  R,
  never
> {
  const runtime = useContext(RuntimeContext);

  if (runtime === undefined) {
    throw new Error('useRuntimeContext must be used within RuntimeProvider');
  }

  if (runtime === null) {
    throw new Error('Runtime is not available');
  }

  return runtime as ManagedRuntime.ManagedRuntime<R, never>;
}
