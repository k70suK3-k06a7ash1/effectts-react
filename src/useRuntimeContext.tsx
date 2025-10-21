import { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as ManagedRuntime from 'effect/ManagedRuntime';

// React context to hold the ManagedRuntime
const RuntimeContext = createContext<ManagedRuntime.ManagedRuntime<
  any,
  any
> | null>(null);

/**
 * RuntimeProvider - Provides a ManagedRuntime to child components via React Context
 *
 * @param runtime - The ManagedRuntime to provide to child components
 * @param children - Child React components
 *
 * @example
 * ```typescript
 * function App() {
 *   const { runtime } = useManagedRuntime(AppLayer);
 *
 *   if (!runtime) return <div>Loading...</div>;
 *
 *   return (
 *     <RuntimeProvider runtime={runtime}>
 *       <AppContent />
 *     </RuntimeProvider>
 *   );
 * }
 * ```
 */
export function RuntimeProvider<R = any, E = never>({
  runtime,
  children,
}: {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  children: ReactNode;
}): ReactElement {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

/**
 * useRuntimeContext - Retrieves the ManagedRuntime from the nearest RuntimeProvider
 *
 * Throws an error if used outside of a RuntimeProvider or if runtime is null.
 * Use useOptionalRuntimeContext if you need to handle the absence of a runtime.
 *
 * @returns The provided ManagedRuntime
 * @throws Error if not used within a RuntimeProvider or if runtime is null
 *
 * @example
 * ```typescript
 * function UserList() {
 *   const runtime = useRuntimeContext();
 *
 *   const loadUsers = async () => {
 *     const effect = Effect.gen(function* () {
 *       const db = yield* Effect.service(Database);
 *       return yield* db.query('SELECT * FROM users');
 *     });
 *
 *     return await runtime.runPromise(effect);
 *   };
 *
 *   // ...
 * }
 * ```
 */
export function useRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<
  R,
  never
> {
  const runtime = useContext(RuntimeContext);

  if (!runtime) {
    throw new Error(
      'useRuntimeContext must be used within a RuntimeProvider. ' +
        'Make sure your component is wrapped with <RuntimeProvider runtime={...}>.'
    );
  }

  return runtime as ManagedRuntime.ManagedRuntime<R, never>;
}

/**
 * useOptionalRuntimeContext - Retrieves the ManagedRuntime from the nearest RuntimeProvider
 *
 * Returns null if used outside of a RuntimeProvider or if runtime is null.
 * Use this for optional runtime access or conditional logic.
 *
 * @returns The provided ManagedRuntime or null if not available
 *
 * @example
 * ```typescript
 * function OptionalFeature() {
 *   const runtime = useOptionalRuntimeContext();
 *
 *   if (!runtime) {
 *     return <div>Feature not available</div>;
 *   }
 *
 *   // Use runtime...
 * }
 * ```
 */
export function useOptionalRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<
  R,
  never
> | null {
  return useContext(RuntimeContext) as ManagedRuntime.ManagedRuntime<
    R,
    never
  > | null;
}
