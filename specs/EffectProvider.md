# EffectProvider

**ステータス**: 📋 提案中

## 概要

Reactのコンポーネントツリー全体でEffect-TSのLayerを提供するプロバイダコンポーネント。依存性注入パターンを実現し、子コンポーネントで`useService`を使ってサービスを利用できるようにします。

## ユースケース

- アプリケーション全体での依存性注入
- テスト時のモックサービスの提供
- 環境別の設定の切り替え
- マイクロフロントエンドでの独立したサービススコープ
- ネストされたサービス提供（親子関係）
- Layer構築の宣言的管理

## API設計

```typescript
function EffectProvider<R, E = never>({
  layer,
  children,
  fallback,
  onError
}: {
  layer: Layer.Layer<R, E, never>;
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: E) => void;
}): ReactElement
```

**パラメータ:**
- `layer`: 提供するEffect Layer
- `children`: 子コンポーネント
- `fallback`: Layer構築中に表示するコンポーネント（オプション）
- `onError`: Layer構築エラー時のコールバック（オプション）

**動作:**
1. Layerを構築してContextを生成
2. 構築中は`fallback`を表示
3. 成功したらContextをReactコンテキストで提供
4. エラー時は`onError`を呼び出し

## 使用例

### 基本的な使用例

```typescript
import { EffectProvider } from 'effectts-react';
import { Layer, Effect, Context } from 'effect';

// サービスの定義
class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], DatabaseError>;
    readonly execute: (sql: string) => Effect.Effect<void, DatabaseError>;
  }
>() {}

class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly info: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
    readonly debug: (message: string) => Effect.Effect<void>;
  }
>() {}

// サービスの実装（Live）
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.tryPromise({
    try: () => fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    }).then(r => r.json()),
    catch: (error) => new DatabaseError({ cause: error })
  }),
  execute: (sql) => Effect.tryPromise({
    try: () => fetch('/api/db/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    }),
    catch: (error) => new DatabaseError({ cause: error })
  })
});

const LoggerLive = Layer.succeed(Logger, {
  info: (msg) => Effect.sync(() => console.log(`[INFO] ${msg}`)),
  error: (msg) => Effect.sync(() => console.error(`[ERROR] ${msg}`)),
  debug: (msg) => Effect.sync(() => console.debug(`[DEBUG] ${msg}`))
});

// Layerをマージ
const AppLayer = Layer.merge(DatabaseLive, LoggerLive);

function App() {
  return (
    <EffectProvider
      layer={AppLayer}
      fallback={<div>Initializing services...</div>}
      onError={(error) => {
        console.error('Failed to initialize app layer:', error);
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<UserList />} />
        </Routes>
      </Router>
    </EffectProvider>
  );
}

// 子コンポーネントでサービスを利用
function UserList() {
  const db = useService(Database);
  const logger = useService(Logger);

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      if (!db || !logger) {
        return yield* Effect.fail(new Error('Services not available'));
      }

      yield* logger.info('Loading users');
      const users = yield* db.query('SELECT * FROM users');
      yield* logger.info(`Loaded ${users.length} users`);
      return users;
    }),
    []
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### ネストされたProvider

```typescript
function App() {
  // アプリケーション全体の基本サービス
  const CoreLayer = Layer.merge(DatabaseLive, LoggerLive);

  return (
    <EffectProvider layer={CoreLayer}>
      <Router>
        <Routes>
          <Route path="/admin" element={<AdminSection />} />
          <Route path="/user" element={<UserSection />} />
        </Routes>
      </Router>
    </EffectProvider>
  );
}

function AdminSection() {
  // Admin専用のサービスを追加
  class AdminAPI extends Context.Tag('AdminAPI')<
    AdminAPI,
    {
      readonly deleteUser: (id: string) => Effect.Effect<void, DeleteError>;
      readonly banUser: (id: string) => Effect.Effect<void, BanError>;
    }
  >() {}

  const AdminLayer = Layer.effect(
    AdminAPI,
    Effect.gen(function* () {
      // 親からサービスを取得
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      return {
        deleteUser: (id) => Effect.gen(function* () {
          yield* logger.info(`Admin: Deleting user ${id}`);
          yield* db.execute(`DELETE FROM users WHERE id = '${id}'`);
        }),
        banUser: (id) => Effect.gen(function* () {
          yield* logger.info(`Admin: Banning user ${id}`);
          yield* db.execute(`UPDATE users SET banned = true WHERE id = '${id}'`);
        })
      };
    })
  );

  return (
    <EffectProvider layer={AdminLayer}>
      <AdminDashboard />
    </EffectProvider>
  );
}

