# useManagedRuntime

**ステータス**: ✅ 実装済み

## 概要

Effect-TSの`ManagedRuntime`をReactコンポーネントで管理するhook。カスタムレイヤーを持つランタイムを作成し、コンポーネントのライフサイクルに応じて適切にクリーンアップします。

## ユースケース

- アプリケーション全体で共有するランタイムの作成
- カスタムサービスを含むランタイム
- テスト時の独立したランタイム
- スコープ付きリソース管理
- 外部フレームワーク（React）との統合
- ランタイムレベルの設定管理

## API設計

```typescript
function useManagedRuntime<R, E = never>(
  layer: Layer.Layer<R, E, never>,
  options?: {
    onError?: (error: E) => void;
  }
): {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  loading: boolean;
  error: E | null;
}
```

**パラメータ:**
- `layer`: ランタイムに提供するLayer
- `options.onError`: ランタイム構築エラー時のコールバック

**戻り値:**
- `runtime`: 構築されたManagedRuntime（構築中・エラー時はnull）
- `loading`: ランタイム構築中かどうか
- `error`: 構築エラー

## 使用例

### 基本的な使用例

```typescript
import { useManagedRuntime } from 'effectts-react';
import { Layer, Effect, Context, ManagedRuntime } from 'effect';

class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], Error>;
  }
>() {}

class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly info: (msg: string) => Effect.Effect<void>;
  }
>() {}

// Layerを定義
const DatabaseLayer = Layer.succeed(Database, {
  query: (sql) => Effect.tryPromise({
    try: () => fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ sql })
    }).then(r => r.json()),
    catch: (e) => new Error(String(e))
  })
});

const LoggerLayer = Layer.succeed(Logger, {
  info: (msg) => Effect.sync(() => console.log(`[INFO] ${msg}`))
});

const AppLayer = Layer.merge(DatabaseLayer, LoggerLayer);

function App() {
  const { runtime, loading, error } = useManagedRuntime(AppLayer, {
    onError: (err) => {
      console.error('Failed to initialize runtime:', err);
    }
  });

  if (loading) {
    return <div>Initializing runtime...</div>;
  }

  if (error) {
    return <div>Failed to initialize: {String(error)}</div>;
  }

  if (!runtime) {
    return null;
  }

  return (
    <RuntimeContext.Provider value={runtime}>
      <AppContent />
    </RuntimeContext.Provider>
  );
}

// 子コンポーネントでランタイムを使用
function AppContent() {
  const runtime = useContext(RuntimeContext);

  const handleLoadUsers = () => {
    const effect = Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      yield* logger.info('Loading users');
      const users = yield* db.query('SELECT * FROM users');

      return users;
    });

    // ManagedRuntimeで実行
    runtime.runPromise(effect).then(users => {
      console.log('Users:', users);
    });
  };

  return (
    <div>
      <button onClick={handleLoadUsers}>Load Users</button>
    </div>
  );
}
```

### アプリ全体のランタイム管理

```typescript
// app-runtime.ts
export class AppServices extends Context.Tag('AppServices')<
  AppServices,
  {
    database: DatabaseService;
    cache: CacheService;
    logger: LoggerService;
    auth: AuthService;
  }
>() {}

export const AppLayer = Layer.effect(
  AppServices,
  Effect.gen(function* () {
    // すべてのサービスを初期化
    const database = yield* initDatabase();
    const cache = yield* initCache();
    const logger = yield* initLogger();
    const auth = yield* initAuth(database);

    return {
      database,
      cache,
      logger,
      auth
    };
  })
);

// App.tsx
function App() {
  const { runtime, loading, error } = useManagedRuntime(AppLayer, {
    onError: (error) => {
      // エラートラッキング
      Sentry.captureException(error);
    }
  });

  if (loading) {
    return <SplashScreen message="Initializing application..." />;
  }

  if (error) {
    return <FatalError error={error} />;
  }

  return (
    <RuntimeProvider runtime={runtime}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </Router>
    </RuntimeProvider>
  );
}
```

