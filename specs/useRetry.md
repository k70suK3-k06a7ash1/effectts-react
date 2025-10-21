# useRetry

**ステータス**: ✅ 実装済み

## 概要
シンプルなリトライ機能を提供するhook。useScheduleの簡易版として、一般的なリトライパターンを使いやすいAPIで提供します。

## ユースケース
- API呼び出しの自動リトライ
- 一時的なネットワークエラーからの回復
- データベース接続のリトライ
- 外部サービスとの通信の安定化
- ユーザー操作の自動再試行

## API設計

```typescript
function useRetry<A, E = never>(
  options?: {
    maxAttempts?: number;
    delay?: Duration.Duration | 'exponential' | 'linear';
    shouldRetry?: (error: E, attempt: number) => boolean;
    onRetry?: (error: E, attempt: number) => void;
    onSuccess?: (value: A, attempts: number) => void;
    onFailure?: (error: E, attempts: number) => void;
  }
): {
  execute: (effect: Effect.Effect<A, E, never>) => Promise<A>;
  executeEffect: (effect: Effect.Effect<A, E, never>) => Effect.Effect<A, E, never>;
  retry: <R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  attempts: number;
  isRetrying: boolean;
  reset: () => void;
}
```

**パラメータ:**
- `options.maxAttempts` - 最大リトライ回数（デフォルト: 3）
- `options.delay` - リトライ間隔（デフォルト: exponential）
  - Duration: 固定間隔
  - 'exponential': 指数バックオフ
  - 'linear': 線形バックオフ
- `options.shouldRetry` - リトライすべきか判定する関数
- `options.onRetry` - リトライ時のコールバック
- `options.onSuccess` - 成功時のコールバック
- `options.onFailure` - 失敗時のコールバック

**戻り値:**
- `execute` - Effectを実行してPromiseを返す
- `executeEffect` - Effectを実行してEffectを返す
- `retry` - Effectにリトライロジックを適用
- `attempts` - 現在の試行回数
- `isRetrying` - リトライ中かどうか
- `reset` - 試行回数をリセット

## 使用例

### 基本的な使用例

```typescript
import { useRetry } from 'effectts-react';
import * as Effect from 'effect/Effect';

function DataFetcher() {
  const { execute, attempts, isRetrying } = useRetry({
    maxAttempts: 3,
    delay: 'exponential',
    onRetry: (error, attempt) =>
      console.log(`Retry #${attempt}:`, error),
  });

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      return yield* execute(
        Effect.tryPromise(() =>
          fetch('/api/data').then((r) => {
            if (!r.ok) throw new Error('Network error');
            return r.json();
          })
        )
      );
    }),
    []
  );

  return (
    <div>
      {loading && (
        <div>
          Loading... {isRetrying && `(Retry attempt ${attempts})`}
        </div>
      )}
      {error && <div>Error after {attempts} attempts</div>}
      {data && <div>{JSON.stringify(data)}</div>}
    </div>
  );
}
```

### 固定間隔でのリトライ

```typescript
import { useRetry } from 'effectts-react';
import * as Duration from 'effect/Duration';

function FixedIntervalRetry() {
  const { retry } = useRetry({
    maxAttempts: 5,
    delay: Duration.seconds(2), // 2秒間隔
  });

  const { data } = useEffectQuery(
    retry(
      Effect.tryPromise(() =>
        fetch('/api/data').then((r) => r.json())
      )
    ),
    []
  );

  return <div>{data && JSON.stringify(data)}</div>;
}
```

### 条件付きリトライ

```typescript
import { useRetry } from 'effectts-react';

interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

function ConditionalRetry() {
  const { execute } = useRetry<Data, ApiError>({
    maxAttempts: 5,
    shouldRetry: (error, attempt) => {
      // リトライ可能なエラーのみリトライ
      if (!error.retryable) return false;
      // レート制限エラーは最大3回まで
      if (error.code === 'RATE_LIMIT' && attempt > 3) return false;
      return true;
    },
    onRetry: (error, attempt) => {
      console.log(`Retrying ${error.code}: attempt ${attempt}`);
    },
  });

  const handleFetch = async () => {
    try {
      const data = await execute(
        Effect.tryPromise<Data, ApiError>(() =>
          fetch('/api/data').then((r) => r.json())
        )
      );
      console.log('Success:', data);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return <button onClick={handleFetch}>Fetch Data</button>;
}
```

### ユーザー操作のリトライ

```typescript
import { useRetry } from 'effectts-react';

function FormSubmit() {
  const { execute, attempts, isRetrying, reset } = useRetry({
    maxAttempts: 3,
    delay: 'linear',
    onSuccess: () => {
      alert('Form submitted successfully!');
      reset();
    },
    onFailure: (error, attempts) => {
      alert(`Failed after ${attempts} attempts: ${error.message}`);
    },
  });

  const handleSubmit = async (formData: FormData) => {
    try {
      await execute(
        Effect.tryPromise(() =>
          fetch('/api/submit', {
            method: 'POST',
            body: formData,
          }).then((r) => {
            if (!r.ok) throw new Error('Submission failed');
            return r.json();
          })
        )
      );
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(new FormData(e.currentTarget));
    }}>
      <input name="name" placeholder="Name" />
      <button type="submit" disabled={isRetrying}>
        {isRetrying ? `Submitting... (Attempt ${attempts})` : 'Submit'}
      </button>
    </form>
  );
}
```

### executeEffectの使用

```typescript
import { useRetry } from 'effectts-react';

function EffectComposition() {
  const { executeEffect } = useRetry({
    maxAttempts: 3,
    delay: 'exponential',
  });

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      // 複数のリトライ可能なEffectを組み合わせ
      const user = yield* executeEffect(
        Effect.tryPromise(() =>
          fetch('/api/user').then((r) => r.json())
        )
      );

      const posts = yield* executeEffect(
        Effect.tryPromise(() =>
          fetch(`/api/users/${user.id}/posts`).then((r) => r.json())
        )
      );

      return { user, posts };
    }),
    []
  );

  return <div>{data && JSON.stringify(data)}</div>;
}
```

### 異なるエラー型のリトライ

```typescript
import { useRetry } from 'effectts-react';

