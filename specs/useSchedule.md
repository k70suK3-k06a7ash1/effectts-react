# useSchedule

**ステータス**: 📋 提案中 (Phase 5)

## 概要
Effect-TSのScheduleを使用してリトライロジックと繰り返し実行のポリシーを管理するhook。exponential backoff、固定間隔、条件付きリトライなどの戦略を提供します。

## ユースケース
- API呼び出しの自動リトライ
- ネットワークエラーからの回復
- レート制限の処理
- ポーリング処理の最適化
- タイムアウト処理
- バックオフ戦略の実装

## API設計

```typescript
function useSchedule<A, Out = A>(
  schedule: Schedule.Schedule<Out, A, never>,
  options?: {
    onRetry?: (attempt: number, delay: Duration.Duration) => void;
    onComplete?: (attempts: number, output: Out) => void;
    onFailure?: (error: any) => void;
  }
): {
  schedule: Schedule.Schedule<Out, A, never>;
  applySchedule: <E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
  reset: () => void;
  stats: {
    attempts: number;
    lastDelay: Duration.Duration | null;
  };
}
```

**パラメータ:**
- `schedule` - 使用するScheduleポリシー
- `options.onRetry` - リトライ時のコールバック
- `options.onComplete` - 成功時のコールバック
- `options.onFailure` - 失敗時のコールバック

**戻り値:**
- `schedule` - Scheduleインスタンス
- `applySchedule` - Effectにスケジュールを適用する関数
- `reset` - 統計情報をリセットする関数
- `stats` - リトライ統計情報

## 使用例

### 基本的な使用例 - Exponential Backoff

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

function DataFetcher() {
  // 指数バックオフ: 1秒から始めて最大5回リトライ
  const { applySchedule, stats } = useSchedule(
    Schedule.exponential(Duration.seconds(1)).pipe(
      Schedule.compose(Schedule.recurs(5))
    ),
    {
      onRetry: (attempt, delay) =>
        console.log(`Retry #${attempt} after ${Duration.toMillis(delay)}ms`),
      onComplete: (attempts) =>
        console.log(`Succeeded after ${attempts} attempts`),
    }
  );

  const { data, error, loading } = useEffectQuery(
    applySchedule(
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise(() =>
          fetch('/api/data').then((r) => {
            if (!r.ok) throw new Error('Network error');
            return r.json();
          })
        );
        return response;
      })
    ),
    []
  );

  return (
    <div>
      {loading && <div>Loading... (Attempt: {stats.attempts})</div>}
      {error && <div>Error after {stats.attempts} attempts: {String(error)}</div>}
      {data && <div>Success: {JSON.stringify(data)}</div>}
    </div>
  );
}
```

### 固定間隔でのリトライ

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function FixedRetryExample() {
  // 3秒ごとに最大10回リトライ
  const { applySchedule } = useSchedule(
    Schedule.spaced(Duration.seconds(3)).pipe(
      Schedule.compose(Schedule.recurs(10))
    )
  );

  const fetchData = applySchedule(
    Effect.tryPromise(() =>
      fetch('/api/unstable-endpoint').then((r) => r.json())
    )
  );

  const { data } = useEffectQuery(fetchData, []);

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}
```

### 条件付きリトライ

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

class RetryableError extends Error {
  readonly _tag = 'RetryableError';
}

class PermanentError extends Error {
  readonly _tag = 'PermanentError';
}

