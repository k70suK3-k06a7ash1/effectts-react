# useStreamValue

**ステータス**: 📋 提案中

## 概要

Effect Streamから最新の値のみを購読する軽量版hook。履歴を保持せず、メモリ効率が良い。リアルタイムの単一値の更新に最適です。

## ユースケース

- リアルタイムの単一値の更新（価格、ステータスなど）
- メモリ効率が重要な場合
- 履歴が不要な場合
- シンプルなポーリング
- センサーデータの最新値表示
- 通知カウントの更新

## API設計

```typescript
function useStreamValue<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    initialValue?: A;
    onError?: (error: E) => void;
    onDone?: () => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
}
```

**パラメータ:**
- `stream`: 購読するEffect Stream
- `options.initialValue`: 初期値（オプション）
- `options.onError`: エラー時のコールバック
- `options.onDone`: ストリーム完了時のコールバック

**戻り値:**
- `value`: 最新の値（まだ値がない場合はnull、または初期値）
- `loading`: ストリーム接続中かどうか
- `error`: エラーが発生した場合のエラー値
- `done`: ストリームが完了したかどうか

## 使用例

### 基本的な使用例

```typescript
import { useStreamValue } from 'effectts-react';
import { Stream, Effect, Schedule } from 'effect';

function ServerStatus() {
  const statusStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(HealthAPI);
      return yield* api.checkHealth();
    }),
    Schedule.spaced('5 seconds')
  );

  const { value: status, loading } = useStreamValue(statusStream, {
    initialValue: { healthy: true, message: 'Starting...' }
  });

  return (
    <div className={status?.healthy ? 'healthy' : 'unhealthy'}>
      <h3>Server Status</h3>
      <p>Status: {loading ? 'Checking...' : status?.message}</p>
      <StatusIcon healthy={status?.healthy} />
    </div>
  );
}
```

### 株価のリアルタイム表示

```typescript
function StockPrice({ symbol }: { symbol: string }) {
  const priceStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(StockAPI);
      return yield* api.getPrice(symbol);
    }),
    Schedule.spaced('1 second')
  );

  const { value: price, loading, error } = useStreamValue(priceStream);

  if (error) {
    return <div className="error">Failed to load price</div>;
  }

  return (
    <div className="stock-price">
      <span className="symbol">{symbol}</span>
      <span className="price">
        {loading && !price ? '...' : `$${price?.toFixed(2)}`}
      </span>
      {price && (
        <span className={price.change >= 0 ? 'up' : 'down'}>
          {price.change >= 0 ? '↑' : '↓'} {Math.abs(price.change)}%
        </span>
      )}
    </div>
  );
}
```

### 通知カウンターの更新

```typescript
function NotificationBadge() {
  const notificationStream = Stream.async<number, Error>((emit) => {
    const ws = new WebSocket('wss://api.example.com/notifications');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      emit.single(data.unreadCount);
    };

    ws.onerror = () => emit.fail(new Error('Connection failed'));
    ws.onclose = () => emit.end();

    return Effect.sync(() => ws.close());
  });

  const { value: count, loading } = useStreamValue(notificationStream, {
    initialValue: 0
  });

  return (
    <div className="notification-badge">
      <BellIcon />
      {!loading && count > 0 && (
        <span className="count">{count}</span>
      )}
    </div>
  );
}
```

### センサーデータの表示

```typescript
function TemperatureDisplay() {
  const tempStream = Stream.repeat(
    Effect.gen(function* () {
      const sensor = yield* Effect.service(SensorAPI);
      const temp = yield* sensor.readTemperature();
      return {
        value: temp,
        timestamp: Date.now(),
        unit: 'celsius'
      };
    }),
    Schedule.spaced('2 seconds')
  );

  const { value: temp, loading, error } = useStreamValue(tempStream);

  return (
    <div className="temperature-display">
      <h3>Current Temperature</h3>
      {loading && !temp ? (
        <Spinner />
      ) : error ? (
        <div className="error">Sensor error</div>
      ) : (
        <div>
          <span className="value">{temp?.value}°{temp?.unit[0].toUpperCase()}</span>
          <small>Last updated: {new Date(temp?.timestamp).toLocaleTimeString()}</small>
        </div>
      )}
    </div>
  );
}
```

