import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { ProvideService } from './useProvideService';
import { useService } from './useService';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import React, { useState, useMemo } from 'react';

// Define test services
class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    readonly log: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
  }
>() {}

class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly apiUrl: string;
    readonly timeout: number;
  }
>() {}

class ThemeService extends Context.Tag('ThemeService')<
  ThemeService,
  {
    readonly colors: {
      primary: string;
      secondary: string;
    };
    readonly mode: 'light' | 'dark';
  }
>() {}

class CounterService extends Context.Tag('CounterService')<
  CounterService,
  {
    readonly value: number;
    readonly increment: () => Effect.Effect<void>;
  }
>() {}

describe('ProvideService', () => {
  afterEach(() => {
    cleanup();
  });

  it('should provide basic service to children', () => {
    const consoleLogger = {
      log: (message: string) => Effect.sync(() => console.log(message)),
      error: (message: string) => Effect.sync(() => console.error(message)),
    };

    function TestComponent() {
      const logger = useService(LoggerService);
      return <div>{logger ? 'has-logger' : 'no-logger'}</div>;
    }

    render(
      <ProvideService tag={LoggerService} service={consoleLogger}>
        <TestComponent />
      </ProvideService>
    );

    expect(screen.getByText('has-logger')).toBeInTheDocument();
  });

  it('should return null when service is not provided', () => {
    function TestComponent() {
      const logger = useService(LoggerService);
      return <div>{logger ? 'has-logger' : 'no-logger'}</div>;
    }

    render(<TestComponent />);

    expect(screen.getByText('no-logger')).toBeInTheDocument();
  });

  it('should support nested ProvideService components', () => {
    const config = {
      apiUrl: 'https://api.example.com',
      timeout: 5000,
    };

    const logger = {
      log: (message: string) => Effect.sync(() => console.log(message)),
      error: (message: string) => Effect.sync(() => console.error(message)),
    };

    function TestComponent() {
      const configService = useService(ConfigService);
      const loggerService = useService(LoggerService);
      return (
        <div>
          <div>url:{configService?.apiUrl}</div>
          <div>logger:{loggerService ? 'yes' : 'no'}</div>
        </div>
      );
    }

    render(
      <ProvideService tag={ConfigService} service={config}>
        <ProvideService tag={LoggerService} service={logger}>
          <TestComponent />
        </ProvideService>
      </ProvideService>
    );

    expect(screen.getByText('url:https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('logger:yes')).toBeInTheDocument();
  });

  it('should allow dynamic service updates', async () => {
    const lightTheme = {
      colors: { primary: '#007bff', secondary: '#6c757d' },
      mode: 'light' as const,
    };

    const darkTheme = {
      colors: { primary: '#0056b3', secondary: '#495057' },
      mode: 'dark' as const,
    };

    function TestComponent() {
      const theme = useService(ThemeService);
      return <div>mode:{theme?.mode}</div>;
    }

    function ThemableApp() {
      const [isDark, setIsDark] = useState(false);
      const theme = isDark ? darkTheme : lightTheme;

      return (
        <div>
          <button onClick={() => setIsDark(!isDark)}>Toggle</button>
          <ProvideService tag={ThemeService} service={theme}>
            <TestComponent />
          </ProvideService>
        </div>
      );
    }

    render(<ThemableApp />);

    expect(screen.getByText('mode:light')).toBeInTheDocument();

    const button = screen.getByText('Toggle');
    button.click();

    await waitFor(() => {
      expect(screen.getByText('mode:dark')).toBeInTheDocument();
    });
  });

  it('should override outer service with inner service of same tag', () => {
    const outerLogger = {
      log: (message: string) => Effect.sync(() => `outer:${message}`),
      error: (message: string) => Effect.sync(() => console.error(message)),
    };

    const innerLogger = {
      log: (message: string) => Effect.sync(() => `inner:${message}`),
      error: (message: string) => Effect.sync(() => console.error(message)),
    };

    function TestComponent() {
      const logger = useService(LoggerService);
      return <div>logger:{logger ? 'inner' : 'outer'}</div>;
    }

    render(
      <ProvideService tag={LoggerService} service={outerLogger}>
        <div data-testid="outer">outer-level</div>
        <ProvideService tag={LoggerService} service={innerLogger}>
          <TestComponent />
        </ProvideService>
      </ProvideService>
    );

    expect(screen.getByText('logger:inner')).toBeInTheDocument();
  });

  it('should display fallback when service is null', () => {
    function TestComponent() {
      return <div>main-content</div>;
    }

    render(
      <ProvideService
        tag={LoggerService}
        service={null as any}
        fallback={<div>loading-service</div>}
      >
        <TestComponent />
      </ProvideService>
    );

    expect(screen.getByText('loading-service')).toBeInTheDocument();
    expect(screen.queryByText('main-content')).not.toBeInTheDocument();
  });

  it('should work with useMemo for stable service reference', () => {
    function TestComponent() {
      const counter = useService(CounterService);
      return <div>value:{counter?.value}</div>;
    }

    function CounterProvider({ children }: { children: React.ReactNode }) {
      const [value, setValue] = useState(0);

      const counterService = useMemo(
        () => ({
          value,
          increment: () => Effect.sync(() => setValue(value + 1)),
        }),
        [value]
      );

      return (
        <ProvideService tag={CounterService} service={counterService}>
          {children}
        </ProvideService>
      );
    }

    render(
      <CounterProvider>
        <TestComponent />
      </CounterProvider>
    );

    expect(screen.getByText('value:0')).toBeInTheDocument();
  });

  it('should provide service to deeply nested children', () => {
    const config = {
      apiUrl: 'https://deep.example.com',
      timeout: 3000,
    };

    function DeepChild() {
      const configService = useService(ConfigService);
      return <div>timeout:{configService?.timeout}</div>;
    }

    function MiddleComponent() {
      return (
        <div>
          <div>
            <div>
              <DeepChild />
            </div>
          </div>
        </div>
      );
    }

    render(
      <ProvideService tag={ConfigService} service={config}>
        <MiddleComponent />
      </ProvideService>
    );

    expect(screen.getByText('timeout:3000')).toBeInTheDocument();
  });

  it('should render children when service is provided (no fallback)', () => {
    const logger = {
      log: (message: string) => Effect.sync(() => console.log(message)),
      error: (message: string) => Effect.sync(() => console.error(message)),
    };

    render(
      <ProvideService
        tag={LoggerService}
        service={logger}
        fallback={<div>fallback</div>}
      >
        <div>children</div>
      </ProvideService>
    );

    expect(screen.getByText('children')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });
});
