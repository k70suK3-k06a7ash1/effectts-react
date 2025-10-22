# useRuntimeContext

**ステータス**: ✅ 実装済み

## 概要

Reactコンテキストを通じてManagedRuntimeを取得するhook。`RuntimeProvider`と組み合わせて使用し、アプリケーション全体でランタイムを共有します。

## ユースケース

- アプリケーション全体でのランタイム共有
- コンポーネント間でのランタイムアクセス
- Prop drillingの回避
- グローバルなEffect実行環境
- テスト時のランタイム注入
- カスタムフックでのランタイム利用

## API設計

```typescript
// Provider
function RuntimeProvider<R = any, E = never>({
  runtime,
  children
}: {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  children: ReactNode;
}): ReactElement

// Consumer
function useRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<R, never>
```

**RuntimeProvider パラメータ:**
- `runtime`: 提供するManagedRuntime
- `children`: 子コンポーネント

**useRuntimeContext 戻り値:**
- `ManagedRuntime.ManagedRuntime<R, never>`: 提供されたランタイム（なければエラー）

## 使用例

### 基本的な使用例

```typescript
import {
  RuntimeProvider,
  useRuntimeContext,
  useManagedRuntime
} from 'effectts-react';
import { Effect, Layer, Context } from 'effect';

class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], Error>;
  }
>() {}

// App.tsx - Providerでランタイムを提供
function App() {
  const DatabaseLayer = Layer.succeed(Database, {
    query: (sql) => Effect.tryPromise({
      try: () => fetch('/api/query', {
        method: 'POST',
        body: JSON.stringify({ sql })
      }).then(r => r.json()),
      catch: (e) => new Error(String(e))
    })
  });

  const { runtime, loading, error } = useManagedRuntime(DatabaseLayer);

  if (loading) {
    return <div>Initializing...</div>;
  }

  if (error || !runtime) {
    return <div>Failed to initialize</div>;
  }

  return (
    <RuntimeProvider runtime={runtime}>
      <UserList />
    </RuntimeProvider>
  );
}

// UserList.tsx - ランタイムを取得して使用
function UserList() {
  const runtime = useRuntimeContext();

  const [users, setUsers] = useState([]);

  const loadUsers = async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      return yield* db.query('SELECT * FROM users');
    });

    // ランタイムでEffectを実行
    const result = await runtime.runPromise(effect);
    setUsers(result);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### カスタムフックでのランタイム利用

```typescript
// hooks/useDatabase.ts
function useDatabase() {
  const runtime = useRuntimeContext();

  const query = useCallback(
    async (sql: string) => {
      const effect = Effect.gen(function* () {
        const db = yield* Effect.service(Database);
        return yield* db.query(sql);
      });

      return await runtime.runPromise(effect);
    },
    [runtime]
  );

  return { query };
}

// UserList.tsx
function UserList() {
  const { query } = useDatabase();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    query('SELECT * FROM users').then(setUsers);
  }, [query]);

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### ネストされたProvider

```typescript
function App() {
  const { runtime: appRuntime } = useManagedRuntime(AppLayer);

  if (!appRuntime) return <div>Loading...</div>;

  return (
    <RuntimeProvider runtime={appRuntime}>
      <Router>
        <Routes>
          <Route path="/admin" element={<AdminSection />} />
          <Route path="/" element={<PublicSection />} />
        </Routes>
      </Router>
    </RuntimeProvider>
  );
}

function AdminSection() {
  // 追加のAdminレイヤー
  const { runtime: adminRuntime } = useManagedRuntime(AdminLayer);

  if (!adminRuntime) return <div>Loading admin...</div>;

  // Admin専用のランタイムを提供
  return (
    <RuntimeProvider runtime={adminRuntime}>
      <AdminDashboard />
    </RuntimeProvider>
  );
}

function AdminDashboard() {
  // 最も近いProviderのランタイム（AdminRuntime）を取得
  const runtime = useRuntimeContext();

  // Adminサービスを使用
  const deleteUser = async (userId: string) => {
    const effect = Effect.gen(function* () {
      const admin = yield* Effect.service(AdminService);
      yield* admin.deleteUser(userId);
    });

    await runtime.runPromise(effect);
  };

  return <div>{/* Admin UI */}</div>;
}
```

### useEffectQueryとの統合

```typescript
function UserProfile({ userId }: { userId: string }) {
  const runtime = useRuntimeContext();

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      yield* logger.info(`Loading user ${userId}`);
      const user = yield* db.query(`SELECT * FROM users WHERE id = '${userId}'`);

      return user[0];
    }),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data?.name}</h1>
      <p>{data?.email}</p>
    </div>
  );
}
```

### Fiberの管理