### オンラインユーザー数の表示

```typescript
function OnlineUsersCount() {
  const userCountStream = Stream.async<number, Error>((emit) => {
    const eventSource = new EventSource('/api/users/online');

    eventSource.onmessage = (event) => {
      const count = parseInt(event.data, 10);
      emit.single(count);
    };

    eventSource.onerror = () => {
      emit.fail(new Error('SSE connection failed'));
    };

    return Effect.sync(() => eventSource.close());
  });

  const { value: count } = useStreamValue(userCountStream, {
    initialValue: 0,
    onError: (error) => {
      console.error('Failed to get online users:', error);
    }
  });

  return (
    <div className="online-users">
      <UserIcon />
      <span>{count} online</span>
    </div>
  );
}
```

### 進行状況の表示

```typescript
function UploadProgress({ uploadId }: { uploadId: string }) {
  const progressStream = Stream.async<number, Error>((emit) => {
    const ws = new WebSocket(`/api/uploads/${uploadId}/progress`);

    ws.onmessage = (event) => {
      const progress = parseInt(event.data, 10);
      emit.single(progress);

      // 100%になったら完了
      if (progress >= 100) {
        emit.end();
      }
    };

    ws.onerror = () => emit.fail(new Error('Progress tracking failed'));

    return Effect.sync(() => ws.close());
  });

  const { value: progress, done, error } = useStreamValue(progressStream, {
    initialValue: 0
  });

  if (error) {
    return <div className="error">Upload failed</div>;
  }

  if (done) {
    return <div className="success">✓ Upload complete!</div>;
  }

  return (
    <div className="upload-progress">
      <ProgressBar value={progress} />
      <span>{progress}%</span>
    </div>
  );
}
```

### 複数のストリーム値を表示

```typescript
function SystemMetrics() {
  const cpuStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(MetricsAPI);
      return yield* api.getCPUUsage();
    }),
    Schedule.spaced('1 second')
  );

  const memoryStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(MetricsAPI);
      return yield* api.getMemoryUsage();
    }),
    Schedule.spaced('1 second')
  );

  const cpu = useStreamValue(cpuStream, { initialValue: 0 });
  const memory = useStreamValue(memoryStream, { initialValue: 0 });

  return (
    <div className="metrics">
      <MetricCard
        title="CPU Usage"
        value={cpu.value}
        unit="%"
        loading={cpu.loading}
      />
      <MetricCard
        title="Memory Usage"
        value={memory.value}
        unit="%"
        loading={memory.loading}
      />
    </div>
  );
}
```

### 初期値とフォールバック

```typescript
function ConnectionStatus() {
  const connectionStream = Stream.async<ConnectionState, Error>((emit) => {
    const ws = new WebSocket('wss://api.example.com/status');

    ws.onopen = () => emit.single({ status: 'connected', latency: 0 });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      emit.single(data);
    };

    ws.onclose = () => emit.single({ status: 'disconnected', latency: -1 });
    ws.onerror = () => emit.fail(new Error('Connection error'));

    return Effect.sync(() => ws.close());
  });

  const { value: state, loading } = useStreamValue(connectionStream, {
    initialValue: { status: 'connecting', latency: 0 },
    onDone: () => console.log('Connection stream ended')
  });

  const getStatusColor = () => {
    switch (state?.status) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'disconnected': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="connection-status">
      <StatusDot color={getStatusColor()} />
      <span>{state?.status}</span>
      {state?.status === 'connected' && (
        <small>{state.latency}ms</small>
      )}
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useEffect } from 'react';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';

export function useStreamValue<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    initialValue?: A;
    onError?: (error: E) => void;
    onDone?: () => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
} {
  const [value, setValue] = useState<A | null>(options?.initialValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // ストリームを購読して最新値のみを更新
    const effect = Stream.runForEach(stream, (newValue) =>
      Effect.sync(() => {
        if (cancelled) return;

        // 最新値を更新
        setValue(newValue);

        // 初回データ受信でloadingをfalseに
        setLoading(false);
      })
    ).pipe(
      Effect.catchAll((err) =>
        Effect.sync(() => {
          if (!cancelled) {
            setError(err);
            setLoading(false);
            options?.onError?.(err);
          }
        })
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          if (!cancelled) {
            setDone(true);
            setLoading(false);
            options?.onDone?.();
          }
        })
      )
    );

    // Effectを実行
    Effect.runPromise(effect).catch(() => {
      // エラーは既にcatchAllで処理済み
    });

    // クリーンアップ
    return () => {
      cancelled = true;
    };
  }, [stream, options?.onError, options?.onDone]);

  return {
    value,
    loading,
    error,
    done
  };
}
```

