import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDeferred } from './useDeferred';

describe('useDeferred', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create a deferred', async () => {
    const { result } = renderHook(() => useDeferred<string>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    expect(result.current.isDone).toBe(false);
  });

  it('should succeed with a value', async () => {
    const { result } = renderHook(() => useDeferred<string>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    const successPromise = result.current.succeed('test value');
    const awaitPromise = result.current.await();

    const [successResult, awaitResult] = await Promise.all([
      successPromise,
      awaitPromise,
    ]);

    expect(successResult).toBe(true);
    expect(awaitResult).toBe('test value');

    await waitFor(() => {
      expect(result.current.isDone).toBe(true);
    });
  });

  it('should fail with an error', async () => {
    const { result } = renderHook(() => useDeferred<string, Error>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    const error = new Error('test error');

    // Fail the deferred first, then await it
    const failResult = await result.current.fail(error);
    expect(failResult).toBe(true);

    await waitFor(() => {
      expect(result.current.isDone).toBe(true);
    });

    // Now await should immediately reject with the error
    await expect(result.current.await()).rejects.toThrow('test error');
  });

  it('should await resolution', async () => {
    const { result } = renderHook(() => useDeferred<number>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    // Start awaiting in the background
    const awaitPromise = result.current.await();

    // Resolve after a small delay to ensure await is waiting
    // eslint-disable-next-line no-undef
    await new Promise((resolve) => setTimeout(resolve, 10));
    await result.current.succeed(42);

    const value = await awaitPromise;
    expect(value).toBe(42);
  });

  it('should track done state', async () => {
    const { result } = renderHook(() => useDeferred<boolean>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    expect(result.current.isDone).toBe(false);

    await result.current.succeed(true);

    await waitFor(() => {
      expect(result.current.isDone).toBe(true);
    });
  });

  it('should handle calls before initialization', async () => {
    const { result } = renderHook(() => useDeferred<string, Error>());

    // Try to call succeed before deferred is initialized
    const successResult = await result.current.succeed('test');
    expect(successResult).toBe(false);

    // Try to call fail before deferred is initialized
    const failResult = await result.current.fail(new Error('test'));
    expect(failResult).toBe(false);

    // Try to call await before deferred is initialized
    await expect(result.current.await()).rejects.toThrow(
      'Deferred not initialized'
    );
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useDeferred<string>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    unmount();

    // After unmount, the deferred should still exist but we shouldn't be able to interact with it
    // This is mainly to ensure no memory leaks or pending operations
    expect(result.current.deferred).not.toBeNull();
  });

  it('should handle multiple awaits on the same deferred', async () => {
    const { result } = renderHook(() => useDeferred<string>());

    await waitFor(() => {
      expect(result.current.deferred).not.toBeNull();
    });

    const await1 = result.current.await();
    const await2 = result.current.await();

    await result.current.succeed('shared value');

    const [value1, value2] = await Promise.all([await1, await2]);

    expect(value1).toBe('shared value');
    expect(value2).toBe('shared value');
  });
});
