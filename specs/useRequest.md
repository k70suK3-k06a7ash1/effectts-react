# useRequest

**ステータス**: 📋 提案中 (Phase 4)

## 概要
Effect-TSのRequestResolverを使用してリクエストをバッチング・最適化するhook。複数の個別リクエストを自動的に1つのバッチリクエストに統合し、N+1問題を解決します。

## ユースケース
- APIリクエストの最適化
- N+1問題の解決
- ネットワークオーバーヘッドの削減
- GraphQL DataLoaderパターンの実装
- 複数エンティティの効率的な取得
- バックエンドAPIの負荷軽減

## API設計

```typescript
function useRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    runtime?: Runtime.Runtime<never>;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  loading: boolean;
  error: any | null;
}
```

**パラメータ:**
- `resolver` - リクエストをバッチ処理するRequestResolver
- `options.runtime` - カスタムランタイム（オプション）

**戻り値:**
- `execute` - リクエストを実行するEffect関数
- `executePromise` - リクエストを実行するPromise関数
- `loading` - ローディング状態
- `error` - エラー状態

## 使用例

### 基本的な使用例

```typescript
import { useRequest } from 'effectts-react';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Effect from 'effect/Effect';

// ユーザーリクエストの定義
interface GetUser extends Request.Request<User, NotFoundError> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

// バッチリゾルバー
const GetUserResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) =>
    Effect.gen(function* () {
      // 複数のIDを1回のAPI呼び出しで取得
      const ids = requests.map((r) => r.id);
      console.log(`Fetching ${ids.length} users in one batch:`, ids);

      const users = yield* api.getUsersByIds(ids);

      // 各リクエストに結果を割り当て
      return requests.map((req) => {
        const user = users.find((u) => u.id === req.id);
        return user
          ? Request.succeed(req, user)
          : Request.fail(req, new NotFoundError(req.id));
      });
    })
);

function UserProfile({ userId }: { userId: string }) {
  const { execute, loading, error } = useRequest(GetUserResolver);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      const user = yield* execute(GetUser({ id: userId }));
      return user;
    }),
    [userId, execute]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}
```

### N+1問題の解決

```typescript
import { useRequest } from 'effectts-react';

// Todo アイテム
interface GetTodo extends Request.Request<Todo, Error> {
  readonly _tag: 'GetTodo';
  readonly id: string;
}

const GetTodo = Request.tagged<GetTodo>('GetTodo');

// User
interface GetUser extends Request.Request<User, Error> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

// バッチリゾルバー
const TodoResolver = RequestResolver.makeBatched(
  (requests: GetTodo[]) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      const todos = yield* api.getTodosByIds(ids);

      return requests.map((req) => {
        const todo = todos.find((t) => t.id === req.id);
        return todo
          ? Request.succeed(req, todo)
          : Request.fail(req, new Error('Todo not found'));
      });
    })
);

const UserResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      const users = yield* api.getUsersByIds(ids);

      return requests.map((req) => {
        const user = users.find((u) => u.id === req.id);
        return user
          ? Request.succeed(req, user)
          : Request.fail(req, new Error('User not found'));
      });
    })
);

function TodoList() {
  const todoRequest = useRequest(TodoResolver);
  const userRequest = useRequest(UserResolver);

  const { data: todos } = useEffectQuery(
    Effect.gen(function* () {
      // 複数のTODOを取得（自動的にバッチ化される）
      const todoIds = ['1', '2', '3', '4', '5'];
      const todos = yield* Effect.forEach(
        todoIds,
        (id) => todoRequest.execute(GetTodo({ id })),
        { batching: true }
      );

      // 各TODOの作成者を取得（これもバッチ化される）
      const todosWithUsers = yield* Effect.forEach(
        todos,
        (todo) =>
          Effect.gen(function* () {
            const user = yield* userRequest.execute(
              GetUser({ id: todo.userId })
            );
            return { ...todo, user };
          }),
        { batching: true }
      );

      return todosWithUsers;
    }),
    []
  );

  return (
    <div>
      <h1>Todo List</h1>
      {todos?.map((todo) => (
        <div key={todo.id}>
          <strong>{todo.title}</strong>
          <span> by {todo.user.name}</span>
        </div>
      ))}
    </div>
  );
}
```

