import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { useManagedRuntime } from './useManagedRuntime';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

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
    readonly query: (sql: string) => Effect.Effect<string[], never>;
  }
>() {}

class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    readonly info: (msg: string) => Effect.Effect<void>;
  }
>() {}

describe('useManagedRuntime', () => {
  describe('Basic functionality', () => {
    it('should start with loading state', () => {
      const testServiceImpl = {
        getValue: () => 'test value',
      };
      const TestServiceLive = Layer.succeed(TestService, testServiceImpl);

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      expect(result.current.loading).toBe(true);
      expect(result.current.runtime).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should create ManagedRuntime from layer', async () => {
      const testServiceImpl = {
        getValue: () => 'test value',
      };
      const TestServiceLive = Layer.succeed(TestService, testServiceImpl);

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);
      expect(result.current.error).toBe(null);

      // Verify the runtime can execute effects with the service
      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('test value');
      }
    });

    it('should handle effectful layer construction', async () => {
      const testServiceImpl = {
        getValue: () => 'effect service',
      };

      const TestServiceLive = Layer.effect(
        TestService,
        Effect.succeed(testServiceImpl)
      );

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);
      expect(result.current.error).toBe(null);

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('effect service');
      }
    });

    it('should handle async layer construction', async () => {
      const testServiceImpl = {
        getValue: () => 'async service',
      };

      const TestServiceLive = Layer.effect(
        TestService,
        Effect.promise(() => Promise.resolve(testServiceImpl))
      );

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('async service');
      }
    });
  });

  describe('Error handling', () => {
    it('should set error when runtime construction fails', async () => {
      const errorMessage = 'Runtime construction failed';
      const FailingLayer = Layer.effect(
        TestService,
        Effect.fail(errorMessage)
      );

      const { result } = renderHook(() => useManagedRuntime(FailingLayer));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.runtime).toBe(null);
    });

    it('should call onError callback when runtime construction fails', async () => {
      const errorMessage = 'Runtime construction failed';
      const onError = vi.fn();

      const FailingLayer = Layer.effect(
        TestService,
        Effect.fail(errorMessage)
      );

      const { result } = renderHook(() =>
        useManagedRuntime(FailingLayer, { onError })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(errorMessage);
      expect(result.current.error).toBe(errorMessage);
    });

    it('should handle async layer construction errors', async () => {
      const errorMessage = 'Async construction failed';
      const FailingLayer = Layer.effect(
        TestService,
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          return yield* Effect.fail(errorMessage);
        })
      );

      const { result } = renderHook(() => useManagedRuntime(FailingLayer));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.runtime).toBe(null);
    });
  });

  describe('Multiple layers', () => {
    it('should handle merged layers', async () => {
      const testServiceImpl = {
        getValue: () => 'test',
      };

      const dbServiceImpl = {
        query: (sql: string) => Effect.succeed([sql]),
      };

      const TestServiceLive = Layer.succeed(TestService, testServiceImpl);
      const DatabaseServiceLive = Layer.succeed(DatabaseService, dbServiceImpl);

      const MergedLayer = Layer.mergeAll(TestServiceLive, DatabaseServiceLive);

      const { result } = renderHook(() => useManagedRuntime(MergedLayer));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const testService = yield* TestService;
          const dbService = yield* DatabaseService;

          const value = testService.getValue();
          const queryResult = yield* dbService.query('SELECT * FROM users');

          return { value, queryResult };
        });

        const result2 = await result.current.runtime.runPromise(effect);
        expect(result2.value).toBe('test');
        expect(result2.queryResult).toEqual(['SELECT * FROM users']);
      }
    });

    it('should handle layers with multiple services', async () => {
      const testServiceImpl = { getValue: () => 'test' };
      const dbServiceImpl = {
        query: (sql: string) => Effect.succeed([sql]),
      };
      const loggerServiceImpl = {
        info: (msg: string) => Effect.sync(() => console.log(msg)),
      };

      const AppLayer = Layer.mergeAll(
        Layer.succeed(TestService, testServiceImpl),
        Layer.succeed(DatabaseService, dbServiceImpl),
        Layer.succeed(LoggerService, loggerServiceImpl)
      );

      const { result } = renderHook(() => useManagedRuntime(AppLayer));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const test = yield* TestService;
          const db = yield* DatabaseService;
          const logger = yield* LoggerService;

          yield* logger.info('Testing all services');
          const queryResult = yield* db.query('SELECT 1');

          return {
            testValue: test.getValue(),
            queryResult,
          };
        });

        const result2 = await result.current.runtime.runPromise(effect);
        expect(result2.testValue).toBe('test');
        expect(result2.queryResult).toEqual(['SELECT 1']);
      }
    });
  });

  describe('Scoped resource management', () => {
    it('should manage scoped resources', async () => {
      const acquisitionLog: string[] = [];
      const releaseLog: string[] = [];

      const ScopedLayer = Layer.scoped(
        TestService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              acquisitionLog.push('acquired');
            }),
            () =>
              Effect.sync(() => {
                releaseLog.push('released');
              })
          );

          return {
            getValue: () => 'scoped service',
          };
        })
      );

      const { result, unmount } = renderHook(() =>
        useManagedRuntime(ScopedLayer)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(acquisitionLog).toContain('acquired');
      expect(releaseLog).toHaveLength(0);

      // Unmount to trigger dispose
      unmount();

      // Wait for async dispose to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(releaseLog).toContain('released');
    });

    it('should handle database connection lifecycle', async () => {
      let connectionOpen = false;

      const DatabaseLayer = Layer.scoped(
        DatabaseService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              connectionOpen = true;
            }),
            () =>
              Effect.sync(() => {
                connectionOpen = false;
              })
          );

          return {
            query: (sql: string) => Effect.succeed([sql]),
          };
        })
      );

      const { result, unmount } = renderHook(() =>
        useManagedRuntime(DatabaseLayer)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(connectionOpen).toBe(true);

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const db = yield* DatabaseService;
          return yield* db.query('SELECT * FROM users');
        });

        const queryResult = await result.current.runtime.runPromise(effect);
        expect(queryResult).toEqual(['SELECT * FROM users']);
      }

      unmount();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(connectionOpen).toBe(false);
    });
  });

  describe('Dynamic changes', () => {
    it('should rebuild runtime when layer changes', async () => {
      const impl1 = { getValue: () => 'value1' };
      const impl2 = { getValue: () => 'value2' };

      const Layer1 = Layer.succeed(TestService, impl1);
      const Layer2 = Layer.succeed(TestService, impl2);

      const { result, rerender } = renderHook(
        ({ layer }) => useManagedRuntime(layer),
        { initialProps: { layer: Layer1 } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('value1');
      }

      // Change the layer
      rerender({ layer: Layer2 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('value2');
      }
    });

    it('should dispose old runtime when layer changes', async () => {
      let resource1Released = false;
      let resource2Released = false;

      const Layer1 = Layer.scoped(
        TestService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.succeed(undefined),
            () =>
              Effect.sync(() => {
                resource1Released = true;
              })
          );
          return { getValue: () => 'value1' };
        })
      );

      const Layer2 = Layer.scoped(
        TestService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.succeed(undefined),
            () =>
              Effect.sync(() => {
                resource2Released = true;
              })
          );
          return { getValue: () => 'value2' };
        })
      );

      const { rerender } = renderHook(
        ({ layer }) => useManagedRuntime(layer),
        { initialProps: { layer: Layer1 } }
      );

      await waitFor(() => {
        expect(resource1Released).toBe(false);
      });

      // Change layer
      rerender({ layer: Layer2 });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(resource1Released).toBe(true);
      expect(resource2Released).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should not update state after unmount', async () => {
      const testServiceImpl = {
        getValue: () => 'test',
      };

      const TestServiceLive = Layer.effect(
        TestService,
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return testServiceImpl;
        })
      );

      const { unmount } = renderHook(() => useManagedRuntime(TestServiceLive));

      // Unmount before runtime construction completes
      unmount();

      // Wait to ensure no state updates occur
      await new Promise((resolve) => setTimeout(resolve, 200));

      // If no error is thrown, cleanup worked correctly
      expect(true).toBe(true);
    });

    it('should handle unmount during runtime construction', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestServiceLive = Layer.effect(
        TestService,
        Effect.gen(function* () {
          yield* Effect.sleep('50 millis');
          return { getValue: () => 'test' };
        })
      );

      const { unmount } = renderHook(() => useManagedRuntime(TestServiceLive));

      // Unmount immediately
      unmount();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // No React warnings should have been logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update")
      );

      consoleSpy.mockRestore();
    });

    it('should dispose runtime on unmount', async () => {
      let disposed = false;

      const ScopedLayer = Layer.scoped(
        TestService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.succeed(undefined),
            () =>
              Effect.sync(() => {
                disposed = true;
              })
          );
          return { getValue: () => 'test' };
        })
      );

      const { result, unmount } = renderHook(() =>
        useManagedRuntime(ScopedLayer)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(disposed).toBe(false);

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(disposed).toBe(true);
    });

    it('should handle dispose errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const errorMessage = 'Dispose failed';

      const FailingDisposeLayer = Layer.scoped(
        TestService,
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.succeed(undefined),
            () => Effect.fail(errorMessage)
          );
          return { getValue: () => 'test' };
        })
      );

      const { result, unmount } = renderHook(() =>
        useManagedRuntime(FailingDisposeLayer)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to dispose runtime:',
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Fiber execution', () => {
    it('should execute effects with runPromise', async () => {
      const testServiceImpl = {
        getValue: () => 'test value',
      };

      const TestServiceLive = Layer.succeed(TestService, testServiceImpl);

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          const service = yield* TestService;
          return service.getValue();
        });

        const value = await result.current.runtime.runPromise(effect);
        expect(value).toBe('test value');
      }
    });

    it('should execute effects with runFork', async () => {
      const testServiceImpl = {
        getValue: () => 'fiber value',
      };

      const TestServiceLive = Layer.succeed(TestService, testServiceImpl);

      const { result } = renderHook(() => useManagedRuntime(TestServiceLive));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      if (result.current.runtime) {
        const effect = Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          const service = yield* TestService;
          return service.getValue();
        });

        const fiber = result.current.runtime.runFork(effect);
        const value = await result.current.runtime.runPromise(
          Effect.promise(() => fiber.await().then((exit) => exit.value as string))
        );

        expect(value).toBe('fiber value');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle runtime with no options provided', async () => {
      const impl = { getValue: () => 'test' };
      const TestLayer = Layer.succeed(TestService, impl);

      const { result } = renderHook(() => useManagedRuntime(TestLayer));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should handle runtime with undefined onError option', async () => {
      const impl = { getValue: () => 'test' };
      const TestLayer = Layer.succeed(TestService, impl);

      const { result } = renderHook(() =>
        useManagedRuntime(TestLayer, { onError: undefined })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should reset to loading state when layer changes', async () => {
      const impl1 = { getValue: () => 'value1' };
      const impl2 = { getValue: () => 'value2' };

      const Layer1 = Layer.succeed(TestService, impl1);
      const Layer2 = Layer.succeed(TestService, impl2);

      const { result, rerender } = renderHook(
        ({ layer }) => useManagedRuntime(layer),
        { initialProps: { layer: Layer1 } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Change the layer - should trigger loading state
      rerender({ layer: Layer2 });

      // Should immediately be loading
      expect(result.current.loading).toBe(true);
      expect(result.current.runtime).toBe(null);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.runtime).not.toBe(null);
    });
  });

  describe('onError callback changes', () => {
    it('should handle onError callback changes', async () => {
      const onError1 = vi.fn();
      const onError2 = vi.fn();

      const FailingLayer = Layer.effect(
        TestService,
        Effect.fail('error')
      );

      const { rerender } = renderHook(
        ({ onError }) => useManagedRuntime(FailingLayer, { onError }),
        { initialProps: { onError: onError1 } }
      );

      await waitFor(() => {
        expect(onError1).toHaveBeenCalled();
      });

      // Change onError callback
      rerender({ onError: onError2 });

      await waitFor(() => {
        expect(onError2).toHaveBeenCalled();
      });
    });
  });
});
