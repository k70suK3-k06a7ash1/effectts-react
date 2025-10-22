import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { RuntimeProvider, useRuntimeContext } from './useRuntimeContext';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import React from 'react';

// Test service
class TestService extends Context.Tag('TestService')<
  TestService,
  {
    readonly testValue: string;
  }
>() {}

describe('RuntimeProvider and useRuntimeContext', () => {
  afterEach(() => {
    cleanup();
  });

  it('should throw error when used outside of RuntimeProvider', () => {
    expect(() => {
      renderHook(() => useRuntimeContext());
    }).toThrow('useRuntimeContext must be used within RuntimeProvider');
  });

  it('should provide runtime to children', () => {
    const testLayer = Layer.succeed(TestService, {
      testValue: 'test',
    });

    const runtime = ManagedRuntime.make(testLayer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(() => useRuntimeContext(), { wrapper });

    expect(result.current).toBe(runtime);
  });

  it('should allow executing effects with provided runtime', async () => {
    const testLayer = Layer.succeed(TestService, {
      testValue: 'hello from runtime',
    });

    const runtime = ManagedRuntime.make(testLayer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(() => useRuntimeContext(), { wrapper });

    const effect = Effect.gen(function* () {
      const service = yield* TestService;
      return service.testValue;
    });

    const value = await result.current.runPromise(effect);
    expect(value).toBe('hello from runtime');
  });

  it('should support nested providers', async () => {
    // Outer layer
    const outerLayer = Layer.succeed(TestService, {
      testValue: 'outer',
    });
    const outerRuntime = ManagedRuntime.make(outerLayer);

    // Inner layer
    const innerLayer = Layer.succeed(TestService, {
      testValue: 'inner',
    });
    const innerRuntime = ManagedRuntime.make(innerLayer);

    const outerWrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={outerRuntime}>{children}</RuntimeProvider>
    );

    // Test outer context
    const { result: outerResult } = renderHook(() => useRuntimeContext(), {
      wrapper: outerWrapper,
    });

    const outerEffect = Effect.gen(function* () {
      const service = yield* TestService;
      return service.testValue;
    });

    const outerValue = await outerResult.current.runPromise(outerEffect);
    expect(outerValue).toBe('outer');

    // Test nested context - innermost should take precedence
    const { result: innerResult } = renderHook(() => useRuntimeContext(), {
      wrapper: ({ children }) => (
        <RuntimeProvider runtime={outerRuntime}>
          <RuntimeProvider runtime={innerRuntime}>{children}</RuntimeProvider>
        </RuntimeProvider>
      ),
    });

    const innerEffect = Effect.gen(function* () {
      const service = yield* TestService;
      return service.testValue;
    });

    const innerValue = await innerResult.current.runPromise(innerEffect);
    expect(innerValue).toBe('inner');
  });

  it('should handle null runtime', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={null}>{children}</RuntimeProvider>
    );

    expect(() => {
      renderHook(() => useRuntimeContext(), { wrapper });
    }).toThrow('Runtime is not available');
  });

  it('should work with multiple services', async () => {
    class DatabaseService extends Context.Tag('DatabaseService')<
      DatabaseService,
      {
        readonly query: (sql: string) => Effect.Effect<string[]>;
      }
    >() {}

    const testLayer = Layer.merge(
      Layer.succeed(TestService, {
        testValue: 'test',
      }),
      Layer.succeed(DatabaseService, {
        query: (sql) => Effect.succeed([`Result for: ${sql}`]),
      })
    );

    const runtime = ManagedRuntime.make(testLayer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(() => useRuntimeContext(), { wrapper });

    const effect = Effect.gen(function* () {
      const testService = yield* TestService;
      const dbService = yield* DatabaseService;

      const testResult = testService.testValue;
      const queryResult = yield* dbService.query('SELECT * FROM users');

      return { testResult, queryResult };
    });

    const value = await result.current.runPromise(effect);
    expect(value.testResult).toBe('test');
    expect(value.queryResult).toEqual(['Result for: SELECT * FROM users']);
  });
});
