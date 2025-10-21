import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import {
  RuntimeProvider,
  useRuntimeContext,
  useOptionalRuntimeContext,
} from './useRuntimeContext';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import React from 'react';

// Define test services
class TestService extends Context.Tag('TestService')<
  TestService,
  {
    readonly getValue: () => string;
  }
>() {}

class DatabaseService extends Context.Tag('DatabaseService')<
  DatabaseService,
  {
    readonly query: (sql: string) => Effect.Effect<string[], Error>;
  }
>() {}

// Helper to create runtime from layer
async function createRuntimeFromLayer<R, E>(
  layer: Layer.Layer<R, E, never>
): Promise<ManagedRuntime.ManagedRuntime<R, E>> {
  const effect = ManagedRuntime.make(layer);
  return await Effect.runPromise(effect);
}

describe('RuntimeProvider and useRuntimeContext', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Basic functionality', () => {
    it('should throw error when used outside RuntimeProvider', () => {
      const { result } = renderHook(() => {
        try {
          return useRuntimeContext();
        } catch (e) {
          return e;
        }
      });

      expect(result.current).toBeInstanceOf(Error);
      if (result.current instanceof Error) {
        expect(result.current.message).toContain(
          'useRuntimeContext must be used within a RuntimeProvider'
        );
        expect(result.current.message).toContain(
          'Make sure your component is wrapped with <RuntimeProvider runtime={...}>'
        );
      }
    });

    it('should provide runtime to child components', async () => {
      const testServiceImpl = {
        getValue: () => 'test value',
      };

      const layer = Layer.succeed(TestService, testServiceImpl);
      const runtime = await createRuntimeFromLayer(layer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
      );

      const { result } = renderHook(() => useRuntimeContext(), { wrapper });

      expect(result.current).toBe(runtime);
    });

    it('should allow executing effects with the provided runtime', async () => {
      const testServiceImpl = {
        getValue: () => 'test value',
      };

      const layer = Layer.succeed(TestService, testServiceImpl);
      const runtime = await createRuntimeFromLayer(layer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
      );

      const { result } = renderHook(() => useRuntimeContext<TestService>(), {
        wrapper,
      });

      const effect = Effect.gen(function* () {
        const service = yield* Effect.service(TestService);
        return service.getValue();
      });

      const value = await result.current.runPromise(effect);

      expect(value).toBe('test value');
    });
  });

  describe('Error handling', () => {
    it('should throw error when runtime is null', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={null}>{children}</RuntimeProvider>
      );

      const { result } = renderHook(
        () => {
          try {
            return useRuntimeContext();
          } catch (e) {
            return e;
          }
        },
        { wrapper }
      );

      expect(result.current).toBeInstanceOf(Error);
      if (result.current instanceof Error) {
        expect(result.current.message).toContain(
          'useRuntimeContext must be used within a RuntimeProvider'
        );
      }
    });

    it('should provide clear error message for debugging', () => {
      const { result } = renderHook(() => {
        try {
          return useRuntimeContext();
        } catch (e) {
          return e;
        }
      });

      expect(result.current).toBeInstanceOf(Error);
      if (result.current instanceof Error) {
        const message = result.current.message;
        expect(message).toContain('useRuntimeContext');
        expect(message).toContain('RuntimeProvider');
        expect(message).toContain('runtime');
      }
    });
  });

  describe('Nested providers', () => {
    it('should use the nearest provider runtime', async () => {
      const outerServiceImpl = {
        getValue: () => 'outer',
      };

      const innerServiceImpl = {
        getValue: () => 'inner',
      };

      const outerLayer = Layer.succeed(TestService, outerServiceImpl);
      const innerLayer = Layer.succeed(TestService, innerServiceImpl);

      const outerRuntime = await createRuntimeFromLayer(outerLayer);
      const innerRuntime = await createRuntimeFromLayer(innerLayer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={outerRuntime}>
          <RuntimeProvider runtime={innerRuntime}>{children}</RuntimeProvider>
        </RuntimeProvider>
      );

      const { result } = renderHook(() => useRuntimeContext(), { wrapper });

      // Should get the inner runtime
      expect(result.current).toBe(innerRuntime);
    });

    it('should allow different runtimes at different levels', async () => {
      const outerServiceImpl = {
        getValue: () => 'outer value',
      };

      const innerServiceImpl = {
        getValue: () => 'inner value',
      };

      const outerLayer = Layer.succeed(TestService, outerServiceImpl);
      const innerLayer = Layer.succeed(TestService, innerServiceImpl);

      const outerRuntime = await createRuntimeFromLayer(outerLayer);
      const innerRuntime = await createRuntimeFromLayer(innerLayer);

      // Test outer level
      const outerWrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={outerRuntime}>{children}</RuntimeProvider>
      );

      const { result: outerResult } = renderHook(
        () => useRuntimeContext<TestService>(),
        { wrapper: outerWrapper }
      );

      const outerEffect = Effect.gen(function* () {
        const service = yield* Effect.service(TestService);
        return service.getValue();
      });

      const outerValue = await outerResult.current.runPromise(outerEffect);
      expect(outerValue).toBe('outer value');

      // Test inner level
      const innerWrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={outerRuntime}>
          <RuntimeProvider runtime={innerRuntime}>{children}</RuntimeProvider>
        </RuntimeProvider>
      );

      const { result: innerResult } = renderHook(
        () => useRuntimeContext<TestService>(),
        { wrapper: innerWrapper }
      );

      const innerEffect = Effect.gen(function* () {
        const service = yield* Effect.service(TestService);
        return service.getValue();
      });

      const innerValue = await innerResult.current.runPromise(innerEffect);
      expect(innerValue).toBe('inner value');
    });
  });

  describe('Runtime stability', () => {
    it('should return same runtime reference on re-renders', async () => {
      const testServiceImpl = {
        getValue: () => 'test',
      };

      const layer = Layer.succeed(TestService, testServiceImpl);
      const runtime = await createRuntimeFromLayer(layer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
      );

      const { result, rerender } = renderHook(() => useRuntimeContext(), {
        wrapper,
      });

      const firstRuntime = result.current;
      rerender();
      const secondRuntime = result.current;

      expect(firstRuntime).toBe(secondRuntime);
    });
  });

  describe('Type parameters', () => {
    it('should handle type parameter correctly', async () => {
      const testServiceImpl = {
        getValue: () => 'typed value',
      };

      const layer = Layer.succeed(TestService, testServiceImpl);
      const runtime = await createRuntimeFromLayer(layer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
      );

      const { result } = renderHook(() => useRuntimeContext<TestService>(), {
        wrapper,
      });

      // TypeScript should enforce the type
      const rt: ManagedRuntime.ManagedRuntime<TestService, never> =
        result.current;
      expect(rt).toBe(runtime);
    });

    it('should work with multiple services in type', async () => {
      const testServiceImpl = {
        getValue: () => 'test',
      };

      const dbServiceImpl = {
        query: (sql: string) => Effect.succeed([`Result: ${sql}`]),
      };

      const layer = Layer.mergeAll(
        Layer.succeed(TestService, testServiceImpl),
        Layer.succeed(DatabaseService, dbServiceImpl)
      );

      const runtime = await createRuntimeFromLayer(layer);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
      );

      const { result } = renderHook(
        () => useRuntimeContext<TestService | DatabaseService>(),
        { wrapper }
      );

      const effect = Effect.gen(function* () {
        const testService = yield* Effect.service(TestService);
        const dbService = yield* Effect.service(DatabaseService);

        const queryResult = yield* dbService.query('SELECT * FROM users');

        return {
          testValue: testService.getValue(),
          queryResult,
        };
      });

      const value = await result.current.runPromise(effect);

      expect(value.testValue).toBe('test');
      expect(value.queryResult).toEqual(['Result: SELECT * FROM users']);
    });
  });
});

