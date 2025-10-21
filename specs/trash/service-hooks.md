# サービス・依存性注入Hooks

## useService

### 概要
Effect-TSのContext.Tagで定義されたサービスをReactコンポーネントで利用するhook。

### ユースケース
- 依存性注入パターン
- テスト可能なコンポーネント
- サービス指向アーキテクチャ

### API設計

```typescript
function useService<I, S>(
  tag: Context.Tag<I, S>
): S | null
```

### 使用例

```typescript
import { useService } from 'effectts-react';
import { Context } from 'effect';

// サービスの定義
class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], Error>;
    readonly execute: (sql: string) => Effect.Effect<void, Error>;
  }
>() {}

function UserList() {
  const db = useService(Database);

  const loadUsers = async () => {
    if (!db) return;

    const effect = db.query('SELECT * FROM users');
    const users = await Effect.runPromise(effect);
    console.log(users);
  };

  return <button onClick={loadUsers}>Load Users</button>;
}
```

### より複雑な例

```typescript
// 複数のサービスを使用
class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly info: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
  }
>() {}

class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: string) => Effect.Effect<User, NotFoundError>;
    readonly save: (user: User) => Effect.Effect<User, SaveError>;
  }
>() {}

function UserProfile({ userId }: { userId: string }) {
  const logger = useService(Logger);
  const userRepo = useService(UserRepository);

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      if (!logger || !userRepo) {
        throw new Error('Services not available');
      }

      yield* logger.info(`Loading user ${userId}`);
      const user = yield* userRepo.findById(userId);
      yield* logger.info(`User loaded: ${user.name}`);
      return user;
    }),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  if (!data) return null;

  return <div>{data.name}</div>;
}
```

### 実装詳細

```typescript
const ServiceContext = createContext<Context.Context<any>>(Context.empty());

export function useService<I, S>(tag: Context.Tag<I, S>): S | null {
  const context = useContext(ServiceContext);

  try {
    return Context.get(context, tag);
  } catch {
    return null;
  }
}

export function ServiceProvider({
  context,
  children,
}: {
  context: Context.Context<any>;
  children: ReactNode;
}) {
  return (
    <ServiceContext.Provider value={context}>
      {children}
    </ServiceContext.Provider>
  );
}
```

### テストケース
- ✅ サービスの取得
- ✅ サービスが存在しない場合のnull返却
- ✅ 複数サービスの利用
- ✅ ネストされたProvider

---

## useLayer

### 概要
LayerをReactコンポーネントに提供し、子コンポーネントでサービスを利用可能にするhook。

### API設計

```typescript
function useLayer<R, E, RIn>(
  layer: Layer.Layer<R, E, RIn>
): {
  context: Context.Context<R> | null;
  loading: boolean;
  error: E | null;
}
```

### 使用例

```typescript
import { useLayer } from 'effectts-react';
import { Layer } from 'effect';

// レイヤーの定義
const DatabaseLive = Layer.succeed(
  Database,
  {
    query: (sql) => Effect.succeed([]),
    execute: (sql) => Effect.succeed(undefined),
  }
);

const LoggerLive = Layer.succeed(
  Logger,
  {
    info: (msg) => Effect.sync(() => console.log(msg)),
    error: (msg) => Effect.sync(() => console.error(msg)),
  }
);

const AppLayer = Layer.merge(DatabaseLive, LoggerLive);

function App() {
  const { context, loading, error } = useLayer(AppLayer);

  if (loading) return <div>Initializing services...</div>;
  if (error) return <div>Failed to initialize</div>;
  if (!context) return null;

  return (
    <ServiceProvider context={context}>
      <UserList />
    </ServiceProvider>
  );
}
```

### 実装詳細

```typescript
export function useLayer<R, E, RIn>(
  layer: Layer.Layer<R, E, RIn>
): {
  context: Context.Context<R> | null;
  loading: boolean;
  error: E | null;
} {
  const [context, setContext] = useState<Context.Context<R> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);

  useEffect(() => {
    let cancelled = false;

    const effect = Layer.build(layer).pipe(
      Effect.flatMap((ctx) =>
        Effect.sync(() => {
          if (!cancelled) {
            setContext(ctx);
            setLoading(false);
          }
        })
      ),
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
  }, [layer]);

  return { context, loading, error };
}
```

### テストケース
- ✅ レイヤーの構築
- ✅ コンテキストの取得
- ✅ エラーハンドリング
- ✅ 複数レイヤーのマージ
- ✅ クリーンアップ

---

## useProvideService

### 概要
特定のサービスを子コンポーネントに提供するためのシンプルなhook。

### API設計

```typescript
function useProvideService<I, S>(
  tag: Context.Tag<I, S>,
  service: S
): Context.Context<I>
```

### 使用例

