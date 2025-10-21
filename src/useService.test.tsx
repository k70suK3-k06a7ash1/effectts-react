import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useService, EffectProvider } from './useService';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import React from 'react';

// Define test services
class TestService extends Context.Tag('TestService')<
  TestService,
  {
    readonly getValue: () => string;
  }
>() {}

class AnotherService extends Context.Tag('AnotherService')<
  AnotherService,
  {
    readonly getNumber: () => number;
  }
>() {}

describe('useService', () => {
  afterEach(() => {
    cleanup();
  });

  it('should return null when no provider exists', () => {
    const { result } = renderHook(() => useService(TestService));

    expect(result.current).toBeNull();
  });

  it('should return service when provided', () => {
    const testServiceImpl = {
      getValue: () => 'test value',
    };

    const TestServiceLive = Layer.succeed(TestService, testServiceImpl);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={TestServiceLive}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useService(TestService), { wrapper });

    expect(result.current).toBe(testServiceImpl);
    expect(result.current?.getValue()).toBe('test value');
  });

  it('should return different services independently', () => {
    const testServiceImpl = {
      getValue: () => 'test',
    };

    const anotherServiceImpl = {
      getNumber: () => 42,
    };

    const layer = Layer.mergeAll(
      Layer.succeed(TestService, testServiceImpl),
      Layer.succeed(AnotherService, anotherServiceImpl)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result: testResult } = renderHook(() => useService(TestService), {
      wrapper,
    });
    const { result: anotherResult } = renderHook(
      () => useService(AnotherService),
      { wrapper }
    );

    expect(testResult.current?.getValue()).toBe('test');
    expect(anotherResult.current?.getNumber()).toBe(42);
  });

  it('should work with nested providers', () => {
    const service1 = {
      getValue: () => 'outer',
    };

    const service2 = {
      getValue: () => 'inner',
    };

    const OuterLayer = Layer.succeed(TestService, service1);
    const InnerLayer = Layer.succeed(TestService, service2);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={OuterLayer}>
        <EffectProvider layer={InnerLayer}>{children}</EffectProvider>
      </EffectProvider>
    );

    const { result } = renderHook(() => useService(TestService), { wrapper });

    // Inner provider should override outer
    expect(result.current?.getValue()).toBe('inner');
  });

  it('should handle service that is not provided', () => {
    const providedService = {
      getValue: () => 'provided',
    };

    const layer = Layer.succeed(TestService, providedService);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={layer}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useService(AnotherService), { wrapper });

    expect(result.current).toBeNull();
  });

  it('should work with effectful service construction', () => {
    const serviceImpl = {
      getValue: () => 'effect service',
    };

    const TestServiceLive = Layer.effect(
      TestService,
      Effect.succeed(serviceImpl)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EffectProvider layer={TestServiceLive}>{children}</EffectProvider>
    );

    const { result } = renderHook(() => useService(TestService), { wrapper });

    expect(result.current?.getValue()).toBe('effect service');
  });
});
