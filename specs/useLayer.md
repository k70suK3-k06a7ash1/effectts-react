# useLayer

**ステータス**: ✅ 実装済み

## 概要

Effect LayerをReactコンポーネント内で構築し、そのContextを取得するhook。コンポーネントレベルでの動的なサービス構築や、Layer構築の状態管理が必要な場合に使用します。

## ユースケース

- コンポーネント内でのLayer構築
- 動的なサービスの初期化
- プロップスに基づくLayer構成
- Layer構築の進捗表示
- コンポーネントスコープのサービス
- 条件付きのサービス提供

## API設計

```typescript
function useLayer<R, E = never, RIn = never>(
  layer: Layer.Layer<R, E, RIn>,
  options?: {
    runtime?: Runtime.Runtime<RIn>;
  }
): {
  context: Context.Context<R> | null;
  loading: boolean;
  error: E | null;
}
```

**パラメータ:**
- `layer`: 構築するEffect Layer
- `options.runtime`: Layer構築に使用するランタイム（RInがnever以外の場合）

**戻り値:**
- `context`: 構築されたContext（構築中・エラー時はnull）
- `loading`: Layer構築中かどうか
- `error`: 構築エラー

## 使用例

### 基本的な使用例

```typescript
import { useLayer } from 'effectts-react';
import { Layer, Context, Effect } from 'effect';

class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], Error>;
  }
>() {}

function UserList() {
  // Layerを構築
  const DatabaseLayer = Layer.succeed(Database, {
    query: (sql) => Effect.tryPromise({
      try: () => fetch('/api/query', {
        method: 'POST',
        body: JSON.stringify({ sql })
      }).then(r => r.json()),
      catch: (e) => new Error(String(e))
    })
  });

  const { context, loading, error } = useLayer(DatabaseLayer);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      if (!context) {
        return yield* Effect.fail(new Error('Database not ready'));
      }

      const db = yield* Effect.serviceOption(Database).pipe(
        Effect.provide(context)
      );

      if (db._tag === 'None') {
        return yield* Effect.fail(new Error('Database not available'));
      }

      return yield* db.value.query('SELECT * FROM users');
    }),
    [context]
  );

  if (loading) return <div>Initializing database...</div>;
  if (error) return <div>Failed to initialize: {String(error)}</div>;
  if (!data) return null;

  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### プロップスに基づくLayer構築

```typescript
interface ApiClientProps {
  apiKey: string;
  endpoint: string;
}

class ApiClient extends Context.Tag('ApiClient')<
  ApiClient,
  {
    readonly get: (path: string) => Effect.Effect<any, Error>;
    readonly post: (path: string, data: any) => Effect.Effect<any, Error>;
  }
>() {}

function DataFetcher({ apiKey, endpoint }: ApiClientProps) {
  // プロップスに基づいてLayerを動的に構築
  const ApiLayer = useMemo(
    () =>
      Layer.succeed(ApiClient, {
        get: (path) => Effect.tryPromise({
          try: () => fetch(`${endpoint}${path}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          }).then(r => r.json()),
          catch: (e) => new Error(String(e))
        }),
        post: (path, data) => Effect.tryPromise({
          try: () => fetch(`${endpoint}${path}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          }).then(r => r.json()),
          catch: (e) => new Error(String(e))
        })
      }),
    [apiKey, endpoint]
  );

  const { context, loading, error } = useLayer(ApiLayer);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      if (!context) return [];

      const client = Context.get(context, ApiClient);
      return yield* client.get('/data');
    }),
    [context]
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;

  return <DataDisplay data={data} />;
}
```

### 複数のLayerのマージ

```typescript
function Dashboard() {
  const DatabaseLayer = Layer.succeed(Database, createDatabaseService());
  const CacheLayer = Layer.succeed(Cache, createCacheService());
  const LoggerLayer = Layer.succeed(Logger, createLoggerService());

  // 複数のLayerをマージ
  const AppLayer = useMemo(
    () => Layer.mergeAll(DatabaseLayer, CacheLayer, LoggerLayer),
    []
  );

  const { context, loading, error } = useLayer(AppLayer);

  if (loading) {
    return <div>Initializing services...</div>;
  }

  if (error) {
    return <div>Failed to initialize: {String(error)}</div>;
  }

  if (!context) {
    return null;
  }

  // Contextを子コンポーネントに提供
  return (
    <EffectServiceProvider value={context}>
      <DashboardContent />
    </EffectServiceProvider>
  );
}

function DashboardContent() {
  const db = useService(Database);
  const cache = useService(Cache);
  const logger = useService(Logger);

  // すべてのサービスが利用可能
  // ...
}
```

### 依存関係のあるLayer

```typescript
class Config extends Context.Tag('Config')<
  Config,
  { apiUrl: string }
