# ストリーム処理Hooks

## useStream

### 概要
Effect Streamを購読し、値の変更を自動的にReactステートに反映するhook。

### ユースケース
- リアルタイムデータの購読
- WebSocketストリーム
- サーバーサイドイベント
- 継続的なデータ更新

### API設計

```typescript
function useStream<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    bufferSize?: number;
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

### 使用例

```typescript
import { useStream } from 'effectts-react';
import { Stream, Schedule } from 'effect';

function LivePriceDisplay() {
  const priceStream = Stream.fromSchedule(
    Effect.gen(function* () {
      const api = yield* Effect.service(PriceAPI);
      return yield* api.getCurrentPrice();
    }),
    Schedule.spaced('1 second')
  );

  const { latest, loading, error } = useStream(priceStream);

  if (loading) return <div>Connecting...</div>;
  if (error) return <div>Error: {String(error)}</div>;

  return <div>Current Price: ${latest}</div>;
}
```

### 詳細な使用例

```typescript
// WebSocketストリームの例
function ChatMessages() {
  const messageStream = Stream.async<Message, Error>((emit) => {
    const ws = new WebSocket('ws://localhost:3000');

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

    return Effect.sync(() => ws.close());
  });

  const { data, done, error } = useStream(messageStream, {
    bufferSize: 100,
    onError: (err) => console.error('Stream error:', err),
    onDone: () => console.log('Stream completed'),
  });

  return (
    <div>
      {data.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
      {done && <div>Chat ended</div>}
    </div>
  );
}
```

### 実装詳細

```typescript
export function useStream<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  options?: {
    bufferSize?: number;
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
  const [latest, setLatest] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxSize = options?.bufferSize || Infinity;

    const effect = Stream.runForEach(stream, (value) =>
      Effect.sync(() => {
        if (cancelled) return;

        setLatest(value);
        setData((prev) => {
          const next = [...prev, value];
          return next.length > maxSize ? next.slice(-maxSize) : next;
        });
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
            options?.onDone?.();
          }
        })
      )
    );

    Effect.runPromise(effect);

    return () => {
      cancelled = true;
    };
  }, [stream]);

  return { data, latest, loading, error, done };
}
```

### テストケース
- ✅ ストリーム値の受信
- ✅ バッファサイズの制限
- ✅ エラーハンドリング
- ✅ ストリーム完了の検知
- ✅ アンマウント時のクリーンアップ
- ✅ 高頻度更新の処理

---

## useStreamValue

### 概要
Streamから最新の値のみを購読する軽量版hook。履歴を保持しない。

### API設計

```typescript
function useStreamValue<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  initialValue?: A
): {
  value: A | null;
  loading: boolean;
  error: E | null;
}
```

### 使用例

```typescript
import { useStreamValue } from 'effectts-react';

function ServerStatus() {
  const statusStream = Stream.fromSchedule(
    checkServerHealth(),
    Schedule.spaced('5 seconds')
  );

  const { value: status, loading } = useStreamValue(statusStream);

  return (
    <div>
      Status: {loading ? 'Checking...' : status?.healthy ? '✅' : '❌'}
    </div>
  );
}
```

### 実装詳細

```typescript
export function useStreamValue<A, E = never, R = never>(
  stream: Stream.Stream<A, E, R>,
  initialValue?: A
): {
  value: A | null;
  loading: boolean;
  error: E | null;
} {
  const [value, setValue] = useState<A | null>(initialValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);

  useEffect(() => {
    let cancelled = false;

    const effect = Stream.runForEach(stream, (newValue) =>
      Effect.sync(() => {
        if (!cancelled) {
          setValue(newValue);
          setLoading(false);
        }
      })
    ).pipe(
      Effect.catchAll((err) =>
        Effect.sync(() => {
          if (!cancelled) {
            setError(err);
            setLoading(false);
          }
        })
      )
    );

    Effect.runPromise(effect);

    return () => {
      cancelled = true;
    };
  }, [stream]);

  return { value, loading, error };
}
```

### テストケース
- ✅ 最新値の取得
- ✅ 初期値の設定
- ✅ 値の更新
- ✅ エラーハンドリング
- ✅ メモリ効率（履歴を保持しない）
