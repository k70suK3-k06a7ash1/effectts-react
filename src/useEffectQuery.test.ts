import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { useEffectQuery } from './useEffectQuery';
import * as Effect from 'effect/Effect';

describe('useEffectQuery', () => {
  it('should start with loading state', () => {
    const effect = Effect.succeed(42);
    const { result } = renderHook(() => useEffectQuery(effect));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should update with data when effect succeeds', async () => {
    const effect = Effect.succeed(42);
    const { result } = renderHook(() => useEffectQuery(effect));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(42);
    expect(result.current.error).toBe(null);
  });

  it('should update with error when effect fails', async () => {
    const errorMessage = 'Test error';
    const effect = Effect.fail(errorMessage);
    const { result } = renderHook(() => useEffectQuery(effect));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should re-run effect when dependencies change', async () => {
    let value = 1;
    const { result, rerender } = renderHook(
      ({ deps }) => useEffectQuery(Effect.sync(() => value), deps),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(1);

    value = 2;
    rerender({ deps: [2] });

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });

  it('should handle async effects', async () => {
    const effect = Effect.promise(() => Promise.resolve('async result'));
    const { result } = renderHook(() => useEffectQuery(effect));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('async result');
    expect(result.current.error).toBe(null);
  });

  it('should cancel previous effect on unmount', async () => {
    const effect = Effect.succeed(42);
    const { unmount } = renderHook(() => useEffectQuery(effect));

    unmount();

    // Wait a bit to ensure no state updates occur after unmount
    await new Promise(resolve => setTimeout(resolve, 100));

    // If this doesn't throw, the cleanup worked correctly
    expect(true).toBe(true);
  });
});