>() {}

class HttpClient extends Context.Tag('HttpClient')<
  HttpClient,
  {
    readonly fetch: (path: string) => Effect.Effect<any, Error>;
  }
>() {}

function ApiComponent({ apiUrl }: { apiUrl: string }) {
  // 最初にConfigレイヤーを構築
  const ConfigLayer = useMemo(
    () => Layer.succeed(Config, { apiUrl }),
    [apiUrl]
  );

  const configResult = useLayer(ConfigLayer);

  // Configに依存するHttpClientレイヤー
  const HttpClientLayer = useMemo(
    () => Layer.effect(
      HttpClient,
      Effect.gen(function* () {
        const config = yield* Effect.service(Config);

        return {
          fetch: (path) => Effect.tryPromise({
            try: () => fetch(`${config.apiUrl}${path}`).then(r => r.json()),
            catch: (e) => new Error(String(e))
          })
        };
      })
    ),
    []
  );

  // HttpClientLayerは、ConfigのContextを必要とする
  const httpResult = useLayer(HttpClientLayer, {
    runtime: configResult.context
      ? Runtime.defaultRuntime.pipe(
          Runtime.provideContext(configResult.context)
        )
      : undefined
  });

  if (configResult.loading || httpResult.loading) {
    return <div>Loading...</div>;
  }

  if (configResult.error || httpResult.error) {
    return <div>Error initializing</div>;
  }

  // HttpClientを使用
  const { data } = useEffectQuery(
    Effect.gen(function* () {
      if (!httpResult.context) return null;

      const client = Context.get(httpResult.context, HttpClient);
      return yield* client.fetch('/data');
    }),
    [httpResult.context]
  );

  return <div>{JSON.stringify(data)}</div>;
}
```

### エフェクトベースのLayer構築

```typescript
class DatabaseConnection extends Context.Tag('DatabaseConnection')<
  DatabaseConnection,
  {
    readonly query: (sql: string) => Effect.Effect<any[], Error>;
    readonly close: () => Effect.Effect<void, never>;
  }
>() {}