function AdminDashboard() {
  // 親と子両方のサービスを利用可能
  const db = useService(Database);        // 親から
  const logger = useService(Logger);      // 親から
  const adminAPI = useService(AdminAPI);  // 子から

  const { execute: deleteUser, loading } = useEffectCallback(
    (userId: string) =>
      Effect.gen(function* () {
        if (!adminAPI) {
          return yield* Effect.fail(new Error('AdminAPI not available'));
        }
        yield* adminAPI.deleteUser(userId);
      }),
    {
      onSuccess: () => toast.success('User deleted')
    }
  );

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <button onClick={() => deleteUser('user-123')} disabled={loading}>
        Delete User
      </button>
    </div>
  );
}
```

### 環境別の設定

```typescript
// 開発環境用のモックレイヤー
const MockDatabaseLayer = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([
    { id: '1', name: 'Mock User 1', email: 'user1@example.com' },
    { id: '2', name: 'Mock User 2', email: 'user2@example.com' }
  ]),
  execute: (sql) => Effect.succeed(undefined)
});

// 本番環境用のレイヤー
class Config extends Context.Tag('Config')<
  Config,
  {
    readonly apiUrl: string;
    readonly apiKey: string;
  }
>() {}

const ConfigLive = Layer.succeed(Config, {
  apiUrl: process.env.REACT_APP_API_URL!,
  apiKey: process.env.REACT_APP_API_KEY!
});

const ProductionDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);

    return {
      query: (sql) => Effect.tryPromise({
        try: () => fetch(`${config.apiUrl}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({ sql })
        }).then(r => r.json()),
        catch: (e) => new DatabaseError({ cause: e })
      }),
      execute: (sql) => Effect.tryPromise({
        try: () => fetch(`${config.apiUrl}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({ sql })
        }),
        catch: (e) => new DatabaseError({ cause: e })
      })
    };
  })
);

function App() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const AppLayer = isDevelopment
    ? Layer.merge(MockDatabaseLayer, LoggerLive)
    : Layer.mergeAll(ConfigLive, ProductionDatabaseLayer, LoggerLive);

  return (
    <EffectProvider
      layer={AppLayer}
      fallback={<SplashScreen />}
      onError={(error) => {
        console.error('App initialization failed:', error);
        Sentry.captureException(error);
      }}
    >
      <MyApp />
    </EffectProvider>
  );
}
```

### テスト時のモック

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('UserList', () => {
  it('displays users from the database', async () => {
    // テスト用のモックレイヤー
    const MockLayer = Layer.succeed(Database, {
      query: (sql) => Effect.succeed([
        { id: '1', name: 'Test User 1' },
        { id: '2', name: 'Test User 2' }
      ]),
      execute: (sql) => Effect.succeed(undefined)
    });

    render(
      <EffectProvider layer={MockLayer}>
        <UserList />
      </EffectProvider>
    );

    // ユーザーが表示されることを確認
    expect(await screen.findByText('Test User 1')).toBeInTheDocument();
    expect(await screen.findByText('Test User 2')).toBeInTheDocument();
  });

  it('handles database errors gracefully', async () => {
    // エラーを返すモックレイヤー
    const ErrorLayer = Layer.succeed(Database, {
      query: (sql) => Effect.fail(new DatabaseError({ message: 'Connection failed' })),
      execute: (sql) => Effect.fail(new DatabaseError({ message: 'Connection failed' }))
    });

    render(
      <EffectProvider layer={ErrorLayer}>
        <UserList />
      </EffectProvider>
    );

    // エラーメッセージが表示されることを確認
    expect(await screen.findByText(/Connection failed/i)).toBeInTheDocument();
  });

  it('shows fallback during initialization', () => {
    const SlowLayer = Layer.effect(
      Database,
      Effect.gen(function* () {
        yield* Effect.sleep('2 seconds');
        return mockDatabase;
      })
    );

    render(
      <EffectProvider
        layer={SlowLayer}
        fallback={<div>Loading services...</div>}
      >
        <UserList />
      </EffectProvider>
    );

    expect(screen.getByText('Loading services...')).toBeInTheDocument();
  });
});
```

