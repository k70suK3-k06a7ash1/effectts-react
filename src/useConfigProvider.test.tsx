import { describe, it, expect } from 'vitest';
import { renderHook, render } from '@testing-library/react';
import { ConfigProvider, useConfigProvider } from './useConfigProvider';
import * as ConfigProviderEffect from 'effect/ConfigProvider';
import React, { ReactNode } from 'react';

describe('ConfigProvider', () => {
  it('should provide a config provider to children', () => {
    const provider = ConfigProviderEffect.fromMap(
      new Map([
        ['API_URL', 'https://api.example.com'],
        ['DEBUG', 'true'],
      ])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={provider}>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfigProvider(), { wrapper });

    expect(result.current).toBe(provider);
  });

  it('should return null when used outside ConfigProvider', () => {
    const { result } = renderHook(() => useConfigProvider());

    expect(result.current).toBe(null);
  });

  it('should support nested providers with innermost taking precedence', () => {
    const outerProvider = ConfigProviderEffect.fromMap(
      new Map([
        ['API_URL', 'https://outer.example.com'],
        ['OUTER_KEY', 'outer-value'],
      ])
    );

    const innerProvider = ConfigProviderEffect.fromMap(
      new Map([
        ['API_URL', 'https://inner.example.com'],
        ['INNER_KEY', 'inner-value'],
      ])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={outerProvider}>
        <ConfigProvider provider={innerProvider}>{children}</ConfigProvider>
      </ConfigProvider>
    );

    const { result } = renderHook(() => useConfigProvider(), { wrapper });

    // The innermost provider should be returned
    expect(result.current).toBe(innerProvider);
  });

  it('should update when provider prop changes', () => {
    const provider1 = ConfigProviderEffect.fromMap(
      new Map([['KEY', 'value1']])
    );

    const provider2 = ConfigProviderEffect.fromMap(
      new Map([['KEY', 'value2']])
    );

    let currentProvider = provider1;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={currentProvider}>{children}</ConfigProvider>
    );

    const { result, rerender } = renderHook(() => useConfigProvider(), {
      wrapper,
    });

    expect(result.current).toBe(provider1);

    currentProvider = provider2;
    rerender();

    expect(result.current).toBe(provider2);
  });

  it('should handle multiple children', () => {
    const provider = ConfigProviderEffect.fromMap(
      new Map([['SHARED_KEY', 'shared-value']])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={provider}>
        <div>
          <div>Child 1</div>
          <div>Child 2</div>
          {children}
        </div>
      </ConfigProvider>
    );

    const { result } = renderHook(() => useConfigProvider(), { wrapper });

    expect(result.current).toBe(provider);
  });

  it('should render fallback when provider is null and fallback is provided', () => {
    const { container } = render(
      <ConfigProvider provider={null as any} fallback={<div>Loading config...</div>}>
        <div>Children should not render</div>
      </ConfigProvider>
    );

    // Since we're passing null provider with fallback, the fallback should be rendered
    // and the children should not be rendered
    expect(container.textContent).toContain('Loading config...');
    expect(container.textContent).not.toContain('Children should not render');
  });

  it('should render children when provider is provided even if fallback exists', () => {
    const provider = ConfigProviderEffect.fromMap(
      new Map([['KEY', 'value']])
    );

    const { container } = render(
      <ConfigProvider provider={provider} fallback={<div>Loading config...</div>}>
        <div data-testid="child-content">Children content</div>
      </ConfigProvider>
    );

    // The fallback should not be rendered
    expect(container.textContent).not.toContain('Loading config...');
    expect(container.textContent).toContain('Children content');
  });

  it('should work with different provider types', () => {
    // Test with fromMap
    const mapProvider = ConfigProviderEffect.fromMap(
      new Map([['MAP_KEY', 'map-value']])
    );

    const wrapper1 = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={mapProvider}>{children}</ConfigProvider>
    );

    const { result: result1 } = renderHook(() => useConfigProvider(), { wrapper: wrapper1 });
    expect(result1.current).toBe(mapProvider);
  });

  it('should handle empty config map', () => {
    const emptyProvider = ConfigProviderEffect.fromMap(new Map());

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={emptyProvider}>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfigProvider(), { wrapper });

    expect(result.current).toBe(emptyProvider);
  });

  it('should maintain provider reference stability', () => {
    const provider = ConfigProviderEffect.fromMap(
      new Map([['KEY', 'value']])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={provider}>{children}</ConfigProvider>
    );

    const { result, rerender } = renderHook(() => useConfigProvider(), { wrapper });

    const firstProvider = result.current;

    // Re-render without changing props
    rerender();

    const secondProvider = result.current;

    // The provider reference should be stable
    expect(firstProvider).toBe(secondProvider);
    expect(firstProvider).toBe(provider);
  });

  it('should work with orElse combined providers', () => {
    const primary = ConfigProviderEffect.fromMap(
      new Map([['PRIMARY_KEY', 'primary-value']])
    );

    const fallback = ConfigProviderEffect.fromMap(
      new Map([
        ['FALLBACK_KEY', 'fallback-value'],
        ['PRIMARY_KEY', 'should-not-be-used'],
      ])
    );

    const combined = ConfigProviderEffect.orElse(primary, () => fallback);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={combined}>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfigProvider(), { wrapper });

    expect(result.current).toBe(combined);
  });

  it('should allow unmounting without errors', () => {
    const provider = ConfigProviderEffect.fromMap(
      new Map([['KEY', 'value']])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConfigProvider provider={provider}>{children}</ConfigProvider>
    );

    const { unmount } = renderHook(() => useConfigProvider(), { wrapper });

    expect(() => unmount()).not.toThrow();
  });
});