```typescript
function BackgroundTaskManager() {
  const runtime = useRuntimeContext();
  const [fibers, setFibers] = useState<Fiber.RuntimeFiber<any, any>[]>([]);

  const startTask = (taskId: string) => {
    const task = Effect.gen(function* () {
      const service = yield* Effect.service(TaskService);

      for (let i = 0; i < 100; i++) {
        yield* Effect.sleep('100 millis');
        yield* service.updateProgress(taskId, i);
      }

      return { taskId, status: 'completed' };
    });

    // Fiberとして実行
    const fiber = runtime.runFork(task);

    setFibers(prev => [...prev, fiber]);

    return fiber;
  };

  const cancelTask = (fiber: Fiber.RuntimeFiber<any, any>) => {
    const interrupt = Fiber.interrupt(fiber);
    runtime.runPromise(interrupt);

    setFibers(prev => prev.filter(f => f !== fiber));
  };

  const cancelAll = () => {
    fibers.forEach(fiber => cancelTask(fiber));
  };

  return (
    <div>
      <button onClick={() => startTask(`task-${Date.now()}`)}>
        Start Task
      </button>
      <button onClick={cancelAll}>
        Cancel All Tasks
      </button>
      <p>Active tasks: {fibers.length}</p>
    </div>
  );
}
```

### テストでのランタイム注入

```typescript
// test-utils.tsx
export function createTestWrapper(layer: Layer.Layer<any, any>) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    const { runtime } = useManagedRuntime(layer);

    if (!runtime) {
      return <div>Loading test runtime...</div>;
    }

    return (
      <RuntimeProvider runtime={runtime}>
        {children}
      </RuntimeProvider>
    );
  };
}

// UserList.test.tsx
describe('UserList', () => {
  it('should render users', async () => {
    const MockLayer = Layer.succeed(Database, {
      query: (sql) => Effect.succeed([
        { id: '1', name: 'Test User 1' },
        { id: '2', name: 'Test User 2' }
      ])
    });

    const TestWrapper = createTestWrapper(MockLayer);

    render(
      <TestWrapper>
        <UserList />
      </TestWrapper>
    );

    expect(await screen.findByText('Test User 1')).toBeInTheDocument();
    expect(await screen.findByText('Test User 2')).toBeInTheDocument();
  });
});
```

### 環境別のランタイム切り替え

```typescript
function App() {
  const [environment, setEnvironment] = useState<'dev' | 'prod'>('dev');

  const layer = useMemo(() => {
    return environment === 'dev' ? DevLayer : ProdLayer;
  }, [environment]);

  const { runtime } = useManagedRuntime(layer);

  if (!runtime) return <div>Loading...</div>;

  return (
    <RuntimeProvider runtime={runtime}>
      <div>
        <EnvironmentSwitcher
          current={environment}
          onChange={setEnvironment}
        />
        <AppContent />
      </div>
    </RuntimeProvider>
  );
}

function AppContent() {
  const runtime = useRuntimeContext();

  // 現在のランタイムに応じて動作が変わる
  const performAction = async () => {
    const effect = Effect.gen(function* () {
      const config = yield* Effect.service(Config);
      console.log('Running in:', config.environment);

      // 環境に応じた処理
    });

    await runtime.runPromise(effect);
  };

  return <button onClick={performAction}>Perform Action</button>;
}
```

### エラーバウンダリとの統合

```typescript
class RuntimeErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Runtime Error</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { runtime, error } = useManagedRuntime(AppLayer);

  if (error) {
    return <div>Failed to create runtime: {String(error)}</div>;
  }

  if (!runtime) {
    return <div>Initializing...</div>;
  }

  return (
    <RuntimeErrorBoundary>
      <RuntimeProvider runtime={runtime}>
        <AppRouter />
      </RuntimeProvider>
    </RuntimeErrorBoundary>
  );
}
```

### グローバルなランタイムヘルパー

```typescript
// runtime-helpers.ts
let globalRuntime: ManagedRuntime.ManagedRuntime<any, any> | null = null;

export function setGlobalRuntime(runtime: ManagedRuntime.ManagedRuntime<any, any>) {
  globalRuntime = runtime;
}

export function getGlobalRuntime() {
  if (!globalRuntime) {
    throw new Error('Global runtime not initialized');
  }
  return globalRuntime;
}

// App.tsx
function App() {
  const { runtime } = useManagedRuntime(AppLayer);

  useEffect(() => {
    if (runtime) {
      setGlobalRuntime(runtime);
    }
  }, [runtime]);

  if (!runtime) return <div>Loading...</div>;

  return (
    <RuntimeProvider runtime={runtime}>
      <AppContent />
    </RuntimeProvider>
  );
}

// 他のファイルからグローバルランタイムを使用
// (非Reactコンポーネントから)
export async function performBackgroundTask() {
  const runtime = getGlobalRuntime();

  const effect = Effect.gen(function* () {
    // バックグラウンドタスク
  });

  return await runtime.runPromise(effect);
}
```

## 実装詳細