### リソースのスコープ管理

```typescript
function DatabaseConnection() {
  // スコープ付きリソースを含むLayer
  const DatabaseLayer = Layer.scoped(
    Database,
    Effect.gen(function* () {
      // リソースの取得
      console.log('Opening database connection');
      const connection = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => openDatabaseConnection(),
          catch: (e) => new Error(String(e))
        }),
        (conn) => Effect.sync(() => {
          console.log('Closing database connection');
          conn.close();
        })
      );

      return {
        query: (sql: string) => Effect.tryPromise({
          try: () => connection.query(sql),
          catch: (e) => new Error(String(e))
        })
      };
    })
  );

  const { runtime, loading } = useManagedRuntime(DatabaseLayer);

  useEffect(() => {
    // コンポーネントアンマウント時に自動的にリソースが解放される
    return () => {
      if (runtime) {
        console.log('Component unmounting, runtime will be disposed');
      }
    };
  }, [runtime]);

  if (loading) {
    return <div>Connecting to database...</div>;
  }

  return <DatabaseApp runtime={runtime} />;
}
```

### テスト用のランタイム

```typescript
// test-utils.tsx
export function createTestRuntime() {
  const MockDatabaseLayer = Layer.succeed(Database, {
    query: (sql) => Effect.succeed([
      { id: 1, name: 'Test User' }
    ])
  });

  const MockLoggerLayer = Layer.succeed(Logger, {
    info: (msg) => Effect.sync(() => {
      // テストではログを記録
      console.log(`[TEST LOG] ${msg}`);
    })
  });

  return Layer.merge(MockDatabaseLayer, MockLoggerLayer);
}

// TestComponent.test.tsx
describe('UserList', () => {
  it('should render users', () => {
    function TestWrapper() {
      const { runtime, loading } = useManagedRuntime(createTestRuntime());

      if (loading || !runtime) {
        return <div>Loading...</div>;
      }

      return (
        <RuntimeProvider runtime={runtime}>
          <UserList />
        </RuntimeProvider>
      );
    }

    render(<TestWrapper />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
```

### 環境別のランタイム

```typescript
function App() {
  const environment = process.env.NODE_ENV;

  const layer = useMemo(() => {
    switch (environment) {
      case 'development':
        return Layer.merge(
          MockDatabaseLayer,
          VerboseLoggerLayer,
          DevCacheLayer
        );

      case 'staging':
        return Layer.merge(
          StagingDatabaseLayer,
          StandardLoggerLayer,
          RedisCacheLayer
        );

      case 'production':
        return Layer.merge(
          ProductionDatabaseLayer,
          ProductionLoggerLayer,
          RedisCacheLayer
        );

      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }, [environment]);

  const { runtime, loading, error } = useManagedRuntime(layer, {
    onError: (error) => {
      console.error(`Failed to initialize ${environment} runtime:`, error);
    }
  });

  if (loading) {
    return <LoadingScreen environment={environment} />;
  }

  if (error || !runtime) {
    return <ErrorScreen error={error} />;
  }

  return (
    <RuntimeProvider runtime={runtime}>
      <AppRouter />
    </RuntimeProvider>
  );
}
```

### 動的なランタイム再構築

```typescript
function ConfigurableApp() {
  const [config, setConfig] = useState({
    apiUrl: 'https://api.example.com',
    cacheEnabled: true
  });

  const layer = useMemo(() => {
    const ConfigLayer = Layer.succeed(Config, config);

    const DatabaseLayer = Layer.effect(
      Database,
      Effect.gen(function* () {
        const cfg = yield* Effect.service(Config);
        return createDatabaseService(cfg.apiUrl);
      })
    );

    const layers = [ConfigLayer, DatabaseLayer, LoggerLayer];

    if (config.cacheEnabled) {
      layers.push(CacheLayer);
    }

    return Layer.mergeAll(...layers);
  }, [config.apiUrl, config.cacheEnabled]);

  const { runtime, loading, error } = useManagedRuntime(layer);

  const handleConfigChange = (newConfig: typeof config) => {
    setConfig(newConfig);
    // layerが変更されるため、ランタイムが自動的に再構築される
  };

  if (loading) {
    return <div>Reconfiguring runtime...</div>;
  }

  if (error) {
    return <div>Configuration error: {String(error)}</div>;
  }

  return (
    <div>
      <ConfigPanel config={config} onChange={handleConfigChange} />
      <RuntimeProvider runtime={runtime}>
        <AppContent />
      </RuntimeProvider>
    </div>
  );
}
```