### 動的なレイヤー切り替え

```typescript
function App() {
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');

  const layer = useMemo(() => {
    switch (environment) {
      case 'development':
        return Layer.merge(MockDatabaseLayer, MockLoggerLayer);
      case 'staging':
        return Layer.merge(StagingDatabaseLayer, LoggerLive);
      case 'production':
        return Layer.merge(ProductionDatabaseLayer, LoggerLive);
    }
  }, [environment]);

  return (
    <div>
      <EnvironmentSelector value={environment} onChange={setEnvironment} />
      <EffectProvider
        layer={layer}
        fallback={<div>Switching environment...</div>}
      >
        <MyApp />
      </EffectProvider>
    </div>
  );
}
```

### 複雑なLayer依存関係

```typescript
// 各サービスの定義
class Config extends Context.Tag('Config')<Config, AppConfig>() {}
class Database extends Context.Tag('Database')<Database, DatabaseService>() {}
class Cache extends Context.Tag('Cache')<Cache, CacheService>() {}
class UserRepository extends Context.Tag('UserRepository')<UserRepository, UserRepo>() {}
class AuthService extends Context.Tag('AuthService')<AuthService, Auth>() {}

// Layer構築（依存関係のある順番）
const ConfigLayer = Layer.succeed(Config, {
  apiUrl: process.env.REACT_APP_API_URL!,
  cacheExpiration: 3600
});

const DatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);
    // Configに依存
    return createDatabaseService(config.apiUrl);
  })
);

const CacheLayer = Layer.effect(
  Cache,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);
    // Configに依存
    return createCacheService(config.cacheExpiration);
  })
);

const UserRepositoryLayer = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Effect.service(Database);
    const cache = yield* Effect.service(Cache);
    // DatabaseとCacheに依存
    return createUserRepository(db, cache);
  })
);

const AuthServiceLayer = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const userRepo = yield* Effect.service(UserRepository);
    // UserRepositoryに依存
    return createAuthService(userRepo);
  })
);

// すべてをマージ（Effect-TSが依存関係を解決）
const AppLayer = Layer.mergeAll(
  ConfigLayer,
  DatabaseLayer,
  CacheLayer,
  UserRepositoryLayer,
  AuthServiceLayer
);

function App() {
  return (
    <EffectProvider layer={AppLayer}>
      <AppRouter />
    </EffectProvider>
  );
}
```

### Suspenseとの統合

```typescript
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <EffectProvider
        layer={AppLayer}
        fallback={
          <Suspense fallback={<LoadingSpinner />}>
            <LazyInitialization />
          </Suspense>
        }
        onError={(error) => {
          // エラーをトラッキングサービスに送信
          trackError(error);
        }}
      >
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
      </EffectProvider>
    </ErrorBoundary>
  );
}
```

## 実装詳細

```typescript
import { createContext, useContext, useState, useEffect, ReactNode, ReactElement } from 'react';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

// Reactコンテキストの作成
const EffectServiceContext = createContext<Context.Context<any> | null>(null);

export function EffectProvider<R, E = never>({
  layer,
  children,
  fallback,
  onError
}: {
  layer: Layer.Layer<R, E, never>;
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: E) => void;
}): ReactElement {
  // 親のコンテキストを取得（ネスト対応）
  const parentContext = useContext(EffectServiceContext);

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

    // Layerを構築してContextを生成
    const effect = Layer.build(layer).pipe(
      Effect.flatMap((ctx) =>
        Effect.sync(() => {
          if (cancelled) return;

          // 親のコンテキストとマージ
          const mergedContext = parentContext
            ? Context.merge(parentContext, ctx)
            : ctx;

          setState({
            context: mergedContext,
            loading: false,
            error: null
          });
        })
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          if (cancelled) return;

          setState({
            context: null,
            loading: false,
            error: err
          });

          onError?.(err);
        })
      )
    );

    // Effectを実行
    Effect.runPromise(effect).catch(() => {
      // エラーは既にcatchAllで処理済み
    });

    return () => {
      cancelled = true;
    };
  }, [layer, parentContext, onError]);

  // ローディング中はfallbackを表示
  if (state.loading) {
    return fallback ? <>{fallback}</> : null;
  }

  // エラーまたはコンテキストがない場合は何も表示しない
  if (state.error || !state.context) {
    return null;
  }

  // コンテキストを提供
  return (
    <EffectServiceContext.Provider value={state.context}>
      {children}
    </EffectServiceContext.Provider>
  );
}

// useServiceで使用するためにコンテキストをエクスポート
export { EffectServiceContext };
```