function DatabaseComponent() {
  // Effectを使ってLayerを構築（非同期初期化）
  const DatabaseLayer = useMemo(
    () => Layer.effect(
      DatabaseConnection,
      Effect.gen(function* () {
        // データベース接続を初期化
        console.log('Connecting to database...');
        yield* Effect.sleep('1 second'); // 接続時間をシミュレート

        const connection = yield* Effect.tryPromise({
          try: async () => {
            // 実際の接続ロジック
            return {
              query: async (sql: string) => {
                // クエリ実行
                return [];
              },
              close: async () => {
                // 接続クローズ
              }
            };
          },
          catch: (e) => new Error(`Failed to connect: ${e}`)
        });

        return {
          query: (sql) => Effect.tryPromise({
            try: () => connection.query(sql),
            catch: (e) => new Error(String(e))
          }),
          close: () => Effect.promise(() => connection.close())
        };
      })
    ),
    []
  );

  const { context, loading, error } = useLayer(DatabaseLayer);

  if (loading) {
    return (
      <div>
        <Spinner />
        <p>Connecting to database...</p>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return <DatabaseConnectedApp context={context} />;
}
```

### 条件付きLayer提供

```typescript
function ConditionalServiceProvider({ isAdmin }: { isAdmin: boolean }) {
  // 管理者の場合のみAdminサービスを提供
  const layer = useMemo(() => {
    const baseLayer = Layer.merge(DatabaseLayer, LoggerLayer);

    if (isAdmin) {
      return Layer.merge(baseLayer, AdminServiceLayer);
    }

    return baseLayer;
  }, [isAdmin]);

  const { context, loading, error } = useLayer(layer);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;
  if (!context) return null;

  return (
    <EffectServiceProvider value={context}>
      <App />
    </EffectServiceProvider>
  );
}
```

### Layer構築の進捗表示

```typescript
function AppInitializer() {
  const [initStage, setInitStage] = useState('Preparing...');

  const AppLayer = useMemo(
    () => Layer.effect(
      AppServices,
      Effect.gen(function* () {
        setInitStage('Connecting to database...');
        const db = yield* initDatabase();

        setInitStage('Loading configuration...');
        const config = yield* loadConfig();

        setInitStage('Starting services...');
        const services = yield* startServices(db, config);

        setInitStage('Ready!');

        return services;
      })
    ),
    []
  );

  const { context, loading, error } = useLayer(AppLayer);

  if (loading) {
    return (
      <div className="init-screen">
        <ProgressSpinner />
        <p>{initStage}</p>
      </div>
    );
  }

  if (error) {
    return <InitializationError error={error} />;
  }

  return <App context={context} />;
}
```

## 実装詳細

```typescript
import { useState, useEffect, useMemo } from 'react';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Runtime from 'effect/Runtime';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useLayer<R, E = never, RIn = never>(
  layer: Layer.Layer<R, E, RIn>,
  options?: {
    runtime?: Runtime.Runtime<RIn>;
  }
): {
  context: Context.Context<R> | null;
  loading: boolean;
  error: E | null;
} {
  const [state, setState] = useState<{
    context: Context.Context<R> | null;
    loading: boolean;
    error: E | null;
  }>({
    context: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    // Layerを構築
    const buildEffect = Layer.build(layer);

    // ランタイムが提供されている場合はそれを使用
    const runEffect = options?.runtime
      ? Runtime.runPromiseExit(options.runtime)
      : Effect.runPromiseExit;

    runEffect(buildEffect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        // 成功: Contextを設定
        setState({
          context: exit.value,
          loading: false,
          error: null
        });
      } else {
        // 失敗: エラーを設定
        const failure = Cause.failureOption(exit.cause);
        const error = failure._tag === 'Some' ? failure.value : null;

        setState({
          context: null,
          loading: false,
          error
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [layer, options?.runtime]);

  return state;
}
```

### 実装の特徴

- ✅ `Layer.build`によるLayer構築
- ✅ カスタムランタイムのサポート
- ✅ ローディング・エラー状態の管理
- ✅ コンポーネントアンマウント時のクリーンアップ
- ✅ 依存配列による再構築

### エッジケース

#### 1. Layer構築中のアンマウント
```typescript
// cancelled フラグにより状態更新を防ぐ
```

#### 2. Layer構築の失敗
```typescript
// errorが設定され、contextはnullのまま
```

#### 3. Layerの変更
```typescript
// useEffectの依存配列にlayerが含まれ、変更時に再構築
```

#### 4. RInがnever以外のLayer
```typescript
// options.runtimeでコンテキストを提供する必要がある
```

## テストケース

### 基本機能
- ✅ Layerの構築
- ✅ Context の取得
- ✅ 初期ローディング状態
- ✅ 構築完了後のloading更新

### エラーハンドリング
- ✅ Layer構築エラー時のerror設定
- ✅ エラー時のcontextがnull

### 依存関係
- ✅ RInが必要なLayerの構築
- ✅ カスタムランタイムの使用

### 動的変更
- ✅ Layerの変更時の再構築
- ✅ プロップス変更による再構築

### クリーンアップ
- ✅ アンマウント時のクリーンアップ
- ✅ 構築中のアンマウント処理

## EffectProvider との比較

| 機能 | EffectProvider | useLayer |
|------|----------------|----------|
| 用途 | アプリ全体のサービス提供 | コンポーネント内のLayer構築 |
| Context提供 | 自動（Reactコンテキスト） | 手動（返り値を使用） |
| ネスト | 自動マージ | 手動で管理 |
| fallback | ✅ | ❌ |
| onError | ✅ | ❌ |
| 推奨用途 | グローバルサービス | ローカルサービス |

### いつuseLayerを使うべきか

✅ **useLayerを使う場合:**
- コンポーネントスコープのサービス
- プロップスに基づく動的Layer
- Layer構築の進捗を表示したい
- 細かい制御が必要

✅ **EffectProviderを使う場合:**
- アプリ全体のサービス
- グローバルなサービス提供
- ネストされたProvider
- fallback/onErrorが必要

## ベストプラクティス

### 1. useMemoでLayerをメモ化

```typescript
// ✅ Good: Layerをメモ化
const layer = useMemo(() => Layer.succeed(Service, impl), []);

// ❌ Bad: 毎レンダリングで新しいLayer
const layer = Layer.succeed(Service, impl);
```

### 2. プロップスへの依存を明示

```typescript
// ✅ Good: 依存配列を明示
const layer = useMemo(
  () => Layer.succeed(Service, { apiKey }),
  [apiKey]
);

// ❌ Bad: 依存配列が不正確
const layer = useMemo(
  () => Layer.succeed(Service, { apiKey }),
  []
);
```

### 3. エラーハンドリング

```typescript
// ✅ Good: エラー状態を処理
const { context, loading, error } = useLayer(layer);

if (error) {
  return <ErrorDisplay error={error} />;
}

// ❌ Bad: エラーを無視
const { context } = useLayer(layer);
```

## 関連Hooks/Components

- [EffectProvider](./EffectProvider.md) - アプリ全体のLayer提供
- [useService](./useService.md) - サービスの取得
- [useRuntime](./useRuntime.md) - ランタイム作成

## 参考

- [Effect Documentation - Layers](https://effect.website/docs/context-management/layers)
- [Effect Documentation - Layer Build](https://effect.website/docs/context-management/layers#building-layers)
- [Effect Documentation - Context](https://effect.website/docs/context-management/context)