### Fiber統合

```typescript
function BackgroundTaskRunner() {
  const TaskLayer = Layer.succeed(TaskService, createTaskService());

  const { runtime, loading } = useManagedRuntime(TaskLayer);

  const runBackgroundTask = useCallback(() => {
    if (!runtime) return;

    const task = Effect.gen(function* () {
      const service = yield* Effect.service(TaskService);

      for (let i = 0; i < 100; i++) {
        yield* Effect.sleep('100 millis');
        yield* service.updateProgress(i);
      }

      return 'Task completed';
    });

    // Fiberとして実行
    const fiber = runtime.runFork(task);

    // Fiberを保存して後で中断できるようにする
    return () => {
      runtime.runFork(Fiber.interrupt(fiber));
    };
  }, [runtime]);

  if (loading || !runtime) {
    return <div>Initializing task runner...</div>;
  }

  return (
    <div>
      <button onClick={runBackgroundTask}>
        Start Background Task
      </button>
    </div>
  );
}
```

### ランタイムメトリクスの監視

```typescript
function MonitoredApp() {
  const [metrics, setMetrics] = useState({
    effectsRun: 0,
    errors: 0
  });

  const layer = useMemo(() => {
    // メトリクス収集レイヤー
    const MetricsLayer = Layer.succeed(Metrics, {
      recordEffect: () => Effect.sync(() => {
        setMetrics(m => ({ ...m, effectsRun: m.effectsRun + 1 }));
      }),
      recordError: () => Effect.sync(() => {
        setMetrics(m => ({ ...m, errors: m.errors + 1 }));
      })
    });

    return Layer.merge(AppLayer, MetricsLayer);
  }, []);

  const { runtime, loading } = useManagedRuntime(layer);

  if (loading || !runtime) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <MetricsDisplay metrics={metrics} />
      <RuntimeProvider runtime={runtime}>
        <AppContent />
      </RuntimeProvider>
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useEffect } from 'react';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useManagedRuntime<R, E = never>(
  layer: Layer.Layer<R, E, never>,
  options?: {
    onError?: (error: E) => void;
  }
): {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  loading: boolean;
  error: E | null;
} {
  const [state, setState] = useState<{
    runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
    loading: boolean;
    error: E | null;
  }>({
    runtime: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    // ManagedRuntimeを作成
    const effect = Effect.gen(function* () {
      const runtime = yield* ManagedRuntime.make(layer);
      return runtime;
    }).pipe(
      Effect.tap((runtime) =>
        Effect.sync(() => {
          if (!cancelled) {
            setState({
              runtime,
              loading: false,
              error: null
            });
          }
        })
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          if (!cancelled) {
            setState({
              runtime: null,
              loading: false,
              error: err
            });
            options?.onError?.(err);
          }
        })
      )
    );

    // Effectを実行
    let currentRuntime: ManagedRuntime.ManagedRuntime<R, E> | null = null;

    Effect.runPromiseExit(effect).then((exit) => {
      if (Exit.isSuccess(exit)) {
        currentRuntime = exit.value;
      }
    });

    // クリーンアップ: ManagedRuntimeを破棄
    return () => {
      cancelled = true;

      if (currentRuntime) {
        // ランタイムの破棄（リソースの解放）
        Effect.runPromise(currentRuntime.dispose()).catch((error) => {
          console.error('Failed to dispose runtime:', error);
        });
      }
    };
  }, [layer, options?.onError]);

  return state;
}
```

