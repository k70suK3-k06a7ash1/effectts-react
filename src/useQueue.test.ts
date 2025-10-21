import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useQueue } from './useQueue';

describe('useQueue', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create a queue', async () => {
    const { result } = renderHook(() => useQueue<string>());

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    expect(result.current.size).toBe(0);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isFull).toBe(false);
  });

  it('should offer a value to the queue', async () => {
    const { result } = renderHook(() => useQueue<string>(10));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    const offered = await result.current.offer('test value');

    expect(offered).toBe(true);

    await waitFor(() => {
      expect(result.current.size).toBe(1);
      expect(result.current.isEmpty).toBe(false);
    });
  });

  it('should take a value from the queue', async () => {
    const { result } = renderHook(() => useQueue<string>(10));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    await result.current.offer('first');
    await result.current.offer('second');

    const value1 = await result.current.take();
    expect(value1).toBe('first');

    const value2 = await result.current.take();
    expect(value2).toBe('second');
  });

  it('should respect capacity limits', async () => {
    const { result } = renderHook(() => useQueue<number>(2));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    await result.current.offer(1);
    await result.current.offer(2);

    await waitFor(() => {
      expect(result.current.size).toBe(2);
      expect(result.current.isFull).toBe(true);
    });
  });

  it('should track queue size', async () => {
    const { result } = renderHook(() => useQueue<string>(10));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    expect(result.current.size).toBe(0);

    await result.current.offer('item1');
    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });

    await result.current.offer('item2');
    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    await result.current.take();
    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });

    await result.current.take();
    await waitFor(() => {
      expect(result.current.size).toBe(0);
    });
  });

  it('should report isEmpty correctly', async () => {
    const { result } = renderHook(() => useQueue<string>(10));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    expect(result.current.isEmpty).toBe(true);

    await result.current.offer('test');
    await waitFor(() => {
      expect(result.current.isEmpty).toBe(false);
    });

    await result.current.take();
    await waitFor(() => {
      expect(result.current.isEmpty).toBe(true);
    });
  });

  it('should report isFull correctly', async () => {
    const { result } = renderHook(() => useQueue<number>(2));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    expect(result.current.isFull).toBe(false);

    await result.current.offer(1);
    await waitFor(() => {
      expect(result.current.isFull).toBe(false);
    });

    await result.current.offer(2);
    await waitFor(() => {
      expect(result.current.isFull).toBe(true);
    });

    await result.current.take();
    await waitFor(() => {
      expect(result.current.isFull).toBe(false);
    });
  });

  it('should handle calls before initialization', async () => {
    const { result } = renderHook(() => useQueue<string>());

    // Try to call offer before queue is initialized
    const offerResult = await result.current.offer('test');
    expect(offerResult).toBe(false);

    // Try to call take before queue is initialized
    await expect(result.current.take()).rejects.toThrow('Queue not initialized');
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useQueue<string>(10));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    await result.current.offer('test');

    unmount();

    // After unmount, queue should still exist but we shouldn't interact with it
    expect(result.current.queue).not.toBeNull();
  });

  it('should use default capacity of 100', async () => {
    const { result } = renderHook(() => useQueue<number>());

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
    });

    // Add items up to the expected default capacity
    for (let i = 0; i < 100; i++) {
      await result.current.offer(i);
    }

    await waitFor(() => {
      expect(result.current.size).toBe(100);
      expect(result.current.isFull).toBe(true);
    });
  });
});
