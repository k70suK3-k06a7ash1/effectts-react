import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useManagedRuntime } from './useManagedRuntime';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';

// Test service
class TestService extends Context.Tag('TestService')<
  TestService,
  {
    readonly getValue: () => Effect.Effect<string>;
  }
>() {}

describe('useManagedRuntime', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with loading state', () => {
    const testLayer = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('test value'),
    });

    const { result } = renderHook(() => useManagedRuntime(testLayer));

    expect(result.current.runtime).toBe(null);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should create ManagedRuntime from layer', async () => {
    const testLayer = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('test value'),
    });

    const { result } = renderHook(() => useManagedRuntime(testLayer));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.runtime).not.toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should execute effect using the runtime', async () => {
    const testLayer = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('test value'),
    });

    const { result } = renderHook(() => useManagedRuntime(testLayer));

    await waitFor(() => {
      expect(result.current.runtime).not.toBe(null);
    });

    const runtime = result.current.runtime!;

    const effect = Effect.gen(function* () {
      const service = yield* TestService;
      return yield* service.getValue();
    });

    const value = await runtime.runPromise(effect);
    expect(value).toBe('test value');
  });

  it('should handle layer construction errors', async () => {
    const testError = new Error('Layer construction failed');
    const failingLayer = Layer.effectDiscard(Effect.fail(testError));

    const onError = vi.fn();

    const { result } = renderHook(() =>
      useManagedRuntime(failingLayer, { onError })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.runtime).toBe(null);
    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it('should call onError callback on error', async () => {
    const testError = new Error('Layer failed');
    const failingLayer = Layer.effectDiscard(Effect.fail(testError));
    const onError = vi.fn();

    renderHook(() => useManagedRuntime(failingLayer, { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should dispose runtime on unmount', async () => {
    const testLayer = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('test value'),
    });

    const { result, unmount } = renderHook(() =>
      useManagedRuntime(testLayer)
    );

    await waitFor(() => {
      expect(result.current.runtime).not.toBe(null);
    });

    const runtime = result.current.runtime!;
    const disposeSpy = vi.spyOn(runtime, 'dispose');

    unmount();

    await waitFor(() => {
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  it('should recreate runtime when layer changes', async () => {
    const layer1 = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('value 1'),
    });

    const layer2 = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('value 2'),
    });

    const { result, rerender } = renderHook(
      ({ layer }) => useManagedRuntime(layer),
      {
        initialProps: { layer: layer1 },
      }
    );

    await waitFor(() => {
      expect(result.current.runtime).not.toBe(null);
    });

    const firstRuntime = result.current.runtime;

    // Change layer
    rerender({ layer: layer2 });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Runtime should be different
    expect(result.current.runtime).not.toBe(null);
    expect(result.current.runtime).not.toBe(firstRuntime);

    // Verify new runtime has new service
    const effect = Effect.gen(function* () {
      const service = yield* TestService;
      return yield* service.getValue();
    });

    const value = await result.current.runtime!.runPromise(effect);
    expect(value).toBe('value 2');
  });

  it('should handle scoped resources', async () => {
    let acquired = false;
    let released = false;

    const scopedLayer = Layer.scoped(
      TestService,
      Effect.acquireRelease(
        Effect.sync(() => {
          acquired = true;
          return {
            getValue: () => Effect.succeed('scoped value'),
          };
        }),
        () =>
          Effect.sync(() => {
            released = true;
          })
      )
    );

    const { result, unmount } = renderHook(() =>
      useManagedRuntime(scopedLayer)
    );

    await waitFor(() => {
      expect(result.current.runtime).not.toBe(null);
    });

    expect(acquired).toBe(true);
    expect(released).toBe(false);

    unmount();

    await waitFor(() => {
      expect(released).toBe(true);
    });
  });

  it('should execute runFork method', async () => {
    const testLayer = Layer.succeed(TestService, {
      getValue: () => Effect.succeed('fork test'),
    });

    const { result } = renderHook(() => useManagedRuntime(testLayer));

    await waitFor(() => {
      expect(result.current.runtime).not.toBe(null);
    });

    const runtime = result.current.runtime!;

    const effect = Effect.gen(function* () {
      const service = yield* TestService;
      return yield* service.getValue();
    });

    const fiber = runtime.runFork(effect);

    // Fiber has been created and is running
    expect(fiber).toBeDefined();
    expect(typeof fiber.id).toBe('function');
  });
});