### 複数コンポーネントでのバッチング

```typescript
import { useRequest } from 'effectts-react';

const GetUserResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      console.log(`Batched request for ${ids.length} users`);
      const users = yield* api.getUsersByIds(ids);

      return requests.map((req) => {
        const user = users.find((u) => u.id === req.id);
        return user
          ? Request.succeed(req, user)
          : Request.fail(req, new Error('Not found'));
      });
    })
);

// 複数のコンポーネントが同じリゾルバーを使用
function UserAvatar({ userId }: { userId: string }) {
  const { execute } = useRequest(GetUserResolver);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      return yield* execute(GetUser({ id: userId }));
    }),
    [userId, execute]
  );

  return <img src={data?.avatar} alt={data?.name} />;
}

function UserName({ userId }: { userId: string }) {
  const { execute } = useRequest(GetUserResolver);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      return yield* execute(GetUser({ id: userId }));
    }),
    [userId, execute]
  );

  return <span>{data?.name}</span>;
}

// 親コンポーネント
function UserList({ userIds }: { userIds: string[] }) {
  // 複数のUserAvatarとUserNameが同時にレンダリングされると
  // すべてのリクエストが自動的にバッチ化される
  return (
    <div>
      {userIds.map((id) => (
        <div key={id}>
          <UserAvatar userId={id} />
          <UserName userId={id} />
        </div>
      ))}
    </div>
  );
}
```

### エラーハンドリング付きバッチング

```typescript
import { useRequest } from 'effectts-react';

class ProductNotFoundError {
  readonly _tag = 'ProductNotFoundError';
  constructor(readonly id: string) {}
}

interface GetProduct extends Request.Request<Product, ProductNotFoundError> {
  readonly _tag: 'GetProduct';
  readonly id: string;
}

const GetProduct = Request.tagged<GetProduct>('GetProduct');

const ProductResolver = RequestResolver.makeBatched(
  (requests: GetProduct[]) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      const products = yield* api.getProductsByIds(ids);

      return requests.map((req) => {
        const product = products.find((p) => p.id === req.id);
        return product
          ? Request.succeed(req, product)
          : Request.fail(req, new ProductNotFoundError(req.id));
      });
    })
);

function ProductDisplay({ productId }: { productId: string }) {
  const { execute, error } = useRequest(ProductResolver);

  const { data, error: queryError } = useEffectQuery(
    Effect.gen(function* () {
      const product = yield* execute(GetProduct({ id: productId }));
      return product;
    }),
    [productId, execute]
  );

  if (error || queryError) {
    return <div>Failed to load product</div>;
  }

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>{data.name}</h2>
      <p>${data.price}</p>
    </div>
  );
}
```

### カスタムランタイムでの使用

```typescript
import { useRequest } from 'effectts-react';
import { useManagedRuntime } from 'effectts-react';

class ApiService extends Context.Tag('ApiService')<
  ApiService,
  {
    fetchUsers: (ids: string[]) => Effect.Effect<User[]>;
  }
>() {}

const ApiServiceLive = Layer.succeed(ApiService, {
  fetchUsers: (ids) =>
    Effect.tryPromise(() =>
      fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }).then((r) => r.json())
    ),
});

const GetUserResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) =>
    Effect.gen(function* () {
      const api = yield* ApiService;
      const ids = requests.map((r) => r.id);
      const users = yield* api.fetchUsers(ids);

      return requests.map((req) => {
        const user = users.find((u) => u.id === req.id);
        return user
          ? Request.succeed(req, user)
          : Request.fail(req, new Error('Not found'));
      });
    })
);

function UserComponent({ userId }: { userId: string }) {
  const { runtime } = useManagedRuntime(ApiServiceLive);
  const { execute } = useRequest(GetUserResolver, { runtime });

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      return yield* execute(GetUser({ id: userId }));
    }),
    [userId, execute]
  );

  return <div>{data?.name}</div>;
}
```

### executePromiseの使用（非Effect環境）

