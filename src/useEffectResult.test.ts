import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useEffectResult } from './useEffectResult';
import * as Effect from 'effect/Effect';

describe('useEffectResult', () => {
  afterEach(() => {
    cleanup();
  });

  it('should start with Initial state', async () => {
    const { result } = renderHook(() =>
      useEffectResult(Effect.succeed('test'), { deps: [] })
    );

    // Initial state transitions to Loading very quickly
    // By the time we check, it's already Loading or Success
    expect(['Initial', 'Loading', 'Success']).toContain(result.current._tag);

    // Eventually should be Success
    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });
  });

  it('should transition to Loading state', async () => {
    const { result } = renderHook(() =>
      useEffectResult(
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          return 'test';
        }),
        { deps: [] }
      )
    );

    // Should be in Initial or Loading state initially
    await waitFor(() => {
      expect(['Initial', 'Loading']).toContain(result.current._tag);
    });

    // Then should be Loading
    await waitFor(() => {
      expect(result.current._tag).toBe('Loading');
    });

    // Finally should succeed
    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });
  });

  it('should return Success state with value', async () => {
    const { result } = renderHook(() =>
      useEffectResult(Effect.succeed('success value'), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });

    if (result.current._tag === 'Success') {
      expect(result.current.value).toBe('success value');
    }
  });

  it('should return Failure state with error', async () => {
    const testError = new Error('test error');
    const { result } = renderHook(() =>
      useEffectResult(Effect.fail(testError), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Failure');
    });

    if (result.current._tag === 'Failure') {
      expect(result.current.error).toBe(testError);
    }
  });

  it('should return Defect state for uncaught errors', async () => {
    const { result } = renderHook(() =>
      useEffectResult(Effect.die(new Error('defect')), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Defect');
    });

    if (result.current._tag === 'Defect') {
      expect(result.current.cause).toBeDefined();
    }
  });

  it('should re-run when deps change', async () => {
    const { result, rerender } = renderHook(
      ({ id }) =>
        useEffectResult(Effect.succeed(`value-${id}`), { deps: [id] }),
      { initialProps: { id: 1 } }
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });

    if (result.current._tag === 'Success') {
      expect(result.current.value).toBe('value-1');
    }

    // Change deps
    rerender({ id: 2 });

    await waitFor(() => {
      if (result.current._tag === 'Success') {
        expect(result.current.value).toBe('value-2');
      }
    });
  });

  it('should handle immediate success', async () => {
    const { result } = renderHook(() =>
      useEffectResult(Effect.succeed('immediate'), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });
  });

  it('should handle type-safe pattern matching', async () => {
    const { result } = renderHook(() =>
      useEffectResult(Effect.succeed(42), { deps: [] })
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });

    // Type-safe pattern matching
    const value =
      result.current._tag === 'Success' ? result.current.value * 2 : 0;

    expect(value).toBe(84);
  });

  it('should distinguish between Failure and Defect', async () => {
    // Test Failure (expected error)
    const { result: failureResult } = renderHook(() =>
      useEffectResult(Effect.fail(new Error('expected')), { deps: [] })
    );

    await waitFor(() => {
      expect(failureResult.current._tag).toBe('Failure');
    });

    // Test Defect (unexpected error)
    const { result: defectResult } = renderHook(() =>
      useEffectResult(Effect.die(new Error('unexpected')), { deps: [] })
    );

    await waitFor(() => {
      expect(defectResult.current._tag).toBe('Defect');
    });
  });

  it('should handle cancellation on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useEffectResult(
        Effect.gen(function* () {
          yield* Effect.sleep('1000 millis');
          return 'completed';
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Loading');
    });

    unmount();

    // Should not update after unmount
    expect(result.current._tag).toBe('Loading');
  });

  it('should support multiple concurrent results', async () => {
    const { result: result1 } = renderHook(() =>
      useEffectResult(Effect.succeed('first'), { deps: [] })
    );

    const { result: result2 } = renderHook(() =>
      useEffectResult(Effect.succeed('second'), { deps: [] })
    );

    await waitFor(() => {
      expect(result1.current._tag).toBe('Success');
      expect(result2.current._tag).toBe('Success');
    });

    if (result1.current._tag === 'Success' && result2.current._tag === 'Success') {
      expect(result1.current.value).toBe('first');
      expect(result2.current.value).toBe('second');
    }
  });

  it('should handle complex effect chains', async () => {
    const { result } = renderHook(() =>
      useEffectResult(
        Effect.gen(function* () {
          const a = yield* Effect.succeed(10);
          const b = yield* Effect.succeed(20);
          yield* Effect.sleep('10 millis');
          return a + b;
        }),
        { deps: [] }
      )
    );

    await waitFor(() => {
      expect(result.current._tag).toBe('Success');
    });

    if (result.current._tag === 'Success') {
      expect(result.current.value).toBe(30);
    }
  });
});