### 実装の特徴

- ✅ 最新値のみを保持（メモリ効率）
- ✅ `Stream.runForEach`によるストリーム購読
- ✅ 初期値のサポート
- ✅ ローディング・エラー・完了状態の管理
- ✅ コンポーネントアンマウント時の自動クリーンアップ
- ✅ シンプルなAPI

### エッジケース

#### 1. 初期値が提供されている場合
```typescript
// valueは即座に初期値になり、loadingはtrueのまま
// 最初のストリーム値を受信後、loadingがfalseになる
```

#### 2. ストリームが即座に値を発行
```typescript
// loading: true → false と素早く遷移
```

#### 3. ストリームがエラーで終了
```typescript
// error設定、loading: false、done: false
```

#### 4. ストリームが値なしで完了
```typescript
// done: true、value: null（または初期値）
```

## テストケース

### 基本機能
- ✅ ストリーム値の受信とvalue更新
- ✅ 初期ローディング状態
- ✅ 値受信後のloadingフラグ更新
- ✅ 最新値のみが保持される（古い値は破棄）

### 初期値
- ✅ initialValueの設定
- ✅ initialValueなしの場合のnull
- ✅ 最初のストリーム値で初期値が上書き

### ストリーム完了
- ✅ ストリーム正常完了時のdoneフラグ
- ✅ onDoneコールバック実行
- ✅ 完了後のloading状態

### エラーハンドリング
- ✅ エラー発生時のerror設定
- ✅ onErrorコールバック実行
- ✅ エラー後の状態

### クリーンアップ
- ✅ コンポーネントアンマウント時のストリーム中断
- ✅ 中断後の状態更新なし

### メモリ効率
- ✅ 履歴を保持しないこと
- ✅ 1つの値のみがメモリに存在

## useStream との比較

| 機能 | useStream | useStreamValue |
|------|-----------|----------------|
| 履歴保持 | ✅ (data配列) | ❌ |
| 最新値 | ✅ (latest) | ✅ (value) |
| メモリ使用量 | 高い（履歴分） | 低い（1値のみ） |
| bufferSize | ✅ | ❌ |
| 用途 | 履歴が必要 | 最新値のみ必要 |

### いつuseStreamValueを使うべきか

✅ **useStreamValueを使う場合:**
- 最新の値のみが必要
- メモリ効率が重要
- ステータス表示
- カウンター表示
- シンプルなポーリング
- リアルタイム単一値の更新

✅ **useStreamを使う場合:**
- 履歴が必要（チャート表示など）
- 過去の値を参照する必要がある
- データの推移を表示
- チャットメッセージなど

## パフォーマンスの最適化

### メモリ使用量の削減

```typescript
// ✅ Good: 履歴不要なら useStreamValue
const { value } = useStreamValue(priceStream);

// ❌ Bad: 履歴不要なのに useStream（メモリ無駄）
const { latest } = useStream(priceStream, { bufferSize: 1 });
```

### 複数のストリーム購読

```typescript
// ✅ Good: 各ストリームを個別に購読
function Dashboard() {
  const cpu = useStreamValue(cpuStream);
  const memory = useStreamValue(memoryStream);
  const disk = useStreamValue(diskStream);

  // 各値は独立して更新され、再レンダリングが最小化される
}
```

## 関連Hooks

- [useStream](./useStream.md) - 履歴を保持するストリーム購読
- [usePoll](./usePoll.md) - 定期的なEffect実行
- [useEffectQuery](./useEffectQuery.md) - 単一値のフェッチ

## 参考

- [Effect Documentation - Stream](https://effect.website/docs/stream/stream)
- [Effect Documentation - Stream Operations](https://effect.website/docs/stream/operations)