```typescript
import { useRequest } from 'effectts-react';

function QuickUserLookup() {
  const { executePromise, loading } = useRequest(GetUserResolver);
  const [user, setUser] = useState<User | null>(null);

  const handleSearch = async (userId: string) => {
    try {
      // Promise APIを使用
      const user = await executePromise(GetUser({ id: userId }));
      setUser(user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter user ID"
        onBlur={(e) => handleSearch(e.target.value)}
      />
      {loading && <div>Loading...</div>}
      {user && <div>Found: {user.name}</div>}
    </div>
  );
}
```

### リクエストの条件付き実行

```typescript
import { useRequest } from 'effectts-react';

function ConditionalUserFetch({ shouldFetch, userId }: {
  shouldFetch: boolean;
  userId: string;
}) {
  const { execute } = useRequest(GetUserResolver);

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      if (!shouldFetch) {
        return null;
      }
      return yield* execute(GetUser({ id: userId }));
    }),
    [shouldFetch, userId, execute]
  );

  return data ? <div>{data.name}</div> : <div>Not fetched</div>;
}
```

## 実装詳細

```typescript
import { useCallback, useState, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Runtime from 'effect/Runtime';

export function useRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    runtime?: Runtime.Runtime<never>;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const resolverRef = useRef(resolver);

  // リゾルバーの更新を追跡
  resolverRef.current = resolver;

  const execute = useCallback(
    <E, R>(request: Request.Request<E, R>): Effect.Effect<E, any> => {
      return Effect.request(request, resolverRef.current);
    },
    []
  );

  const executePromise = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      setLoading(true);
      setError(null);

      try {
        const effect = Effect.request(request, resolverRef.current);
        const result = options?.runtime
          ? await Runtime.runPromise(options.runtime)(effect)
          : await Effect.runPromise(effect);

        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [options?.runtime]
  );

  return { execute, executePromise, loading, error };
}
```

## パフォーマンスの最適化

### バッチウィンドウの設定

Effect-TSは自動的にリクエストをバッチ化しますが、明示的な制御も可能です：

```typescript
const effect = Effect.gen(function* () {
  // バッチング有効化
  const results = yield* Effect.forEach(
    requests,
    (req) => execute(req),
    { batching: true } // 明示的にバッチング有効化
  );
  return results;
});
```

### リクエストの最適化

```typescript
// 重複リクエストの排除
const uniqueIds = Array.from(new Set(ids));
const requests = uniqueIds.map((id) => GetUser({ id }));
```

## テストケース

- ✅ 基本的なリクエスト実行
- ✅ バッチングの動作確認（複数リクエストが1つに統合される）
- ✅ エラーハンドリング（個別リクエストの失敗）
- ✅ 複数リクエストの同時実行
- ✅ N+1問題の解決確認
- ✅ executeとexecutePromiseの両方のAPI
- ✅ カスタムランタイムでの実行
- ✅ アンマウント時のクリーンアップ
- ✅ loading/error状態の管理

## 注意事項

### バッチングの動作

バッチングは同じイベントループ内のリクエストを自動的にまとめます。異なるタイミングで実行されるリクエストは別々のバッチになります。

### リゾルバーの変更

リゾルバーが変更されると、新しいリゾルバーが使用されます。同じリゾルバーインスタンスを保持するためにはuseMemoを使用してください。

```typescript
const resolver = useMemo(() => GetUserResolver, []);
const { execute } = useRequest(resolver);
```

### TypeScript型推論

Request.Request型を正しく定義することで、完全な型安全性が得られます。

## 関連Hooks

- [useCachedRequest](./useCachedRequest.md) - キャッシング付きリクエスト
- [useEffectQuery](./useEffectQuery.md) - Effect実行とデータフェッチング
- [useManagedRuntime](./useManagedRuntime.md) - カスタムランタイム管理

## 参考

- [Effect Request Documentation](https://effect.website/docs/data-types/request)
- [Effect RequestResolver Documentation](https://effect.website/docs/data-types/request-resolver)
- [DataLoader Pattern](https://github.com/graphql/dataloader)