```typescript
import { useProvideService } from 'effectts-react';

function App() {
  const logger = useMemo(
    () => ({
      info: (msg: string) => Effect.sync(() => console.log(msg)),
      error: (msg: string) => Effect.sync(() => console.error(msg)),
    }),
    []
  );

  const context = useProvideService(Logger, logger);

  return (
    <ServiceProvider context={context}>
      <MyApp />
    </ServiceProvider>
  );
}
```

### 実装詳細

```typescript
export function useProvideService<I, S>(
  tag: Context.Tag<I, S>,
  service: S
): Context.Context<I> {
  return useMemo(() => Context.make(tag, service), [tag, service]);
}
```

### テストケース
- ✅ サービスの提供
- ✅ メモ化
- ✅ 複数サービスの提供

---

## EffectProvider

### 概要
Reactのコンポーネントツリー全体でEffect-TSのLayerやContextを提供するプロバイダコンポーネント。依存性注入パターンを実現し、子コンポーネントで`useService`を使ってサービスを利用できるようにします。

### ユースケース
- アプリケーション全体での依存性注入
- テスト時のモックサービスの提供
- 環境別の設定の切り替え
- マイクロフロントエンドでの独立したサービススコープ

### API設計

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

### 使用例

#### 基本的な使用例

```typescript
import { EffectProvider } from 'effectts-react';
import { Layer } from 'effect';

// サービスレイヤーの定義
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.tryPromise({
    try: () => fetch('/api/db/query', {
      method: 'POST',
      body: JSON.stringify({ sql })
    }).then(r => r.json()),
    catch: (error) => new DatabaseError({ cause: error })
  }),
  execute: (sql) => Effect.tryPromise({
    try: () => fetch('/api/db/execute', {
      method: 'POST',
      body: JSON.stringify({ sql })
    }).then(r => r.json()),
    catch: (error) => new DatabaseError({ cause: error })
  })
});

const LoggerLive = Layer.succeed(Logger, {
  info: (message) => Effect.sync(() => console.log(`[INFO] ${message}`)),
  error: (message) => Effect.sync(() => console.error(`[ERROR] ${message}`)),
  debug: (message) => Effect.sync(() => console.debug(`[DEBUG] ${message}`))
});

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
      yield* logger.info('Loading users');
      const users = yield* db.query('SELECT * FROM users');
      yield* logger.info(`Loaded ${users.length} users`);
      return users;
    }),
    []
  );

  // ...
}
```

#### ネストされたプロバイダ

```typescript
function App() {
  // アプリケーション全体のサービス
  const AppLayer = Layer.merge(DatabaseLive, LoggerLive);

  return (
    <EffectProvider layer={AppLayer}>
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
  const AdminLayer = Layer.succeed(AdminAPI, {
    deleteUser: (id) => Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);
      yield* logger.info(`Deleting user ${id}`);
      return yield* db.execute(`DELETE FROM users WHERE id = '${id}'`);
    })
  });

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

  // ...
}
```

#### 環境別の設定

```typescript
// 開発環境用のモックレイヤー
const MockDatabaseLayer = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([
    { id: '1', name: 'Mock User 1' },
    { id: '2', name: 'Mock User 2' }
  ]),
  execute: (sql) => Effect.succeed(undefined)
});

// 本番環境用のレイヤー
const ProductionDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);
    const connection = yield* Effect.tryPromise({
      try: () => createConnection(config.database),
      catch: (error) => new DatabaseError({ cause: error })
    });

    return {
      query: (sql) => Effect.tryPromise({
        try: () => connection.query(sql),
        catch: (error) => new QueryError({ sql, cause: error })
      }),
      execute: (sql) => Effect.tryPromise({
        try: () => connection.execute(sql),
        catch: (error) => new ExecuteError({ sql, cause: error })
      })
    };
  })
);

function App() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const dbLayer = isDevelopment ? MockDatabaseLayer : ProductionDatabaseLayer;

  const AppLayer = Layer.merge(dbLayer, LoggerLive);

  return (
    <EffectProvider layer={AppLayer}>
      <MyApp />
    </EffectProvider>
  );
}
```

#### テスト時のモック

```typescript
import { render, screen } from '@testing-library/react';

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
});
```

### 実装詳細

```typescript
const EffectLayerContext = createContext<Context.Context<any> | null>(null);

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
  const parentContext = useContext(EffectLayerContext);
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

    const effect = Layer.build(layer).pipe(
      Effect.flatMap((ctx) =>
        Effect.sync(() => {
          if (!cancelled) {
            // 親のコンテキストとマージ
            const mergedContext = parentContext
              ? Context.merge(parentContext, ctx)
              : ctx;

            setState({
              context: mergedContext,
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
              context: null,
              loading: false,
              error: err
            });
            onError?.(err);
          }
        })
      )
    );

    Effect.runPromise(effect);

    return () => {
      cancelled = true;
    };
  }, [layer, parentContext, onError]);

  if (state.loading) {
    return fallback ? <>{fallback}</> : null;
  }

  if (state.error || !state.context) {
    return null;
  }

  return (
    <EffectLayerContext.Provider value={state.context}>
      {children}
    </EffectLayerContext.Provider>
  );
}

// useService の実装を更新
export function useService<I, S>(tag: Context.Tag<I, S>): S | null {
  const context = useContext(EffectLayerContext);

  if (!context) {
    return null;
  }

  try {
    return Context.get(context, tag);
  } catch {
    return null;
  }
}
```

