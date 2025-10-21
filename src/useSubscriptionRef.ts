import { useEffect as useReactEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Stream from 'effect/Stream';

/**
 * React hook for Effect SubscriptionRef - reactive state with change notifications
 *
 * @param initialValue - The initial value for the SubscriptionRef
 * @returns Object containing the current value, methods, and the changes stream
 */
export function useSubscriptionRef<A>(initialValue: A): {
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
  const [ref, setRef] = useState<SubscriptionRef.SubscriptionRef<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(SubscriptionRef.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      // Subscribe to changes
      const changesStream = r.changes;
      const effect = Stream.runForEach(changesStream, (newValue) =>
        Effect.sync(() => {
          if (!cancelled) {
            setValue(newValue);
            setLoading(false);
          }
        })
      );

      Effect.runPromise(effect).catch((error) => {
        if (!cancelled) {
          console.error('SubscriptionRef stream error:', error);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const get = useCallback(async (): Promise<A> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    const result = await Effect.runPromise(SubscriptionRef.get(ref));
    return result;
  }, [ref]);

  const set = useCallback(async (newValue: A): Promise<void> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    await Effect.runPromise(SubscriptionRef.set(ref, newValue));
  }, [ref]);

  const update = useCallback(async (f: (a: A) => A): Promise<void> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    await Effect.runPromise(SubscriptionRef.update(ref, f));
  }, [ref]);

  const updateEffect = useCallback(async <E>(
    f: (a: A) => Effect.Effect<A, E, never>
  ): Promise<void> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    await Effect.runPromise(SubscriptionRef.updateEffect(ref, f));
  }, [ref]);

  const modify = useCallback(async <B>(f: (a: A) => readonly [B, A]): Promise<B> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    const result = await Effect.runPromise(SubscriptionRef.modify(ref, f));
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
