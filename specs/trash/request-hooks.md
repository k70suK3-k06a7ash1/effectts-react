# リクエスト最適化Hooks

## useRequest

### 概要
Effect-TSのRequestResolverを使用してリクエストをバッチング・最適化するhook。複数の個別リクエストを自動的に1つのバッチリクエストに統合する。

### ユースケース
- APIリクエストの最適化
- N+1問題の解決
- ネットワークオーバーヘッドの削減
- GraphQL DataLoaderパターン

### API設計

```typescript
function useRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>
): {
  execute: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  loading: boolean;
  error: any | null;
}
```

### 使用例

```typescript
import { useRequest } from 'effectts-react';
import { Request, RequestResolver } from 'effect';

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
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  if (!data) return null;

  return <div>{data.name}</div>;
}
```

### より複雑な例 - 複数のエンティティ

```typescript
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
          : Request.fail(req, new Error('Not found'));
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
          : Request.fail(req, new Error('Not found'));
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
      {todos?.map((todo) => (
        <div key={todo.id}>
          {todo.title} by {todo.user.name}
        </div>
      ))}
    </div>
  );
}
```

### 実装詳細

```typescript
export function useRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>
): {
  execute: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);

  const execute = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      setLoading(true);
      setError(null);

      try {
        const result = await Effect.runPromise(
          Effect.request(request, resolver)
        );
        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [resolver]
  );

  return { execute, loading, error };
}
```

### テストケース
- ✅ リクエストの実行
- ✅ バッチングの動作確認
- ✅ エラーハンドリング
- ✅ 複数リクエストの統合
- ✅ パフォーマンス（N+1問題の解決）

---

## useCachedRequest

### 概要
リクエストバッチングにキャッシングを追加したhook。同一リクエストの重複実行を防ぐ。

### API設計

```typescript
function useCachedRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    ttl?: Duration.Duration;
    capacity?: number;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  clearCache: () => void;
  loading: boolean;
  error: any | null;
}
```

### 使用例

```typescript
import { useCachedRequest } from 'effectts-react';
import { Duration } from 'effect';

function UserProfile({ userId }: { userId: string }) {
  const { execute, clearCache } = useCachedRequest(GetUserResolver, {
    ttl: Duration.minutes(5), // 5分間キャッシュ
    capacity: 100, // 最大100件
  });

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      // 5分以内の同じリクエストはキャッシュから返される
      const user = yield* execute(GetUser({ id: userId }));
      return user;
    }),
    [userId]
  );

  return (
    <div>
      <div>{data?.name}</div>
      <button onClick={clearCache}>Clear Cache</button>
    </div>
  );
}
```

### データ更新時のキャッシュクリア

```typescript
function UserEditor({ userId }: { userId: string }) {
  const userCache = useCachedRequest(GetUserResolver);

  const updateUser = async (updates: Partial<User>) => {
    await api.updateUser(userId, updates);

    // 更新後はキャッシュをクリア
    userCache.clearCache();
  };

  return (
    <div>
      {/* ... */}
      <button onClick={() => updateUser({ name: 'New Name' })}>
        Update
      </button>
    </div>
  );
}
```

### 実装詳細

```typescript
export function useCachedRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    ttl?: Duration.Duration;
    capacity?: number;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  clearCache: () => void;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const cacheRef = useRef(new Map<string, { value: any; timestamp: number }>());

  const execute = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      const cacheKey = JSON.stringify(request);
      const now = Date.now();
      const ttlMs = options?.ttl
        ? Duration.toMillis(options.ttl)
        : 5 * 60 * 1000; // デフォルト5分

      // キャッシュチェック
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.timestamp < ttlMs) {
        return cached.value;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await Effect.runPromise(
          Effect.request(request, resolver).pipe(
            Effect.withRequestCaching(true)
          )
        );

        // キャッシュに保存
        cacheRef.current.set(cacheKey, { value: result, timestamp: now });

        // 容量制限
        if (
          options?.capacity &&
          cacheRef.current.size > options.capacity
        ) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }

        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [resolver, options]
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { execute, clearCache, loading, error };
}
```

### テストケース
- ✅ キャッシュヒット
- ✅ キャッシュミス
- ✅ TTL期限切れ
- ✅ 容量制限
- ✅ キャッシュクリア
- ✅ 並行リクエストの重複排除
