import { useEffect as useReactEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as SynchronizedRef from 'effect/SynchronizedRef';

/**
 * React hook for Effect SynchronizedRef - atomic, effectful state updates
 *
 * @param initialValue - The initial value for the SynchronizedRef
 * @returns Object containing the current value and methods to interact with the SynchronizedRef
 */
export function useSynchronizedRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  updateEffect: <E>(f: (a: A) => Effect.Effect<A, E, never>) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<SynchronizedRef.SynchronizedRef<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(SynchronizedRef.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      Effect.runPromise(SynchronizedRef.get(r)).then((v) => {
        if (cancelled) return;
        setValue(v);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const get = useCallback(async (): Promise<A> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    const result = await Effect.runPromise(SynchronizedRef.get(ref));
    setValue(result);
    return result;
  }, [ref]);

  const set = useCallback(async (newValue: A): Promise<void> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    await Effect.runPromise(SynchronizedRef.set(ref, newValue));
    setValue(newValue);
  }, [ref]);

  const update = useCallback(async (f: (a: A) => A): Promise<void> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    await Effect.runPromise(SynchronizedRef.update(ref, f));
    const newValue = await Effect.runPromise(SynchronizedRef.get(ref));
    setValue(newValue);
  }, [ref]);

  const updateEffect = useCallback(async <E>(
    f: (a: A) => Effect.Effect<A, E, never>
  ): Promise<void> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    await Effect.runPromise(SynchronizedRef.updateEffect(ref, f));
    const newValue = await Effect.runPromise(SynchronizedRef.get(ref));
    setValue(newValue);
  }, [ref]);

  const modify = useCallback(async <B>(f: (a: A) => readonly [B, A]): Promise<B> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    const result = await Effect.runPromise(SynchronizedRef.modify(ref, f));
    const newValue = await Effect.runPromise(SynchronizedRef.get(ref));
    setValue(newValue);
    return result;
  }, [ref]);

  return {
    value,
    loading,
    get,
    set,
    update,
    updateEffect,
    modify,
  };
}
