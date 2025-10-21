# useEffectRun

**ステータス**: 📋 提案中

## 概要

`Effect.runFork` を使用してEffectプログラムを実行し、Fiberベースの自動キャンセル機能を提供するhook。コンポーネントのアンマウント時や依存配列の変更時に、実行中のEffectを`Fiber.interrupt`で確実に中断します。

## ユースケース

- 長時間実行される非同期処理の中断可能な実行
- WebSocketやSSEなどの継続的な接続の管理
- バックグラウンドタスクのライフサイクル管理
- リソースの適切なクリーンアップが必要な処理
- コンポーネントのライフサイクルに紐づくEffect実行

## API設計

```typescript
function useEffectRun<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    deps?: React.DependencyList;
    runtime?: Runtime.Runtime<R>;
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
    onDefect?: (cause: Cause.Cause<never>) => void;
  }
): {
  data: A | null;
  error: E | null;
  loading: boolean;
  fiber: Fiber.RuntimeFiber<A, E> | null;
  rerun: () => void;
}
```

**パラメータ:**
- `effect`: 実行するEffect
- `options.deps`: 依存配列（React.useEffectと同様、デフォルトは`[]`）
- `options.runtime`: カスタムランタイム（オプション）
- `options.onSuccess`: 成功時のコールバック
- `options.onFailure`: 失敗時のコールバック
- `options.onDefect`: Defect発生時のコールバック

**戻り値:**
- `data`: 成功時のデータ（初期値・エラー時は`null`）
- `error`: エラー時のエラー値（成功時は`null`）
- `loading`: ローディング状態
- `fiber`: 実行中のFiber（完了時は`null`）
- `rerun`: 手動で再実行する関数

## 使用例

### 基本的な使用例

```typescript
import { useEffectRun } from 'effectts-react';
import { Effect } from 'effect';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading } = useEffectRun(
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () => fetch(`/api/users/${userId}`).then(r => r.json()),
        catch: (error) => new FetchError({ cause: error })
      });
      return response;
    }),
    {
      deps: [userId],
      onSuccess: (user) => console.log('User loaded:', user),
      onFailure: (error) => console.error('Failed:', error)
    }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data?.name}</div>;
}
```

### 長時間実行タスクの自動中断

```typescript
function BackgroundSync() {
  const { data, loading, error } = useEffectRun(
    Effect.gen(function* () {
      // 10秒かかる処理も、コンポーネントがアンマウントされると自動中断
      yield* Effect.sleep('10 seconds');
      yield* Effect.log('Sync completed');
      return { status: 'synced' };
    }),
    { deps: [] }
  );

  return <div>Sync status: {loading ? 'Running...' : 'Complete'}</div>;
}
```

### カスタムランタイムの使用

```typescript
function DataFetcher() {
  const runtime = useRuntime(AppLayer);

  const { data, loading, error } = useEffectRun(
    Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      yield* logger.info('Fetching data');
      const result = yield* db.query('SELECT * FROM users');
      yield* logger.info(`Fetched ${result.length} users`);

      return result;
    }),
    {
      runtime,
      deps: []
    }
  );

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <UserList users={data} />;
}
```

### Fiberの手動制御

```typescript
function TaskRunner() {
  const { fiber, loading, data, rerun } = useEffectRun(
    Effect.gen(function* () {
      for (let i = 0; i < 100; i++) {
        yield* Effect.sleep('100 millis');
        yield* Effect.log(`Progress: ${i}%`);
      }
      return { completed: true };
    }),
    { deps: [] }
  );

  const handleCancel = () => {
    if (fiber) {
      // Fiberを手動で中断
      Effect.runPromise(Fiber.interrupt(fiber));
    }
  };

  return (
    <div>
      <p>Status: {loading ? 'Running' : 'Stopped'}</p>
      <button onClick={handleCancel} disabled={!loading}>
        Cancel
      </button>
      <button onClick={rerun} disabled={loading}>
        Restart
      </button>
    </div>
  );
}
```

### 複数のEffect実行結果の組み合わせ

```typescript
function Dashboard() {
  const users = useEffectRun(fetchUsers(), { deps: [] });
  const stats = useEffectRun(fetchStats(), { deps: [] });

  if (users.loading || stats.loading) {
    return <Spinner />;
  }

  if (users.error || stats.error) {
    return <ErrorDisplay error={users.error || stats.error} />;
  }

  return (
    <div>
      <UserList users={users.data} />
      <Statistics stats={stats.data} />
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as Fiber from 'effect/Fiber';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useEffectRun<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    deps?: React.DependencyList;
    runtime?: Runtime.Runtime<R>;
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
    onDefect?: (cause: Cause.Cause<never>) => void;
  }
): {
  data: A | null;
  error: E | null;
  loading: boolean;
  fiber: Fiber.RuntimeFiber<A, E> | null;
  rerun: () => void;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
    fiber: Fiber.RuntimeFiber<A, E> | null;
  }>({
    data: null,
    error: null,
    loading: true,
    fiber: null
  });

  const [rerunCounter, setRerunCounter] = useState(0);
  const deps = options?.deps || [];

  useEffect(() => {
    // ローディング開始
    setState(prev => ({ ...prev, loading: true, error: null }));

    // Effectを実行してFiberを取得
    const fiber = options?.runtime
      ? Runtime.runFork(options.runtime)(effect)
      : Effect.runFork(effect);

    // Fiberをstateに保存
    setState(prev => ({ ...prev, fiber }));

    // Fiberの完了を待機
    const awaitFiber = async () => {
      const exit = await Fiber.await(fiber);

      if (Exit.isSuccess(exit)) {
        // 成功時
        setState({
          data: exit.value,
          error: null,
          loading: false,
          fiber: null
        });
        options?.onSuccess?.(exit.value);
      } else {
        // 失敗時
        const failure = Cause.failureOption(exit.cause);

        if (failure._tag === 'Some') {
          // 通常のエラー
          setState({
            data: null,
            error: failure.value,
            loading: false,
            fiber: null
          });
          options?.onFailure?.(failure.value);
        } else {
          // Defect（予期しないエラー）
          setState({
            data: null,
            error: null,
            loading: false,
            fiber: null
          });
          options?.onDefect?.(exit.cause);
        }
      }
    };

    awaitFiber();

    // クリーンアップ: Fiberを中断
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [...deps, rerunCounter]);

  const rerun = useCallback(() => {
    setRerunCounter(prev => prev + 1);
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    fiber: state.fiber,
    rerun
  };
}
```