### 実装の特徴

- ✅ `ManagedRuntime.make`によるランタイム作成
- ✅ スコープ付きリソースの自動管理
- ✅ `dispose`による適切なクリーンアップ
- ✅ エラーハンドリングとコールバック
- ✅ Layerの変更時の自動再構築
- ✅ ローディング状態の管理

### エッジケース

#### 1. ランタイム構築中のアンマウント
```typescript
// cancelled フラグにより状態更新を防ぎ、
// currentRuntimeがあればdisposeが呼ばれる
```

#### 2. dispose失敗
```typescript
// エラーがログに記録される
// Reactの状態には影響しない
```

#### 3. Layerの変更
```typescript
// useEffectの依存配列にlayerが含まれるため、
// 前のランタイムがdisposeされ、新しいものが作成される
```

## テストケース

### 基本機能
- ✅ ManagedRuntimeの作成
- ✅ 初期ローディング状態
- ✅ 構築完了後のruntime取得

### リソース管理
- ✅ スコープ付きリソースの取得
- ✅ アンマウント時のdispose呼び出し
- ✅ リソースの適切な解放

### エラーハンドリング
- ✅ ランタイム構築エラー時のerror設定
- ✅ onErrorコールバック実行

### 動的変更
- ✅ Layerの変更時の再構築
- ✅ 前のランタイムのdispose

### Fiber統合
- ✅ runForkによるFiber実行
- ✅ runPromiseによるPromise実行

## useRuntime との比較

| 機能 | useRuntime | useManagedRuntime |
|------|-----------|-------------------|
| 作成方法 | `Runtime.make` | `ManagedRuntime.make` |
| リソース管理 | 手動 | 自動（Scoped） |
| dispose | 手動 | 自動 |
| 推奨用途 | シンプルなランタイム | リソースを含むランタイム |

### いつuseManagedRuntimeを使うべきか

✅ **useManagedRuntimeを使う場合:**
- スコープ付きリソースを含むLayer
- データベース接続などの管理が必要
- 自動的なリソース解放が必要
- 複雑なライフサイクル管理

✅ **useRuntimeを使う場合:**
- シンプルなサービスのみ
- リソース管理が不要
- 軽量なランタイム

## ベストプラクティス

### 1. リソースのスコープ化

```typescript
// ✅ Good: Layer.scopedでリソースを管理
const DatabaseLayer = Layer.scoped(
  Database,
  Effect.acquireRelease(
    openConnection(),
    (conn) => closeConnection(conn)
  )
);

// ❌ Bad: リソースの手動管理
const DatabaseLayer = Layer.succeed(Database, connection);
```

### 2. エラーハンドリング

```typescript
// ✅ Good: onErrorでエラーを処理
const { runtime, error } = useManagedRuntime(layer, {
  onError: (err) => {
    console.error('Runtime initialization failed:', err);
    Sentry.captureException(err);
  }
});

// ❌ Bad: エラーを無視
const { runtime } = useManagedRuntime(layer);
```

### 3. Layerのメモ化

```typescript
// ✅ Good: useMemoでLayerをメモ化
const layer = useMemo(() => createAppLayer(config), [config]);
const { runtime } = useManagedRuntime(layer);

// ❌ Bad: 毎レンダリングで新しいLayer
const { runtime } = useManagedRuntime(createAppLayer(config));
```

## 関連Hooks

- [useRuntime](./useRuntime.md) - シンプルなランタイム作成
- [useLayer](./useLayer.md) - Layerの構築
- [EffectProvider](./EffectProvider.md) - Layer提供コンポーネント

## 参考

- [Effect Documentation - ManagedRuntime](https://effect.website/docs/runtime#managed-runtime)
- [Effect Documentation - Scope](https://effect.website/docs/resource-management/scope)
- [Effect Documentation - Resource Management](https://effect.website/docs/resource-management)
