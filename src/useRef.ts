import { useEffect as useReactEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';

/**
 * React hook for Effect Ref - a mutable reference for safe state management
 *
 * @param initialValue - The initial value for the Ref
 * @returns Object containing the current value and methods to interact with the Ref
 */
export function useRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<Ref.Ref<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(Ref.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      Effect.runPromise(Ref.get(r)).then((v) => {
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
    if (!ref) throw new Error('Ref not initialized');
    const result = await Effect.runPromise(Ref.get(ref));
    setValue(result);
    return result;
  }, [ref]);

  const set = useCallback(async (newValue: A): Promise<void> => {
    if (!ref) throw new Error('Ref not initialized');
    await Effect.runPromise(Ref.set(ref, newValue));
    setValue(newValue);
  }, [ref]);

  const update = useCallback(async (f: (a: A) => A): Promise<void> => {
    if (!ref) throw new Error('Ref not initialized');
    await Effect.runPromise(Ref.update(ref, f));
    const newValue = await Effect.runPromise(Ref.get(ref));
    setValue(newValue);
  }, [ref]);

  const modify = useCallback(async <B>(f: (a: A) => readonly [B, A]): Promise<B> => {
    if (!ref) throw new Error('Ref not initialized');
    const result = await Effect.runPromise(Ref.modify(ref, f));
    const newValue = await Effect.runPromise(Ref.get(ref));
    setValue(newValue);
    return result;
  }, [ref]);

  return {
    value,
    loading,
    get,
    set,
    update,
    modify,
  };
}
