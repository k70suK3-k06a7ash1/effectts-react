# usePoll

**ステータス**: ✅ 実装済み

## 概要

Effectを指定された間隔で繰り返し実行するhook。リアルタイム更新やポーリングに使用。

## ユースケース

- 定期的なデータ更新
- リアルタイムダッシュボード
- ステータス監視
- ポーリングAPI
- 時計・タイマー表示

## API設計

```typescript
function usePoll<A, E>(
  effect: Effect.Effect<A, E>,
  intervalMs: number,
  deps?: React.DependencyList
): {
  data: A | null;
  error: E | null;
  loading: boolean;
}
```

**パラメータ:**
- `effect`: 繰り返し実行するEffect
- `intervalMs`: 実行間隔（ミリ秒）
- `deps`: 依存配列（変更時にポーリングを再起動）

**戻り値:**
- `data`: 最新の成功データ
- `error`: 最新のエラー
- `loading`: ローディング状態

## 使用例

### サーバーステータス監視

```typescript
import { usePoll } from 'effectts-react';
import * as Effect from 'effect/Effect';

function ServerStatus() {
  const { data, loading } = usePoll(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        fetch('/api/health').then(r => r.json())
      );
      return response.status;
    }),
    5000, // 5秒ごと
    []
  );

  return (
    <div>
      Status: {loading ? 'Checking...' : data?.healthy ? '✅' : '❌'}
    </div>
  );
}
```

### リアルタイム時計

```typescript
function LiveClock() {
  const { data } = usePoll(
    Effect.sync(() => new Date().toLocaleTimeString()),
    1000, // 1秒ごと
    []
  );

  return <div>Current time: {data}</div>;
}
```

### ダッシュボードデータの自動更新

```typescript
function Dashboard() {
  const { data: metrics, error } = usePoll(
    Effect.gen(function* () {
      const api = yield* Effect.service(MetricsAPI);

      const [cpu, memory, network] = yield* Effect.all([
        api.getCpuUsage(),
        api.getMemoryUsage(),
        api.getNetworkStats(),
      ]);

      return { cpu, memory, network };
    }),
    10000, // 10秒ごと
    []
  );

  if (error) return <div>Error loading metrics</div>;

  return (
    <div>
      <MetricCard title="CPU" value={metrics?.cpu} />
      <MetricCard title="Memory" value={metrics?.memory} />
      <MetricCard title="Network" value={metrics?.network} />
    </div>
  );
}
```

### 依存配列による再起動

```typescript
function UserActivity({ userId }: { userId: string }) {
  const { data } = usePoll(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        fetch(`/api/users/${userId}/activity`).then(r => r.json())
      );
      return response;
    }),
    3000, // 3秒ごと
    [userId] // userIdが変わったらポーリングを再起動
  );

  return <div>Last activity: {data?.timestamp}</div>;
}
```

## 実装詳細

```typescript
export function usePoll<A, E>(
  effect: Effect.Effect<A, E>,
  intervalMs: number,
  deps: React.DependencyList = []
): {
  data: A | null;
  error: E | null;
  loading: boolean;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useReactEffect(() => {
    let cancelled = false;

    const runEffect = () => {
      if (cancelled) return;

      Effect.runPromiseExit(effect).then((exit) => {
        if (cancelled) return;

        if (Exit.isSuccess(exit)) {
          setState({ data: exit.value, error: null, loading: false });
        } else {
          const failure = Cause.failureOption(exit.cause);
          setState({
            data: null,
            error: failure._tag === 'Some' ? failure.value : null,
            loading: false
          });
        }
      });
    };

    // 即座に1回実行
    runEffect();

    // その後、指定間隔で実行
    const interval = setInterval(runEffect, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, deps);

  return state;
}
```

### 実装の特徴

- ✅ `setInterval`による定期実行
- ✅ マウント時に即座に1回実行してから定期実行開始
- ✅ アンマウント時の`clearInterval`でメモリリーク防止
- ✅ `cancelled`フラグで非同期処理のクリーンアップ
- ✅ 依存配列変更時にインターバルを再起動

## テストケース

- ✅ 初期ローディング状態
- ✅ 即座に実行
- ✅ 指定間隔でのポーリング確認
- ✅ エラーハンドリング
- ✅ アンマウント時のインターバルクリア
- ✅ 依存配列変更時の再起動

## 関連Hooks

- [useEffectQuery](./useEffectQuery.md) - 1回だけの実行
- [useStream](./stream-hooks.md#usestream) - より高度なストリーム処理（提案）
