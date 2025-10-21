# useService

**ステータス**: ✅ 実装済み

## 概要

Effect-TSの`Context.Tag`で定義されたサービスをReactコンポーネントで利用するhook。依存性注入パターンを実現し、テスト可能でメンテナンスしやすいコンポーネントを構築できます。

## ユースケース

- 依存性注入パターンの実装
- テスト可能なコンポーネント設計
- サービス指向アーキテクチャ
- モック/スタブの簡単な注入
- コンポーネント間でのサービス共有
- ビジネスロジックの分離

## API設計

```typescript
function useService<I, S>(
  tag: Context.Tag<I, S>
): S | null
```

**パラメータ:**
- `tag`: Effect-TSの`Context.Tag`（サービスの識別子）

**戻り値:**
- `S`: サービスの実装（Providerで提供されている場合）
- `null`: サービスが提供されていない場合

## 使用例

### 基本的な使用例

```typescript
import { useService } from 'effectts-react';
import { Context, Effect } from 'effect';

// サービスの定義
class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[], DatabaseError>;
    readonly execute: (sql: string) => Effect.Effect<void, DatabaseError>;
  }
>() {}

function UserList() {
  const db = useService(Database);

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      if (!db) {
        return yield* Effect.fail(new Error('Database not available'));
      }

      const users = yield* db.query('SELECT * FROM users');
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

### 複数のサービスを使用

```typescript
// Logger サービスの定義
class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly info: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
    readonly debug: (message: string) => Effect.Effect<void>;
  }
>() {}

// UserRepository サービスの定義
class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: string) => Effect.Effect<User, NotFoundError>;
    readonly save: (user: User) => Effect.Effect<User, SaveError>;
    readonly delete: (id: string) => Effect.Effect<void, DeleteError>;
  }
>() {}

function UserProfile({ userId }: { userId: string }) {
  const logger = useService(Logger);
  const userRepo = useService(UserRepository);

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      if (!logger || !userRepo) {
        return yield* Effect.fail(new Error('Services not available'));
      }

      yield* logger.info(`Loading user ${userId}`);
      const user = yield* userRepo.findById(userId);
      yield* logger.info(`User loaded: ${user.name}`);

      return user;
    }),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}
```

### サービスを使ったミューテーション

```typescript
class TodoService extends Context.Tag('TodoService')<
  TodoService,
  {
    readonly createTodo: (title: string) => Effect.Effect<Todo, CreateError>;
    readonly updateTodo: (id: string, updates: Partial<Todo>) => Effect.Effect<Todo, UpdateError>;
    readonly deleteTodo: (id: string) => Effect.Effect<void, DeleteError>;
  }
>() {}

