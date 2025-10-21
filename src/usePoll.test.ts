import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePoll } from './usePoll';
import * as Effect from 'effect/Effect';

describe('usePoll', () => {
  it('should start with loading state', () => {
    const effect = Effect.succeed(42);
    const { result } = renderHook(() => usePoll(effect, 1000));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should run effect immediately', async () => {
    const effect = Effect.succeed(42);
    const { result } = renderHook(() => usePoll(effect, 1000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(42);
    expect(result.current.error).toBe(null);
  });

  it('should poll at specified interval', async () => {
    let counter = 0;
    const effect = Effect.sync(() => ++counter);
    const { result } = renderHook(() => usePoll(effect, 100));

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    await waitFor(
      () => {
        expect(result.current.data).toBeGreaterThanOrEqual(2);
      },
      { timeout: 500 }
    );
  });

  it('should handle errors', async () => {
    const errorMessage = 'Test error';
    const effect = Effect.fail(errorMessage);
    const { result } = renderHook(() => usePoll(effect, 1000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should clear interval on unmount', async () => {
    let counter = 0;
    const effect = Effect.sync(() => ++counter);
    const { result, unmount } = renderHook(() => usePoll(effect, 100));

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    const currentCounter = counter;
    unmount();

    // Wait to ensure no more increments happen
    await new Promise(resolve => setTimeout(resolve, 300));

    // Counter should not have increased significantly after unmount
    expect(counter).toBeLessThanOrEqual(currentCounter + 1);
  });

  it('should restart polling when dependencies change', async () => {
    let counter = 0;
    const { result, rerender } = renderHook(
      ({ deps }) => usePoll(Effect.sync(() => ++counter), 1000, deps),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    // Change dependencies
    rerender({ deps: [2] });

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });
});
