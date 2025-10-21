# ランタイム管理Hooks

## useManagedRuntime

### 概要
Effect-TSの`ManagedRuntime`をReactコンポーネントで管理するhook。カスタムレイヤーを持つランタイムを作成し、コンポーネントのライフサイクルに応じて適切にクリーンアップする。

### ユースケース
- アプリケーション全体で共有するサービスを持つランタイム
- カスタム設定を持つランタイムの作成
- 外部フレームワーク（React）との統合

### API設計

```typescript
function useManagedRuntime<R, E>(
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

### 使用例

```typescript
import { useManagedRuntime } from 'effectts-react';
import { Layer } from 'effect';

// サービスレイヤーの定義
const AppLayer = Layer.merge(
  DatabaseLayer,
  LoggerLayer,
  CacheLayer
);

function App() {
  const { runtime, loading, error } = useManagedRuntime(AppLayer);

  if (loading) return <div>Initializing...</div>;
  if (error) return <div>Failed to initialize: {String(error)}</div>;

  return (
    <RuntimeContext.Provider value={runtime}>
      <YourApp />
    </RuntimeContext.Provider>
  );
}
```

### 実装詳細

```typescript
export function useManagedRuntime<R, E>(
  layer: Layer.Layer<R, E, never>,
  options?: {
    onError?: (error: E) => void;
  }
): {
  runtime: ManagedRuntime.ManagedRuntime<R, E> | null;
  loading: boolean;
  error: E | null;
} {
  const [runtime, setRuntime] = useState<ManagedRuntime.ManagedRuntime<R, E> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<E | null>(null);

  useEffect(() => {
    const managedRuntime = ManagedRuntime.make(layer);

    setRuntime(managedRuntime);
    setLoading(false);

    return () => {
      // Cleanup runtime
      managedRuntime.dispose();
    };
  }, [layer]);

  return { runtime, loading, error };
}
```

### テストケース
- ✅ ランタイムの初期化
- ✅ レイヤーの適用
- ✅ コンポーネントアンマウント時のクリーンアップ
- ✅ エラーハンドリング
- ✅ 複数レイヤーのマージ

---

## useRuntimeContext

### 概要
Reactコンテキストを通じてManagedRuntimeを提供・取得するhook。

### API設計

```typescript
// Provider
function RuntimeProvider<R, E>({
  runtime,
  children
}: {
  runtime: ManagedRuntime.ManagedRuntime<R, E>;
  children: ReactNode;
}): ReactElement;

// Consumer
function useRuntimeContext<R>(): ManagedRuntime.ManagedRuntime<R, never>;
```

### 使用例

```typescript
// App.tsx
function App() {
  const { runtime } = useManagedRuntime(AppLayer);

  return (
    <RuntimeProvider runtime={runtime}>
      <MyComponent />
    </RuntimeProvider>
  );
}

// MyComponent.tsx
function MyComponent() {
  const runtime = useRuntimeContext();

  const handleAction = () => {
    const effect = Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      return yield* db.query('SELECT * FROM users');
    });

    runtime.runPromise(effect);
  };

  return <button onClick={handleAction}>Load Users</button>;
}
```

### 実装詳細

```typescript
const RuntimeContext = createContext<ManagedRuntime.ManagedRuntime<any, any> | null>(null);

export function RuntimeProvider<R, E>({ runtime, children }: {
  runtime: ManagedRuntime.ManagedRuntime<R, E>;
  children: ReactNode;
}) {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntimeContext<R>(): ManagedRuntime.ManagedRuntime<R, never> {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('useRuntimeContext must be used within RuntimeProvider');
  }
  return runtime;
}
```

### テストケース
- ✅ ランタイムの提供
- ✅ ランタイムの取得
- ✅ Provider外での使用時のエラー
- ✅ ネストされたProvider