```typescript
import { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as ManagedRuntime from 'effect/ManagedRuntime';

// Reactコンテキストの作成
const RuntimeContext = createContext<ManagedRuntime.ManagedRuntime<any, any> | null>(null);

/**
 * RuntimeProvider - ManagedRuntimeを子コンポーネントに提供
 */
export function RuntimeProvider<R = any, E = never>({
  runtime,
  children
}: {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  children: ReactNode;
}): ReactElement {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

/**
 * useRuntimeContext - 提供されたManagedRuntimeを取得
 */
export function useRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<R, never> {
  const runtime = useContext(RuntimeContext);

  if (!runtime) {
    throw new Error(
      'useRuntimeContext must be used within a RuntimeProvider. ' +
      'Make sure your component is wrapped with <RuntimeProvider runtime={...}>.'
    );
  }

  return runtime as ManagedRuntime.ManagedRuntime<R, never>;
}

/**
 * useOptionalRuntimeContext - ランタイムがない場合はnullを返す
 */
export function useOptionalRuntimeContext<R = any>(): ManagedRuntime.ManagedRuntime<R, never> | null {
  return useContext(RuntimeContext) as ManagedRuntime.ManagedRuntime<R, never> | null;
}
```

### 実装の特徴

- ✅ ReactのContextを使用した実装
- ✅ 型安全なランタイムアクセス
- ✅ Provider外での使用時のわかりやすいエラーメッセージ
- ✅ オプショナル版（`useOptionalRuntimeContext`）の提供
- ✅ シンプルなAPI

### エッジケース

#### 1. Provider外での使用
```typescript
// エラーメッセージが表示され、デバッグが容易
// "useRuntimeContext must be used within a RuntimeProvider"
```

#### 2. runtimeがnullのProvider
```typescript
// <RuntimeProvider runtime={null}>の場合、
// useRuntimeContextはエラーを投げる
```

#### 3. ネストされたProvider
```typescript
// 最も近いProviderのruntimeが使用される
```

## テストケース

### 基本機能
- ✅ Providerによるランタイムの提供
- ✅ useRuntimeContextによるランタイムの取得
- ✅ 子コンポーネントからのアクセス

### エラーハンドリング
- ✅ Provider外での使用時のエラー
- ✅ エラーメッセージの内容
- ✅ nullランタイムのProvider使用時のエラー

### ネスト
- ✅ ネストされたProviderでの動作
- ✅ 最も近いProviderのランタイム取得

### オプショナル版
- ✅ useOptionalRuntimeContextの動作
- ✅ Provider外でのnull返却

## useManagedRuntime との組み合わせパターン

### 推奨パターン

```typescript
// ✅ Good: App全体でランタイムを管理
function App() {
  const { runtime, loading, error } = useManagedRuntime(AppLayer);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;
  if (!runtime) return null;

  return (
    <RuntimeProvider runtime={runtime}>
      <AppRouter />
    </RuntimeProvider>
  );
}

// 子コンポーネントでランタイムを使用
function SomeComponent() {
  const runtime = useRuntimeContext();
  // ランタイムを使用
}
```

### アンチパターン

```typescript
// ❌ Bad: 各コンポーネントでランタイムを作成
function SomeComponent() {
  const { runtime } = useManagedRuntime(AppLayer); // 非効率
  // ...
}

// ✅ Good: 代わりにuseRuntimeContextを使用
function SomeComponent() {
  const runtime = useRuntimeContext();
  // ...
}
```

## ベストプラクティス

### 1. App レベルでの提供

```typescript
// ✅ Good: アプリのルートでProviderを設定
function App() {
  const { runtime } = useManagedRuntime(AppLayer);
  return (
    <RuntimeProvider runtime={runtime}>
      <AppContent />
    </RuntimeProvider>
  );
}
```

### 2. カスタムフックでの抽象化

```typescript
// ✅ Good: ランタイムを使うカスタムフックを作成
function useAppServices() {
  const runtime = useRuntimeContext();

  const getUser = (id: string) => {
    return runtime.runPromise(
      Effect.gen(function* () {
        const db = yield* Effect.service(Database);
        return yield* db.getUser(id);
      })
    );
  };

  return { getUser };
}
```

### 3. テストでの注入

```typescript
// ✅ Good: テスト用のラッパーを作成
const TestProvider = createTestWrapper(MockLayer);

render(
  <TestProvider>
    <ComponentUnderTest />
  </TestProvider>
);
```

## 関連Hooks/Components

- [useManagedRuntime](./useManagedRuntime.md) - ManagedRuntimeの作成
- [useRuntime](./useRuntime.md) - シンプルなランタイム作成
- [EffectProvider](./EffectProvider.md) - Layer提供コンポーネント

## 参考

- [React Context API](https://react.dev/reference/react/createContext)
- [Effect Documentation - ManagedRuntime](https://effect.website/docs/runtime#managed-runtime)
- [React Hooks - useContext](https://react.dev/reference/react/useContext)
