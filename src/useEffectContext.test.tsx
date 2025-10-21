import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useEffectContext } from './useEffectContext';
import { EffectProvider } from './useService';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import React from 'react';

// Define test services
class TestService extends Context.Tag('TestService')<
  TestService,
  {
    readonly getValue: () => string;
  }
>() {}

class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    readonly log: (message: string) => void;
  }
>() {}

class DatabaseService extends Context.Tag('DatabaseService')<
  DatabaseService,
  {
    readonly query: (sql: string) => string[];
  }
>() {}

describe('useEffectContext', () => {
  afterEach(() => {
    cleanup();
  });

  it('should return null when no provider exists', () => {
    const { result } = renderHook(() => useEffectContext());

    expect(result.current).toBeNull();
  });

  it('should return context when provider exists', () => {
    const testServiceImpl = {
      getValue: () => 'test value',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useEffectContext<TestService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();
  });

  it('should allow retrieving service from context', () => {
    const testServiceImpl = {
      getValue: () => 'test value',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useEffectContext<TestService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();

    if (result.current) {
      const maybeService = Context.getOption(result.current, TestService);
      expect(maybeService._tag).toBe('Some');
      if (maybeService._tag === 'Some') {
        expect(maybeService.value.getValue()).toBe('test value');
      }
    }
  });

  it('should work with multiple services', () => {
    const loggerImpl = {
      log: (message: string) => console.log(message),
    };

    const dbImpl = {
      query: (sql: string) => [`Result for: ${sql}`],
    };

    const layer = Layer.mergeAll(
      Layer.succeed(LoggerService, loggerImpl),
      Layer.succeed(DatabaseService, dbImpl)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result } = renderHook(
      () => useEffectContext<LoggerService | DatabaseService>(),
      { wrapper }
    );

    expect(result.current).not.toBeNull();

    if (result.current) {
      const maybeLogger = Context.getOption(result.current, LoggerService);
      const maybeDb = Context.getOption(result.current, DatabaseService);

      expect(maybeLogger._tag).toBe('Some');
      expect(maybeDb._tag).toBe('Some');

      if (maybeLogger._tag === 'Some') {
        expect(maybeLogger.value).toBe(loggerImpl);
      }
      if (maybeDb._tag === 'Some') {
        expect(maybeDb.value).toBe(dbImpl);
      }
    }
  });

  it('should return None for service not in context', () => {
    const loggerImpl = {
      log: (message: string) => console.log(message),
    };

    const layer = Layer.succeed(LoggerService, loggerImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useEffectContext<LoggerService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();

    if (result.current) {
      // Try to get a service that was not provided
      const maybeTest = Context.getOption(result.current, TestService);
      expect(maybeTest._tag).toBe('None');
    }
  });

  it('should work with nested providers', () => {
    const outerService = {
      getValue: () => 'outer',
    };

    const innerService = {
      getValue: () => 'inner',
    };

    const OuterLayer = Layer.succeed(TestService, outerService);
    const InnerLayer = Layer.succeed(TestService, innerService);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={OuterLayer}>
        <EffectProvider layer={InnerLayer}>{children}</EffectProvider>
      </EffectProvider>
    );

    const { result } = renderHook(() => useEffectContext<TestService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();

    if (result.current) {
      const maybeService = Context.getOption(result.current, TestService);
      expect(maybeService._tag).toBe('Some');
      if (maybeService._tag === 'Some') {
        // Inner provider should override outer
        expect(maybeService.value.getValue()).toBe('inner');
      }
    }
  });

  it('should allow context manipulation with Context.add', () => {
    const baseService = {
      getValue: () => 'base',
    };

    const baseLayer = Layer.succeed(TestService, baseService);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={baseLayer}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useEffectContext<TestService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();

    if (result.current) {
      // Add a new service to the context
      const extendedService = {
        log: (msg: string) => `Logged: ${msg}`,
      };

      const extendedContext = Context.add(
        result.current,
        LoggerService,
        extendedService
      );

      // Verify original service still exists
      const maybeTest = Context.getOption(extendedContext, TestService);
      expect(maybeTest._tag).toBe('Some');

      // Verify new service was added
      const maybeLogger = Context.getOption(extendedContext, LoggerService);
      expect(maybeLogger._tag).toBe('Some');
      if (maybeLogger._tag === 'Some') {
        expect(maybeLogger.value.log('test')).toBe('Logged: test');
      }
    }
  });

  it('should return same context reference on re-renders', () => {
    const testServiceImpl = {
      getValue: () => 'test',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result, rerender } = renderHook(
      () => useEffectContext<TestService>(),
      { wrapper }
    );

    const firstContext = result.current;
    rerender();
    const secondContext = result.current;

    expect(firstContext).toBe(secondContext);
  });

  it('should handle type parameter correctly', () => {
    const testServiceImpl = {
      getValue: () => 'typed',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    // Test with explicit type parameter
    const { result } = renderHook(() => useEffectContext<TestService>(), {
      wrapper,
    });

    expect(result.current).not.toBeNull();

    // TypeScript should enforce the type
    const ctx: Context.Context<TestService> | null = result.current;
    expect(ctx).not.toBeNull();
  });
});
