import React, { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as ConfigProviderEffect from 'effect/ConfigProvider';

/**
 * Context for providing Effect ConfigProvider to the React component tree
 */
const ConfigProviderContext = createContext<ConfigProviderEffect.ConfigProvider | null>(
  null
);

/**
 * ConfigProvider component for providing Effect ConfigProvider to child components
 *
 * @param provider - The Effect ConfigProvider to provide
 * @param children - React children to render
 * @param fallback - Optional fallback UI to render when provider is null
 * @returns ReactElement
 */
export function ConfigProvider({
  provider,
  children,
  fallback,
}: {
  provider: ConfigProviderEffect.ConfigProvider;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement {
  if (!provider && fallback) {
    return <>{fallback}</>;
  }

  return (
    <ConfigProviderContext.Provider value={provider}>
      {children}
    </ConfigProviderContext.Provider>
  );
}

/**
 * Hook to access the current ConfigProvider from context
 *
 * @returns The current ConfigProvider or null if not in a ConfigProvider tree
 */
export function useConfigProvider(): ConfigProviderEffect.ConfigProvider | null {
  return useContext(ConfigProviderContext);
}
