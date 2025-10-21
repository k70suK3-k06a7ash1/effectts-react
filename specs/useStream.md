# useStream

**ステータス**: 📋 提案中

## 概要

Effect Streamを購読し、値の変更を自動的にReactステートに反映するhook。リアルタイムデータの購読、WebSocket、サーバーサイドイベント、継続的なデータ更新を簡単に扱えます。

## ユースケース

- リアルタイムデータの購読
- WebSocketストリーム
- サーバーサイドイベント（SSE）
- 継続的なデータ更新
- 定期的なポーリング
- イベントストリームの処理
- プログレス更新

## API設計

```typescript
function useStream<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    bufferSize?: number;
    initialValue?: A;
    onError?: (error: E) => void;
    onDone?: () => void;
  }
): {
  data: A[];
  latest: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
}
```

**パラメータ:**
- `stream`: 購読するEffect Stream
- `options.bufferSize`: 保持する値の最大数（デフォルトは無制限）
- `options.initialValue`: latestの初期値
- `options.onError`: エラー時のコールバック
- `options.onDone`: ストリーム完了時のコールバック

**戻り値:**
- `data`: 受信した全ての値の配列（bufferSizeで制限可能）
- `latest`: 最新の値（まだ値がない場合はnull）
- `loading`: ストリーム接続中かどうか
- `error`: エラーが発生した場合のエラー値
- `done`: ストリームが完了したかどうか

## 使用例

### 基本的な使用例

```typescript
import { useStream } from 'effectts-react';
import { Stream, Effect, Schedule } from 'effect';

function LivePriceDisplay({ symbol }: { symbol: string }) {
  const priceStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(PriceAPI);
      return yield* api.getCurrentPrice(symbol);
    }),
    Schedule.spaced('1 second')
  );

  const { latest, loading, error } = useStream(priceStream);

  if (loading && !latest) return <div>Connecting...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>{symbol}</h2>
      <p>Current Price: ${latest?.price}</p>
      <small>Last updated: {latest?.timestamp}</small>
    </div>
  );
}
```

### WebSocketストリーム

```typescript
function ChatMessages({ roomId }: { roomId: string }) {
  const messageStream = Stream.async<Message, Error>((emit) => {
    const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);

    ws.onopen = () => {
      console.log('Connected to chat');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      emit.single(message);
    };

    ws.onerror = (error) => {
      emit.fail(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      emit.end();
    };

    // クリーンアップ関数
    return Effect.sync(() => {
      ws.close();
    });
  });

  const { data, done, error, latest } = useStream(messageStream, {
    bufferSize: 100, // 最新100件のみ保持
    onError: (err) => console.error('Stream error:', err),
    onDone: () => console.log('Stream completed')
  });

  return (
    <div>
      <div style={{ height: '400px', overflowY: 'auto' }}>
        {data.map((msg, i) => (
          <div key={i} className="message">
            <strong>{msg.author}:</strong> {msg.text}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
      {done && <div className="info">Chat ended</div>}
      {error && <div className="error">Error: {error.message}</div>}
    </div>
  );
}
```

### サーバーサイドイベント（SSE）

```typescript
function ServerEvents() {
  const eventStream = Stream.async<ServerEvent, Error>((emit) => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      emit.single(data);
    };

    eventSource.onerror = () => {
      emit.fail(new Error('SSE connection error'));
    };

    return Effect.sync(() => {
      eventSource.close();
    });
  });

  const { latest, loading } = useStream(eventStream, {
    onError: (error) => {
      console.error('SSE error:', error);
    }
  });

  return (
    <div>
      <h3>Server Status</h3>
      {loading ? (
        <p>Connecting...</p>
      ) : (
        <p>Latest event: {latest?.type} at {latest?.timestamp}</p>
      )}
    </div>
  );
}
```

### 定期的なデータポーリング