describe('useOptionalRuntimeContext', () => {
  afterEach(() => {
    cleanup();
  });

  it('should return null when no provider exists', () => {
    const { result } = renderHook(() => useOptionalRuntimeContext());

    expect(result.current).toBeNull();
  });

  it('should return null when runtime is null', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={null}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(() => useOptionalRuntimeContext(), {
      wrapper,
    });

    expect(result.current).toBeNull();
  });

  it('should return runtime when provider exists', async () => {
    const testServiceImpl = {
      getValue: () => 'test',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);
    const runtime = await createRuntimeFromLayer(layer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(() => useOptionalRuntimeContext(), {
      wrapper,
    });

    expect(result.current).toBe(runtime);
  });

  it('should allow safe conditional usage', async () => {
    const testServiceImpl = {
      getValue: () => 'safe value',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);
    const runtime = await createRuntimeFromLayer(layer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result } = renderHook(
      () => useOptionalRuntimeContext<TestService>(),
      { wrapper }
    );

    if (result.current) {
      const effect = Effect.gen(function* () {
        const service = yield* Effect.service(TestService);
        return service.getValue();
      });

      const value = await result.current.runPromise(effect);
      expect(value).toBe('safe value');
    } else {
      // Should not reach here
      expect(true).toBe(false);
    }
  });

  it('should return same reference on re-renders', async () => {
    const testServiceImpl = {
      getValue: () => 'test',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);
    const runtime = await createRuntimeFromLayer(layer);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>
    );

    const { result, rerender } = renderHook(
      () => useOptionalRuntimeContext(),
      { wrapper }
    );

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });
});