### 実装の特徴

- ✅ `Effect.runFork` によるFiberの取得
- ✅ `Fiber.interrupt` による適切な中断処理
- ✅ `Fiber.await` による結果の待機
- ✅ カスタムランタイムのサポート
- ✅ 成功・失敗・Defectの個別コールバック
- ✅ 手動再実行機能（rerun）
- ✅ Fiberへの直接アクセス
- ✅ 依存配列による再実行制御
- ✅ アンマウント時の自動クリーンアップ

### エッジケース

#### 1. 依存配列が変更された場合
```typescript
// 前のFiberは自動的に中断され、新しいEffectが実行される
const { data } = useEffectRun(fetchUser(userId), { deps: [userId] });
```

#### 2. Effectが即座に完了する場合
```typescript
const { data, loading } = useEffectRun(
  Effect.succeed('immediate'),
  { deps: [] }
);
// loadingは短時間trueになった後、falseになる
```

#### 3. 中断されたEffect
```typescript
// Fiber.interruptによる中断は通常のエラーとして扱われない
// stateはloading: falseになるが、onFailureは呼ばれない
```

#### 4. ランタイムが提供されない場合
```typescript
// デフォルトのランタイムが使用される
// Effect.runForkが直接呼ばれる
```

## テストケース

### 基本機能
- ✅ Effectの正常実行とdata取得
- ✅ 初期ローディング状態の確認
- ✅ 成功時のonSuccessコールバック実行
- ✅ エラー時のerror取得とonFailureコールバック実行
- ✅ Defect時のonDefectコールバック実行

### Fiber管理
- ✅ 依存配列変更時の前のFiberの自動中断
- ✅ コンポーネントアンマウント時のFiber中断
- ✅ 長時間実行タスクの適切な中断
- ✅ Fiberへの直接アクセスと手動制御

### ランタイム
- ✅ カスタムランタイムでの実行
- ✅ デフォルトランタイムの使用
- ✅ ランタイムコンテキストからのサービス取得

### 再実行
- ✅ rerun関数による手動再実行
- ✅ 再実行時の前のFiber中断
- ✅ 連続したrerun呼び出しの処理

### エッジケース
- ✅ 即座に完了するEffectの処理
- ✅ 依存配列が空の場合の単一実行
- ✅ 複数の同時実行（別々のuseEffectRun呼び出し）
- ✅ Effect実行中のrerun呼び出し

## 既存Hooksとの比較

### useEffectQuery との違い

| 機能 | useEffectQuery | useEffectRun |
|------|---------------|--------------|
| 実行方法 | `Effect.runPromiseExit` | `Effect.runFork` |
| キャンセル | フラグベース | Fiberベース |
| Fiber取得 | ❌ | ✅ |
| 手動再実行 | ❌ | ✅ (rerun) |
| カスタムランタイム | ❌ | ✅ |
| コールバック | ❌ | ✅ (onSuccess/onFailure/onDefect) |
| 推奨用途 | シンプルなデータフェッチ | 高度な制御が必要な場合 |

### いつuseEffectRunを使うべきか

✅ **useEffectRunを使う場合:**
- Fiberの直接制御が必要
- 長時間実行タスクの適切な中断が必要
- カスタムランタイムを使用する
- 手動での再実行機能が必要
- WebSocket/SSEなどの継続的な接続

✅ **useEffectQueryを使う場合:**
- シンプルなデータフェッチ
- APIコール
- 基本的な非同期処理

## 関連Hooks

- [useEffectQuery](./useEffectQuery.md) - シンプルなデータフェッチング
- [useRuntime](./useRuntime.md) - カスタムランタイムの作成
- [useEffectCallback](./useEffectCallback.md) - ユーザーインタラクションからのEffect実行
- [useStream](./stream-hooks.md#usestream) - ストリームの購読

## 参考

- [Effect Documentation - Runtime](https://effect.website/docs/runtime)
- [Effect Documentation - Fiber](https://effect.website/docs/concurrency/fibers)
- [Effect Documentation - Interruption](https://effect.website/docs/concurrency/interruption)
