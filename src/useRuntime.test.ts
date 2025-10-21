import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRuntime } from './useRuntime';

describe('useRuntime', () => {
  it('should return a runtime instance', () => {
    const { result } = renderHook(() => useRuntime());

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });

  it('should return the same runtime on re-renders', () => {
    const { result, rerender } = renderHook(() => useRuntime());

    const firstRuntime = result.current;
    rerender();
    const secondRuntime = result.current;

    expect(firstRuntime).toBe(secondRuntime);
  });

  it('should handle context parameter', () => {
    const { result } = renderHook(() => useRuntime(undefined));

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });
});