### 実装の特徴

- ✅ `Layer.build`によるLayer構築
- ✅ 親コンテキストとの自動マージ（ネスト対応）
- ✅ ローディング状態の管理
- ✅ エラーハンドリングとコールバック
- ✅ コンポーネントアンマウント時のクリーンアップ
- ✅ Reactコンテキストによる提供

### エッジケース

#### 1. Layer構築中のアンマウント
```typescript
// cancelled フラグにより、アンマウント後の状態更新を防ぐ
```

#### 2. Layer構築の失敗
```typescript
// errorにセットされ、onErrorコールバックが呼ばれる
// childrenは表示されない
```

#### 3. ネストされたProvider
```typescript
// 親のコンテキストと子のコンテキストが自動的にマージされる
// 同じサービスがある場合、子が優先される
```

#### 4. Layerの変更
```typescript
// useEffectの依存配列にlayerが含まれているため、
// layerが変わると再構築される
```

## テストケース

### 基本機能
- ✅ Layerの構築と提供
- ✅ 子コンポーネントでのuseService使用
- ✅ fallbackの表示
- ✅ Layer構築完了後のchildren表示

### エラーハンドリング
- ✅ Layer構築エラー時のonError呼び出し
- ✅ エラー時にchildrenが表示されないこと
- ✅ エラー後の状態

### ネスト
- ✅ ネストされたProviderのコンテキストマージ
- ✅ 親と子のサービス両方へのアクセス
- ✅ 子のサービスが親のサービスを上書き

### 動的変更
- ✅ Layerの変更時の再構築
- ✅ 環境切り替え時の動作

### クリーンアップ
- ✅ アンマウント時のクリーンアップ
- ✅ 構築中のアンマウントの処理

### テスト統合
- ✅ テストでのモックLayer提供
- ✅ 複数のテストケースでの異なるLayer使用

## ベストプラクティス

### 1. Layerの構成

```typescript
// ✅ Good: 関心の分離
const DatabaseLayer = Layer.succeed(Database, createDatabaseService());
const LoggerLayer = Layer.succeed(Logger, createLoggerService());
const AppLayer = Layer.merge(DatabaseLayer, LoggerLayer);

// ❌ Bad: すべてを1つのLayerに
const AppLayer = Layer.succeed(/* すべてのサービス */);
```

### 2. エラーハンドリング

```typescript
// ✅ Good: エラーをログ/トラッキング
<EffectProvider
  layer={AppLayer}
  onError={(error) => {
    console.error('Layer build failed:', error);
    Sentry.captureException(error);
  }}
>

// ❌ Bad: エラーを無視
<EffectProvider layer={AppLayer}>
```

### 3. Fallbackの提供

```typescript
// ✅ Good: 適切なfallback
<EffectProvider
  layer={AppLayer}
  fallback={<AppLoadingScreen />}
>

// ⚠️ OK: fallbackなし（短時間の構築の場合）
<EffectProvider layer={SimpleLayer}>
```

### 4. テスト

```typescript
// ✅ Good: テスト用のヘルパー
const createTestProvider = (overrides = {}) => {
  const testLayer = Layer.merge(
    DefaultMockLayer,
    Layer.succeed(/* テスト固有のオーバーライド */)
  );

  return ({ children }) => (
    <EffectProvider layer={testLayer}>
      {children}
    </EffectProvider>
  );
};
```

## 関連Hooks/Components

- [useService](./useService.md) - Providerから提供されたサービスの取得
- [useLayer](./useLayer.md) - Layerの構築（コンポーネント内）
- [useEffectContext](./useEffectContext.md) - Context全体の取得

## 参考

- [Effect Documentation - Layers](https://effect.website/docs/context-management/layers)
- [Effect Documentation - Context](https://effect.website/docs/context-management/context)
- [React Context API](https://react.dev/reference/react/createContext)
