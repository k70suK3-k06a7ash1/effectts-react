import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEffectRef } from './useEffectRef';

describe('useEffectRef', () => {
  it('should initialize with the initial value', async () => {
    const { result } = renderHook(() => useEffectRef(42));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe(42);
  });

  it('should get the current value', async () => {
    const { result } = renderHook(() => useEffectRef(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const value = await result.current.get();
    expect(value).toBe(10);
  });

  it('should set a new value', async () => {
    const { result } = renderHook(() => useEffectRef(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.set(100);

    await waitFor(() => {
      expect(result.current.value).toBe(100);
    });
  });

  it('should update the value with a function', async () => {
    const { result } = renderHook(() => useEffectRef(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.update((n) => n * 2);

    await waitFor(() => {
      expect(result.current.value).toBe(10);
    });
  });

  it('should modify and return a computed value', async () => {
    const { result } = renderHook(() => useEffectRef(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const doubled = await result.current.modify((n) => [n * 2, n + 5]);

    expect(doubled).toBe(20);

    await waitFor(() => {
      expect(result.current.value).toBe(15);
    });
  });

  it('should handle string values', async () => {
    const { result } = renderHook(() => useEffectRef('hello'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe('hello');

    await result.current.set('world');

    await waitFor(() => {
      expect(result.current.value).toBe('world');
    });
  });

  it('should handle object values', async () => {
    const { result } = renderHook(() => useEffectRef({ count: 0 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.update((obj) => ({ count: obj.count + 1 }));

    await waitFor(() => {
      expect(result.current.value).toEqual({ count: 1 });
    });
  });
});