class NetworkError {
  readonly _tag = 'NetworkError';
  constructor(readonly message: string) {}
}

class ValidationError {
  readonly _tag = 'ValidationError';
  constructor(readonly field: string, readonly message: string) {}
}

type ApiError = NetworkError | ValidationError;

function TypedErrorRetry() {
  const { execute } = useRetry<Data, ApiError>({
    maxAttempts: 5,
    shouldRetry: (error) => {
      // ネットワークエラーのみリトライ
      return error._tag === 'NetworkError';
    },
    onRetry: (error, attempt) => {
      if (error._tag === 'NetworkError') {
        console.log(`Network error, retry #${attempt}: ${error.message}`);
      }
    },
  });

  const handleFetch = async () => {
    try {
      const data = await execute(
        Effect.tryPromise<Data, ApiError>(() =>
          fetch('/api/data')
            .then((r) => r.json())
            .catch(() => {
              throw new NetworkError('Failed to fetch');
            })
        )
      );
      console.log(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error('Validation error:', error.field, error.message);
      }
    }
  };

  return <button onClick={handleFetch}>Fetch</button>;
}
```

### 楽観的更新とリトライ

```typescript
import { useRetry } from 'effectts-react';

function OptimisticUpdate({ itemId }: { itemId: string }) {
  const [localData, setLocalData] = useState<Item | null>(null);

  const { execute } = useRetry({
    maxAttempts: 3,
    delay: 'exponential',
    onFailure: () => {
      // リトライ失敗時は楽観的更新をロールバック
      setLocalData(null);
    },
  });

  const handleUpdate = async (updates: Partial<Item>) => {
    // 楽観的更新
    setLocalData((prev) => (prev ? { ...prev, ...updates } : null));

    try {
      const result = await execute(
        Effect.tryPromise(() =>
          fetch(`/api/items/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
          }).then((r) => r.json())
        )
      );
      // サーバーからの正しいデータで更新
      setLocalData(result);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  return (
    <div>
      <div>Local: {localData?.name}</div>
      <button onClick={() => handleUpdate({ name: 'New Name' })}>
        Update
      </button>
    </div>
  );
}
```

### 統計情報の表示

```typescript
import { useRetry } from 'effectts-react';

function RetryStats() {
  const [history, setHistory] = useState<Array<{
    attempt: number;
    error: string;
    timestamp: number;
  }>>([]);

  const { execute, attempts, reset } = useRetry({
    maxAttempts: 5,
    delay: 'exponential',
    onRetry: (error, attempt) => {
      setHistory((prev) => [
        ...prev,
        {
          attempt,
          error: String(error),
          timestamp: Date.now(),
        },
      ]);
    },
    onSuccess: () => {
      console.log('Success after', attempts, 'attempts');
    },
  });

  return (
    <div>
      <div>Current Attempts: {attempts}</div>
      <button onClick={reset}>Reset</button>

      <h3>Retry History</h3>
      <ul>
        {history.map((entry, i) => (
          <li key={i}>
            Attempt {entry.attempt}: {entry.error} at{' '}
            {new Date(entry.timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

export function useRetry<A, E = never>(
  options?: {
    maxAttempts?: number;
    delay?: Duration.Duration | 'exponential' | 'linear';
    shouldRetry?: (error: E, attempt: number) => boolean;
    onRetry?: (error: E, attempt: number) => void;
    onSuccess?: (value: A, attempts: number) => void;
    onFailure?: (error: E, attempts: number) => void;
  }
): {
  execute: (effect: Effect.Effect<A, E, never>) => Promise<A>;
  executeEffect: (effect: Effect.Effect<A, E, never>) => Effect.Effect<A, E, never>;
  retry: <R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  attempts: number;
  isRetrying: boolean;
  reset: () => void;
} {
  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const optionsRef = useRef(options);

  optionsRef.current = options;

  const getSchedule = useCallback((): Schedule.Schedule<any, E, never> => {
    const maxAttempts = optionsRef.current?.maxAttempts ?? 3;
    const delay = optionsRef.current?.delay ?? 'exponential';

    let baseSchedule: Schedule.Schedule<any, any, never>;

    if (typeof delay === 'string') {
      switch (delay) {
        case 'exponential':
          baseSchedule = Schedule.exponential(Duration.seconds(1));
          break;
        case 'linear':
          baseSchedule = Schedule.linear(Duration.seconds(1));
          break;
        default:
          baseSchedule = Schedule.exponential(Duration.seconds(1));
      }
    } else {
      baseSchedule = Schedule.spaced(delay);
    }

    let schedule = baseSchedule.pipe(
      Schedule.compose(Schedule.recurs(maxAttempts - 1))
    );

    if (optionsRef.current?.shouldRetry) {
      schedule = schedule.pipe(
        Schedule.whileInput((error: E) => {
          const currentAttempt = attempts + 1;
          return optionsRef.current?.shouldRetry?.(error, currentAttempt) ?? true;
        })
      );
    }

    return schedule;
  }, [attempts]);

  const retry = useCallback(
    <R,>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      return effect.pipe(
        Effect.retry({
          schedule: getSchedule().pipe(
            Schedule.tapOutput((_, delay) =>
              Effect.sync(() => {
                setAttempts((prev) => prev + 1);
                setIsRetrying(true);
              })
            )
          ),
        }),
        Effect.tap((value) =>
          Effect.sync(() => {
            setIsRetrying(false);
            optionsRef.current?.onSuccess?.(value, attempts);
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            setIsRetrying(false);
            optionsRef.current?.onFailure?.(error, attempts);
          })
        )
      );
    },
    [getSchedule, attempts]
  );

  const executeEffect = useCallback(
    (effect: Effect.Effect<A, E, never>): Effect.Effect<A, E, never> => {
      return retry(effect);
    },
    [retry]
  );

  const execute = useCallback(
    async (effect: Effect.Effect<A, E, never>): Promise<A> => {
      setIsRetrying(true);
      try {
        const result = await Effect.runPromise(retry(effect));
        return result;
      } finally {
        setIsRetrying(false);
      }
    },
    [retry]
  );

  const reset = useCallback(() => {
    setAttempts(0);
    setIsRetrying(false);
  }, []);

  return {
    execute,
    executeEffect,
    retry,
    attempts,
    isRetrying,
    reset,
  };
}
```

## リトライ戦略の選択

### Exponential Backoff (推奨)
```typescript
{ delay: 'exponential' }
// 1s, 2s, 4s, 8s, 16s...
```
**用途**: ネットワークエラー、レート制限、サーバー負荷

### Linear Backoff
```typescript
{ delay: 'linear' }
// 1s, 2s, 3s, 4s, 5s...
```
**用途**: 予測可能な間隔が必要な場合

### Fixed Interval
```typescript
{ delay: Duration.seconds(3) }
// 常に3秒
```
**用途**: ポーリング、定期的なチェック

## テストケース

- ✅ 基本的なリトライ動作
- ✅ 最大リトライ回数の検証
- ✅ 各種バックオフ戦略（exponential, linear, fixed）
- ✅ shouldRetryによる条件付きリトライ
- ✅ onRetry/onSuccess/onFailureコールバック
- ✅ 試行回数の追跡
- ✅ isRetrying状態の管理
- ✅ reset機能
- ✅ executeとexecuteEffectの両方のAPI
- ✅ アンマウント時のクリーンアップ

## useRetry vs useSchedule

| 機能 | useRetry | useSchedule |
|------|----------|-------------|
| 使いやすさ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 柔軟性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| カスタマイズ | 基本的なオプション | 完全制御 |
| 推奨用途 | 一般的なリトライ | 高度なスケジューリング |

## 注意事項

### エラーの分類

すべてのエラーをリトライするのではなく、リトライ可能なエラーのみをリトライしてください：

```typescript
shouldRetry: (error) => {
  // 4xx系は通常リトライ不要
  if (error.status >= 400 && error.status < 500) return false;
  // 5xx系とネットワークエラーはリトライ
  return true;
}
```

### 無限ループの防止

必ず`maxAttempts`を設定して、無限リトライを防いでください。

### サーバー負荷

過度なリトライはサーバーに負荷をかけます。適切なバックオフ戦略を使用してください。

## 関連Hooks

- [useSchedule](./useSchedule.md) - 高度なスケジューリング制御
- [useEffectQuery](./useEffectQuery.md) - データフェッチング
- [useEffectCallback](./useEffectCallback.md) - ユーザーインタラクション

## 参考

- [Effect Retry Documentation](https://effect.website/docs/error-management/retrying)
- [Retry Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