describe('RuntimeProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render children', async () => {
    const testServiceImpl = {
      getValue: () => 'test',
    };

    const layer = Layer.succeed(TestService, testServiceImpl);
    const runtime = await createRuntimeFromLayer(layer);

    let rendered = false;

    const TestComponent = () => {
      rendered = true;
      return <div>Test</div>;
    };

    renderHook(
      () => {
        return null;
      },
      {
        wrapper: ({ children }) => (
          <RuntimeProvider runtime={runtime}>
            <TestComponent />
            {children}
          </RuntimeProvider>
        ),
      }
    );

    expect(rendered).toBe(true);
  });

  it('should handle runtime updates', async () => {
    const serviceImpl1 = {
      getValue: () => 'value1',
    };

    const serviceImpl2 = {
      getValue: () => 'value2',
    };

    const layer1 = Layer.succeed(TestService, serviceImpl1);
    const layer2 = Layer.succeed(TestService, serviceImpl2);

    const runtime1 = await createRuntimeFromLayer(layer1);
    const runtime2 = await createRuntimeFromLayer(layer2);

    const TestWrapper = ({ runtime }: { runtime: any }) => {
      return (
        <RuntimeProvider runtime={runtime}>
          <div>Test</div>
        </RuntimeProvider>
      );
    };

    const { rerender } = renderHook(
      ({ runtime }) => useOptionalRuntimeContext(),
      {
        wrapper: ({ children }) => (
          <RuntimeProvider runtime={runtime1}>{children}</RuntimeProvider>
        ),
        initialProps: { runtime: runtime1 },
      }
    );

    const { result } = renderHook(() => useOptionalRuntimeContext(), {
      wrapper: ({ children }) => (
        <RuntimeProvider runtime={runtime1}>{children}</RuntimeProvider>
      ),
    });

    const firstRuntime = result.current;
    expect(firstRuntime).toBe(runtime1);

    // Change to runtime2
    const { result: result2 } = renderHook(() => useOptionalRuntimeContext(), {
      wrapper: ({ children }) => (
        <RuntimeProvider runtime={runtime2}>{children}</RuntimeProvider>
      ),
    });

    expect(result2.current).toBe(runtime2);
    expect(result2.current).not.toBe(firstRuntime);
  });
});