function ConditionalRetry() {
  const { applySchedule } = useSchedule(
    Schedule.exponential(Duration.seconds(1)).pipe(
      Schedule.compose(Schedule.recurs(5))
    )
  );

  const { data, error } = useEffectQuery(
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        fetch('/api/data').then((r) => r.json())
      ).pipe(
        Effect.catchAll((error) => {
          // 特定のエラーのみリトライ
          if (error.message.includes('timeout')) {
            return Effect.fail(new RetryableError('Timeout'));
          }
          return Effect.fail(new PermanentError('Permanent failure'));
        }),
        // RetryableErrorのみリトライ
        Effect.retry({
          schedule: Schedule.whileInput((error: Error) =>
            error instanceof RetryableError
          ).pipe(Schedule.compose(applySchedule)),
        })
      );

      return result;
    }),
    []
  );

  return (
    <div>
      {error && <div>Failed: {String(error)}</div>}
      {data && <div>Data: {JSON.stringify(data)}</div>}
    </div>
  );
}
```

### レート制限の処理

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function RateLimitedAPI() {
  // レート制限エラー時は60秒待機
  const { applySchedule, stats } = useSchedule(
    Schedule.recurWhile<Error>((error) =>
      error.message.includes('rate limit')
    ).pipe(
      Schedule.addDelay(() => Duration.seconds(60)),
      Schedule.compose(Schedule.recurs(3))
    ),
    {
      onRetry: (attempt) =>
        console.log(`Rate limited. Retry #${attempt} after 60s`),
    }
  );

  const { execute } = useEffectCallback(
    (endpoint: string) =>
      applySchedule(
        Effect.tryPromise(() =>
          fetch(endpoint).then((r) => {
            if (r.status === 429) {
              throw new Error('rate limit exceeded');
            }
            return r.json();
          })
        )
      )
  );

  return (
    <div>
      <button onClick={() => execute('/api/limited-endpoint')}>
        Call API
      </button>
      <div>Attempts: {stats.attempts}</div>
    </div>
  );
}
```

### Jittered Exponential Backoff

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function JitteredBackoff() {
  // ジッター付き指数バックオフ（ランダム性を加える）
  const { applySchedule } = useSchedule(
    Schedule.exponential(Duration.seconds(1)).pipe(
      Schedule.jittered, // ランダムなジッターを追加
      Schedule.compose(Schedule.recurs(10)),
      Schedule.upTo(Duration.seconds(30)) // 最大30秒まで
    )
  );

  const { data } = useEffectQuery(
    applySchedule(
      Effect.tryPromise(() =>
        fetch('/api/data').then((r) => r.json())
      )
    ),
    []
  );

  return <div>{data && JSON.stringify(data)}</div>;
}
```

### カスタムスケジュール

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function CustomScheduleExample() {
  // カスタムスケジュール: Fibonacci数列でのバックオフ
  const fibonacciSchedule = Schedule.unfold(
    [Duration.seconds(1), Duration.seconds(1)],
    ([prev, curr]) => [
      curr,
      Duration.sum(prev, curr)
    ]
  ).pipe(Schedule.compose(Schedule.recurs(8)));

  const { applySchedule, stats } = useSchedule(fibonacciSchedule, {
    onRetry: (attempt, delay) =>
      console.log(
        `Fibonacci retry #${attempt}: ${Duration.toMillis(delay)}ms`
      ),
  });

  const { data } = useEffectQuery(
    applySchedule(
      Effect.tryPromise(() =>
        fetch('/api/data').then((r) => r.json())
      )
    ),
    []
  );

  return (
    <div>
      <div>Attempts: {stats.attempts}</div>
      {data && <div>Data: {JSON.stringify(data)}</div>}
    </div>
  );
}
```

### ポーリングとタイムアウト

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function PollingWithTimeout() {
  // 5秒ごとにポーリング、最大2分間
  const pollingSchedule = Schedule.spaced(Duration.seconds(5)).pipe(
    Schedule.whileOutput((elapsed) =>
      Duration.lessThan(elapsed, Duration.minutes(2))
    )
  );

  const { applySchedule } = useSchedule(pollingSchedule);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      // ジョブステータスをポーリング
      const checkStatus = yield* applySchedule(
        Effect.tryPromise(() =>
          fetch('/api/job-status').then((r) => r.json())
        ).pipe(
          Schedule.repeatUntil((status) => status.completed)
        )
      );

      return checkStatus;
    }),
    []
  );

  return <div>Job Status: {data?.status}</div>;
}
```

### 統計情報の活用

