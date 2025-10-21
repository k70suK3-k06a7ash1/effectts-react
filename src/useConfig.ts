import { useState, useEffect, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Config from 'effect/Config';
import * as ConfigError from 'effect/ConfigError';

export function useConfig<A>(
  config: Config.Config<A>,
  options?: {
    fallback?: A;
    onError?: (error: ConfigError.ConfigError) => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: ConfigError.ConfigError | null;
  reload: () => Promise<void>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ConfigError.ConfigError | null>(null);
  const optionsRef = useRef(options);

  // Update ref when options change
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await Effect.runPromise(config);
        if (cancelled) return;
        setValue(result as A);
      } catch (err) {
        if (cancelled) return;
        const configError = err as ConfigError.ConfigError;
        setError(configError);
        optionsRef.current?.onError?.(configError);

        if (optionsRef.current?.fallback !== undefined) {
          setValue(optionsRef.current.fallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [config]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await Effect.runPromise(config);
      setValue(result as A);
    } catch (err) {
      const configError = err as ConfigError.ConfigError;
      setError(configError);
      optionsRef.current?.onError?.(configError);

      if (optionsRef.current?.fallback !== undefined) {
        setValue(optionsRef.current.fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [config]);

  return {
    value,
    loading,
    error,
    reload,
  };
}