```typescript
function StockTicker({ symbols }: { symbols: string[] }) {
  const stockStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(StockAPI);
      const prices = yield* Effect.all(
        symbols.map(symbol => api.getPrice(symbol))
      );
      return prices;
    }),
    Schedule.spaced('5 seconds')
  );

  const { latest, loading } = useStream(stockStream, {
    initialValue: []
  });

  return (
    <div>
      <h3>Stock Prices</h3>
      {loading && !latest ? (
        <Spinner />
      ) : (
        <table>
          <tbody>
            {latest?.map(stock => (
              <tr key={stock.symbol}>
                <td>{stock.symbol}</td>
                <td>${stock.price}</td>
                <td className={stock.change >= 0 ? 'up' : 'down'}>
                  {stock.change >= 0 ? '+' : ''}{stock.change}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### プログレス更新

```typescript
function FileProcessor({ fileId }: { fileId: string }) {
  const progressStream = Stream.async<Progress, Error>((emit) => {
    const ws = new WebSocket(`/api/process/${fileId}/progress`);

    ws.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      emit.single(progress);

      // 100%になったら完了
      if (progress.percent >= 100) {
        emit.end();
      }
    };

    ws.onerror = () => emit.fail(new Error('Connection failed'));

    return Effect.sync(() => ws.close());
  });

  const { latest, done, error } = useStream(progressStream);

  return (
    <div>
      {done ? (
        <div>✅ Processing complete!</div>
      ) : error ? (
        <div>❌ Error: {error.message}</div>
      ) : (
        <div>
          <ProgressBar value={latest?.percent || 0} />
          <p>{latest?.message || 'Starting...'}</p>
        </div>
      )}
    </div>
  );
}
```

### データ履歴の表示

```typescript
function TemperatureChart() {
  const tempStream = Stream.repeat(
    Effect.gen(function* () {
      const sensor = yield* Effect.service(SensorAPI);
      const temp = yield* sensor.readTemperature();
      return {
        value: temp,
        timestamp: Date.now()
      };
    }),
    Schedule.spaced('2 seconds')
  );

  const { data, latest } = useStream(tempStream, {
    bufferSize: 60 // 最新60件（2分間）
  });

  return (
    <div>
      <h3>Temperature Monitor</h3>
      <div>
        Current: {latest?.value}°C
      </div>
      <LineChart data={data} />
    </div>
  );
}
```

### ストリームの合成

```typescript
function MultiSourceDashboard() {
  // 複数のストリームを並行して購読
  const userCountStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(AnalyticsAPI);
      return yield* api.getActiveUsers();
    }),
    Schedule.spaced('10 seconds')
  );

  const errorRateStream = Stream.repeat(
    Effect.gen(function* () {
      const api = yield* Effect.service(AnalyticsAPI);
      return yield* api.getErrorRate();
    }),
    Schedule.spaced('5 seconds')
  );

  const users = useStream(userCountStream);
  const errors = useStream(errorRateStream);

  return (
    <div>
      <MetricCard
        title="Active Users"
        value={users.latest}
        loading={users.loading}
      />
      <MetricCard
        title="Error Rate"
        value={errors.latest}
        loading={errors.loading}
        error={errors.error}
      />
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useEffect } from 'react';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useStream<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    bufferSize?: number;
    initialValue?: A;
    onError?: (error: E) => void;
    onDone?: () => void;
  }
): {
  data: A[];
  latest: A | null;
  loading: boolean;
  error: E | null;
  done: boolean;
} {
  const [data, setData] = useState<A[]>([]);
  const [latest, setLatest] = useState<A | null>(options?.initialValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxSize = options?.bufferSize ?? Infinity;

    // ストリームを購読
    const effect = Stream.runForEach(stream, (value) =>
      Effect.sync(() => {
        if (cancelled) return;

        // 最新値を更新
        setLatest(value);

        // データ配列を更新
        setData((prev) => {
          const next = [...prev, value];
          // バッファサイズを超えた場合、古いデータを削除
          return next.length > maxSize ? next.slice(-maxSize) : next;
        });

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
  }, [stream, options?.bufferSize, options?.onError, options?.onDone]);

  return {
    data,
    latest,
    loading,
    error,
    done
  };
}
```

### 実装の特徴

- ✅ `Stream.runForEach`によるストリーム購読
- ✅ バッファサイズによるメモリ管理
- ✅ 最新値と履歴の両方を提供
- ✅ ローディング・エラー・完了状態の管理
- ✅ コンポーネントアンマウント時の自動クリーンアップ
- ✅ コールバックによる副作用の処理

### エッジケース

#### 1. ストリームが即座に値を発行
```typescript
// loadingはtrueから始まり、最初の値受信後にfalseになる
const stream = Stream.make(1, 2, 3);
const { data, loading } = useStream(stream);
```

#### 2. ストリームがエラーで終了
```typescript
// errorが設定され、loadingがfalseになり、doneはfalseのまま
```

#### 3. ストリームが値を発行せずに完了
```typescript
// loading: false, done: true, latest: null, data: []
```

#### 4. バッファサイズを超える値
```typescript
// 古い値から順に削除され、常にbufferSize以下の要素数を維持
```

## テストケース

### 基本機能
- ✅ ストリーム値の受信とdata配列への追加
- ✅ latest値の更新
- ✅ 初期ローディング状態
- ✅ 値受信後のloadingフラグ更新

### バッファ管理
- ✅ bufferSizeによる配列サイズ制限
- ✅ 古い値の自動削除
- ✅ 無制限バッファ（デフォルト）

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

### オプション
- ✅ initialValueの使用
- ✅ コールバックの正しい実行

## 既存Hooksとの比較

### useEffectQuery との違い

| 機能 | useEffectQuery | useStream |
|------|---------------|-----------|
| データ型 | 単一値 | 継続的な値のストリーム |
| 更新 | 一度だけ | 連続的 |
| 履歴 | なし | あり（data配列） |
| 用途 | データフェッチ | リアルタイム更新 |

### いつuseStreamを使うべきか

✅ **useStreamを使う場合:**
- WebSocket接続
- Server-Sent Events
- 定期的なポーリング
- リアルタイム更新
- プログレス更新
- イベントストリーム

✅ **useEffectQueryを使う場合:**
- 一度だけのデータフェッチ
- APIからのデータ取得
- 静的なデータ

## 関連Hooks

- [useStreamValue](./useStreamValue.md) - 最新値のみを購読（軽量版）
- [useEffectQuery](./useEffectQuery.md) - 単一値のフェッチ
- [usePoll](./usePoll.md) - 定期的なEffect実行

## 参考

- [Effect Documentation - Stream](https://effect.website/docs/stream/stream)
- [Effect Documentation - Stream Operations](https://effect.website/docs/stream/operations)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