```typescript
import { useSchedule } from 'effectts-react';
import * as Schedule from 'effect/Schedule';

function ScheduleStats() {
  const [retryHistory, setRetryHistory] = useState<
    Array<{ attempt: number; delay: number; timestamp: number }>
  >([]);

  const { applySchedule, stats, reset } = useSchedule(
    Schedule.exponential(Duration.seconds(1)).pipe(
      Schedule.compose(Schedule.recurs(5))
    ),
    {
      onRetry: (attempt, delay) => {
        setRetryHistory((prev) => [
          ...prev,
          {
            attempt,
            delay: Duration.toMillis(delay),
            timestamp: Date.now(),
          },
        ]);
      },
    }
  );

  return (
    <div>
      <div>Current Attempts: {stats.attempts}</div>
      <div>
        Last Delay:{' '}
        {stats.lastDelay ? Duration.toMillis(stats.lastDelay) : 'N/A'}ms
      </div>
      <button onClick={reset}>Reset Stats</button>

      <h3>Retry History</h3>
      <ul>
        {retryHistory.map((entry, i) => (
          <li key={i}>
            Attempt {entry.attempt}: {entry.delay}ms delay at{' '}
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
import { useState, useCallback, useRef, useMemo } from 'react';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';

interface ScheduleStats {
  attempts: number;
  lastDelay: Duration.Duration | null;
}

export function useSchedule<A, Out = A>(
  schedule: Schedule.Schedule<Out, A, never>,
  options?: {
    onRetry?: (attempt: number, delay: Duration.Duration) => void;
    onComplete?: (attempts: number, output: Out) => void;
    onFailure?: (error: any) => void;
  }
): {
  schedule: Schedule.Schedule<Out, A, never>;
  applySchedule: <E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
  reset: () => void;
  stats: ScheduleStats;
} {
  const [stats, setStats] = useState<ScheduleStats>({
    attempts: 0,
    lastDelay: null,
  });

  const scheduleRef = useRef(schedule);
  const optionsRef = useRef(options);

  scheduleRef.current = schedule;
  optionsRef.current = options;

  const reset = useCallback(() => {
    setStats({ attempts: 0, lastDelay: null });
  }, []);

  const applySchedule = useCallback(
    <E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      return effect.pipe(
        Effect.retry({
          schedule: scheduleRef.current.pipe(
            Schedule.tapOutput((output, delay) =>
              Effect.sync(() => {
                setStats((prev) => ({
                  attempts: prev.attempts + 1,
                  lastDelay: delay,
                }));
                optionsRef.current?.onRetry?.(
                  stats.attempts + 1,
                  delay
                );
              })
            )
          ),
        }),
        Effect.tap((result) =>
          Effect.sync(() => {
            optionsRef.current?.onComplete?.(stats.attempts, result as Out);
          })
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            optionsRef.current?.onFailure?.(error);
            return Effect.fail(error);
          }).pipe(Effect.flatMap((e) => e))
        )
      );
    },
    []
  );

  return {
    schedule: scheduleRef.current,
    applySchedule,
    reset,
    stats,
  };
}
```

## 一般的なスケジュール戦略

### Exponential Backoff

```typescript
Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(5))
);
// 1s, 2s, 4s, 8s, 16s
```

### Fixed Interval

```typescript
Schedule.spaced(Duration.seconds(3)).pipe(
  Schedule.compose(Schedule.recurs(10))
);
// 常に3秒間隔
```

### Linear Backoff

```typescript
Schedule.linear(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(5))
);
// 1s, 2s, 3s, 4s, 5s
```

### Fibonacci Backoff

```typescript
Schedule.fibonacci(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(8))
);
// 1s, 1s, 2s, 3s, 5s, 8s, 13s, 21s
```

## テストケース

- ✅ 基本的なリトライ動作
- ✅ Exponential backoffの検証
- ✅ 固定間隔リトライの検証
- ✅ 最大リトライ回数の制限
- ✅ 条件付きリトライ
- ✅ タイムアウト処理
- ✅ 統計情報の追跡
- ✅ onRetry/onComplete/onFailureコールバック
- ✅ reset機能
- ✅ アンマウント時のクリーンアップ

## 注意事項

### スケジュールの不変性

Scheduleオブジェクトは不変なので、useMemoでメモ化することを推奨します：

```typescript
const schedule = useMemo(
  () => Schedule.exponential(Duration.seconds(1)),
  []
);
const { applySchedule } = useSchedule(schedule);
```

### リトライ条件

すべてのエラーをリトライするのではなく、リトライ可能なエラーのみをリトライするようにしてください：

```typescript
Effect.retry({
  schedule: Schedule.whileInput((error: Error) =>
    error.message.includes('temporary')
  ),
});
```

### パフォーマンス

過度なリトライはサーバーに負荷をかける可能性があります。適切な最大リトライ回数とバックオフ戦略を設定してください。

## 関連Hooks

- [useRetry](./useRetry.md) - シンプルなリトライ専用hook
- [useEffectQuery](./useEffectQuery.md) - データフェッチング
- [useEffectRun](./useEffectRun.md) - Effect実行

## 参考

- [Effect Schedule Documentation](https://effect.website/docs/scheduling/schedule)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