### 実装の特徴

- ✅ Layerの自動構築とコンテキスト化
- ✅ 親プロバイダとのコンテキストマージ
- ✅ ローディング状態の管理とfallback表示
- ✅ エラーハンドリングとonErrorコールバック
- ✅ ネストされたプロバイダのサポート
- ✅ クリーンアップ処理

### テストケース

- ✅ Layerの構築と提供
- ✅ 子コンポーネントでのuseServiceによるサービス取得
- ✅ ネストされたプロバイダのコンテキストマージ
- ✅ fallbackの表示
- ✅ エラー時のonErrorコールバック実行
- ✅ Layerの変更時の再構築
- ✅ アンマウント時のクリーンアップ

---

## useEffectContext

### 概要
現在のコンポーネントツリーで利用可能なEffect Contextを直接取得するhook。複数のサービスを一度に取得したり、Contextを手動で操作する高度なユースケースに使用します。

### API設計

```typescript
function useEffectContext<R>(): Context.Context<R> | null
```

### 使用例

```typescript
import { useEffectContext } from 'effectts-react';
import { Context } from 'effect';

function AdvancedComponent() {
  const context = useEffectContext();

  const handleAction = () => {
    if (!context) return;

    const effect = Effect.gen(function* () {
      // コンテキストを手動で提供
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      yield* logger.info('Performing action');
      return yield* db.query('SELECT * FROM data');
    }).pipe(
      Effect.provide(context)
    );

    Effect.runPromise(effect).then(console.log);
  };

  return <button onClick={handleAction}>Execute</button>;
}
```

### 実装詳細

```typescript
export function useEffectContext<R = any>(): Context.Context<R> | null {
  return useContext(EffectLayerContext) as Context.Context<R> | null;
}
```

### テストケース

- ✅ コンテキストの取得
- ✅ Provider外でのnull返却
- ✅ 手動でのEffect.provide使用
- ✅ 型安全性の保証

---

## 統合パターンとベストプラクティス

### 1. アプリケーション全体での設定

```typescript
// layers.ts - 全てのレイヤーを定義
export const ConfigLayer = Layer.effect(
  Config,
  Effect.sync(() => ({
    apiUrl: process.env.REACT_APP_API_URL,
    apiKey: process.env.REACT_APP_API_KEY
  }))
);

export const DatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);
    return makeDatabaseService(config.apiUrl);
  })
);

export const LoggerLayer = Layer.succeed(Logger, makeLoggerService());

export const AppLayer = Layer.mergeAll(
  ConfigLayer,
  DatabaseLayer,
  LoggerLayer
);

// App.tsx
function App() {
  return (
    <EffectProvider layer={AppLayer} fallback={<SplashScreen />}>
      <RouterProvider router={router} />
    </EffectProvider>
  );
}
```

### 2. 機能別のレイヤー分離

```typescript
// features/auth/layers.ts
export const AuthLayer = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const db = yield* Effect.service(Database);
    return makeAuthService(db);
  })
);

// features/payments/layers.ts
export const PaymentLayer = Layer.effect(
  PaymentService,
  Effect.gen(function* () {
    const config = yield* Effect.service(Config);
    return makePaymentService(config.paymentApiKey);
  })
);

// App.tsx
const AppLayer = Layer.mergeAll(
  CoreLayer,
  AuthLayer,
  PaymentLayer
);
```

### 3. 動的なレイヤー切り替え

```typescript
function App() {
  const [environment, setEnvironment] = useState<'development' | 'production'>('development');

  const layer = useMemo(() => {
    return environment === 'development'
      ? DevelopmentLayer
      : ProductionLayer;
  }, [environment]);

  return (
    <EffectProvider layer={layer}>
      <EnvironmentToggle onChange={setEnvironment} />
      <MyApp />
    </EffectProvider>
  );
}
```

### 4. Suspense との統合

```typescript
function App() {
  return (
    <EffectProvider
      layer={AppLayer}
      fallback={
        <Suspense fallback={<LoadingSpinner />}>
          <LazyInitialization />
        </Suspense>
      }
    >
      <MyApp />
    </EffectProvider>
  );
}
```

## 関連Hooks

- [useService](#useservice) - サービスの取得
- [useLayer](#uselayer) - レイヤーの構築
- [useEffectRun](./effect-execution-hooks.md#useeffectrun) - カスタムランタイムでの実行
- [useManagedRuntime](./runtime-hooks.md#usemanagedruntime) - ランタイム管理
