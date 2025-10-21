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