function TodoForm() {
  const todoService = useService(TodoService);
  const logger = useService(Logger);

  const { execute, loading, error } = useEffectCallback(
    (title: string) =>
      Effect.gen(function* () {
        if (!todoService || !logger) {
          return yield* Effect.fail(new Error('Services not available'));
        }

        yield* logger.info(`Creating todo: ${title}`);
        const todo = yield* todoService.createTodo(title);
        yield* logger.info(`Todo created with ID: ${todo.id}`);

        return todo;
      }),
    {
      onSuccess: (todo) => {
        toast.success(`Created: ${todo.title}`);
      }
    }
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    await execute(title);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Todo'}
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

### 条件付きサービス利用

```typescript
function UserDashboard({ isAdmin }: { isAdmin: boolean }) {
  const userService = useService(UserService);
  const adminService = useService(AdminService); // 管理者のみ提供される

  const { data, loading, error } = useEffectQuery(
    Effect.gen(function* () {
      if (!userService) {
        return yield* Effect.fail(new Error('UserService not available'));
      }

      // 基本データを取得
      const basicData = yield* userService.getDashboardData();

      // 管理者の場合は追加データを取得
      if (isAdmin && adminService) {
        const adminData = yield* adminService.getAdminStats();
        return { ...basicData, admin: adminData };
      }

      return basicData;
    }),
    [isAdmin]
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return null;

  return (
    <div>
      <UserStats stats={data} />
      {isAdmin && data.admin && <AdminPanel stats={data.admin} />}
    </div>
  );
}
```

### カスタムフックとの組み合わせ

```typescript
// カスタムフック内でサービスを使用
function useUserData(userId: string) {
  const userRepo = useService(UserRepository);
  const logger = useService(Logger);

  return useEffectQuery(
    Effect.gen(function* () {
      if (!userRepo || !logger) {
        return yield* Effect.fail(new Error('Services not available'));
      }

      yield* logger.info(`Fetching user data for ${userId}`);
      const user = yield* userRepo.findById(userId);
      return user;
    }),
    [userId]
  );
}

function UserCard({ userId }: { userId: string }) {
  const { data, loading, error } = useUserData(userId);

  if (loading) return <CardSkeleton />;
  if (error) return <ErrorCard error={error} />;
  if (!data) return null;

  return <Card user={data} />;
}
```

### null チェックを行うラッパー

```typescript
// ヘルパー関数でnullチェックを簡潔に
function useRequiredService<I, S>(tag: Context.Tag<I, S>): S {
  const service = useService(tag);

  if (!service) {
    throw new Error(`Required service ${tag.key} is not provided`);
  }

  return service;
}

function StrictComponent() {
  // nullの場合はエラーを投げる
  const db = useRequiredService(Database);
  const logger = useRequiredService(Logger);

  // null チェック不要で使える
  const { data } = useEffectQuery(
    Effect.gen(function* () {
      yield* logger.info('Loading data');
      return yield* db.query('SELECT * FROM data');
    }),
    []
  );

  return <div>{JSON.stringify(data)}</div>;
}
```

## 実装詳細

```typescript
import { useContext, createContext } from 'react';
import * as Context from 'effect/Context';

// Reactコンテキストの作成
const EffectServiceContext = createContext<Context.Context<any> | null>(null);

export function useService<I, S>(tag: Context.Tag<I, S>): S | null {
  const context = useContext(EffectServiceContext);

  // コンテキストが提供されていない場合
  if (!context) {
    return null;
  }

  // サービスの取得を試みる
  try {
    return Context.get(context, tag);
  } catch {
    // サービスが見つからない場合
    return null;
  }
}

// Providerコンポーネント（別ファイルで定義）
export const EffectServiceProvider = EffectServiceContext.Provider;
```

### 実装の特徴

- ✅ ReactのContextを使用した実装
- ✅ Effect-TSの`Context.Tag`との統合
- ✅ `null`を返すことでサービス未提供を表現
- ✅ 型安全なサービス取得
- ✅ シンプルなAPI
- ✅ パフォーマンスへの影響が最小限

### エッジケース

#### 1. Providerの外で使用
```typescript
// Providerの外では常にnullが返される
const service = useService(MyService); // null
```

#### 2. サービスが提供されていない
```typescript
// Context内に該当するサービスがない場合もnullが返される
const service = useService(UnprovidedService); // null
```

#### 3. ネストされたProvider
```typescript
// 最も近いProviderのコンテキストが使用される
// 親と子で同じサービスが提供されている場合、子が優先
```

## テストケース

### 基本機能
- ✅ サービスの正常な取得
- ✅ サービスが提供されていない場合のnull返却
- ✅ 複数サービスの同時取得

### Providerとの統合
- ✅ Provider内での使用
- ✅ Provider外での使用（null返却）
- ✅ ネストされたProviderでの動作

### 型推論
- ✅ サービスの型が正しく推論される
- ✅ nullとのユニオン型として扱われる

### エラーハンドリング
- ✅ サービス未提供時の適切な処理
- ✅ nullチェックの実装

### 実用例
- ✅ useEffectQueryとの組み合わせ
- ✅ useEffectCallbackとの組み合わせ
- ✅ カスタムフック内での使用

## Provider の使用方法

`useService`を使用するには、アプリケーションのルートで`EffectProvider`を使ってサービスを提供する必要があります：

```typescript
import { EffectProvider } from 'effectts-react';
import { Layer } from 'effect';

// サービスの実装
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.tryPromise({
    try: () => fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ sql })
    }).then(r => r.json()),
    catch: (e) => new DatabaseError({ cause: e })
  }),
  execute: (sql) => Effect.tryPromise({
    try: () => fetch('/api/execute', {
      method: 'POST',
      body: JSON.stringify({ sql })
    }),
    catch: (e) => new DatabaseError({ cause: e })
  })
});

const LoggerLive = Layer.succeed(Logger, {
  info: (msg) => Effect.sync(() => console.log(`[INFO] ${msg}`)),
  error: (msg) => Effect.sync(() => console.error(`[ERROR] ${msg}`)),
  debug: (msg) => Effect.sync(() => console.debug(`[DEBUG] ${msg}`))
});

const AppLayer = Layer.merge(DatabaseLive, LoggerLive);

function App() {
  return (
    <EffectProvider layer={AppLayer}>
      <UserList />
    </EffectProvider>
  );
}
```

詳細は [EffectProvider](./EffectProvider.md) を参照してください。

## ベストプラクティス

### 1. サービスの定義

```typescript
// ✅ Good: 明確なインターフェース定義
class UserAPI extends Context.Tag('UserAPI')<
  UserAPI,
  {
    readonly getUser: (id: string) => Effect.Effect<User, UserError>;
    readonly listUsers: () => Effect.Effect<User[], UserError>;
    readonly createUser: (data: CreateUserData) => Effect.Effect<User, UserError>;
  }
>() {}

// ❌ Bad: any型の使用
class UserAPI extends Context.Tag('UserAPI')<UserAPI, any>() {}
```

### 2. nullチェック

```typescript
// ✅ Good: Effect内でnullチェック
const effect = Effect.gen(function* () {
  if (!service) {
    return yield* Effect.fail(new ServiceNotAvailableError());
  }
  return yield* service.getData();
});

// ❌ Bad: nullのまま使用
const effect = service.getData(); // serviceがnullならエラー
```

### 3. カスタムフック

```typescript
// ✅ Good: カスタムフックで再利用
function useUserAPI() {
  const api = useService(UserAPI);
  if (!api) {
    throw new Error('UserAPI is required');
  }
  return api;
}

// コンポーネント内でシンプルに使用
function MyComponent() {
  const api = useUserAPI();
  // ...
}
```

## 関連Hooks

- [EffectProvider](./EffectProvider.md) - サービスを提供するProvider
- [useEffectContext](./useEffectContext.md) - Context全体を取得
- [useLayer](./useLayer.md) - Layerの構築
- [useEffectQuery](./useEffectQuery.md) - サービスを使ったデータフェッチ

## 参考

- [Effect Documentation - Context](https://effect.website/docs/context-management/context)
- [Effect Documentation - Layers](https://effect.website/docs/context-management/layers)
- [Effect Documentation - Services](https://effect.website/docs/context-management/services)
