# useEffectContext

**ステータス**: 📋 提案中 (Phase 3)

## 概要
Effect Contextを直接取得し、複数のサービスや高度なContext操作を可能にするhook。

## ユースケース
- 複数のサービスを一度に取得
- Contextの動的な合成やマージ
- デバッグやロギング用途でContext全体を確認
- useServiceでは対応できない高度なContext操作
- 条件付きのサービス取得

## API設計

```typescript
function useEffectContext<R>(): Context.Context<R> | null
```

**パラメータ:**
なし

**戻り値:**
- `Context.Context<R>` - 現在のEffect Context（利用可能な場合）
- `null` - Contextが利用できない場合

## 使用例

### 基本的な使用例

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';

// サービス定義
class Database extends Context.Tag('Database')<
  Database,
  {
    query: (sql: string) => Effect.Effect<any[]>
  }
>() {}

class Logger extends Context.Tag('Logger')<
  Logger,
  {
    log: (message: string) => Effect.Effect<void>
  }
>() {}

function DataViewer() {
  const context = useEffectContext<Database | Logger>();

  useEffect(() => {
    if (!context) {
      console.log('Context not available');
      return;
    }

    // Contextから複数のサービスを取得
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const logger = yield* Logger;

      yield* logger.log('Querying database...');
      const results = yield* db.query('SELECT * FROM users');
      yield* logger.log(`Found ${results.length} users`);

      return results;
    }).pipe(Effect.provide(context));

    Effect.runPromise(effect);
  }, [context]);

  return <div>Data Viewer</div>;
}
```

### 複数サービスの一括取得

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';

// 複数のサービス定義
class AuthService extends Context.Tag('AuthService')<
  AuthService,
  { getCurrentUser: () => Effect.Effect<User> }
>() {}

class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  { get: (key: string) => Effect.Effect<string> }
>() {}

class MetricsService extends Context.Tag('MetricsService')<
  MetricsService,
  { track: (event: string) => Effect.Effect<void> }
>() {}

function Dashboard() {
  const context = useEffectContext<
    AuthService | ConfigService | MetricsService
  >();

  const [user, setUser] = useState<User | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('');

  useEffect(() => {
    if (!context) return;

    const loadData = Effect.gen(function* () {
      // 全てのサービスを一度に利用
      const auth = yield* AuthService;
      const config = yield* ConfigService;
      const metrics = yield* MetricsService;

      const currentUser = yield* auth.getCurrentUser();
      const url = yield* config.get('apiUrl');

      yield* metrics.track('dashboard_loaded');

      return { user: currentUser, apiUrl: url };
    }).pipe(Effect.provide(context));

    Effect.runPromise(loadData).then(({ user, apiUrl }) => {
      setUser(user);
      setApiUrl(apiUrl);
    });
  }, [context]);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>API: {apiUrl}</p>
    </div>
  );
}
```

### Contextのマージと拡張

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';

class BaseService extends Context.Tag('BaseService')<
  BaseService,
  { baseMethod: () => Effect.Effect<string> }
>() {}

class ExtendedService extends Context.Tag('ExtendedService')<
  ExtendedService,
  { extendedMethod: () => Effect.Effect<number> }
>() {}

function MergedContextExample() {
  const parentContext = useEffectContext<BaseService>();

  // 親Contextに新しいサービスを追加
  const extendedContext = useMemo(() => {
    if (!parentContext) return null;

    const extendedService = {
      extendedMethod: () => Effect.succeed(42),
    };

    return Context.add(parentContext, ExtendedService, extendedService);
  }, [parentContext]);

  useEffect(() => {
    if (!extendedContext) return;

    const effect = Effect.gen(function* () {
      const base = yield* BaseService;
      const extended = yield* ExtendedService;

      const str = yield* base.baseMethod();
      const num = yield* extended.extendedMethod();

      return `${str}: ${num}`;
    }).pipe(Effect.provide(extendedContext));

    Effect.runPromise(effect).then(console.log);
  }, [extendedContext]);

  return <div>Merged Context Example</div>;
}
```

### 条件付きサービス取得

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';
import * as Option from 'effect/Option';

class OptionalService extends Context.Tag('OptionalService')<
  OptionalService,
  { doSomething: () => Effect.Effect<void> }
>() {}

function ConditionalServiceExample() {
  const context = useEffectContext<OptionalService>();

  const handleAction = () => {
    if (!context) {
      console.log('No context available');
      return;
    }

    // サービスが利用可能かチェック
    const maybeService = Context.getOption(context, OptionalService);

    if (Option.isSome(maybeService)) {
      const service = maybeService.value;
      Effect.runPromise(service.doSomething());
    } else {
      console.log('OptionalService not provided');
      // フォールバック処理
    }
  };

  return <button onClick={handleAction}>Execute with Optional Service</button>;
}
```

### デバッグ用途 - Context内容の確認

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';

function ContextDebugger() {
  const context = useEffectContext<any>();

  useEffect(() => {
    if (!context) {
      console.log('No context available');
      return;
    }

    // 開発環境でのデバッグ
    if (process.env.NODE_ENV === 'development') {
      console.log('Available Context:', context);
      console.log('Context services:', Context.unsafeMap(context));
    }
  }, [context]);

  return (
    <div className="debug-panel">
      <h3>Context Debug Info</h3>
      <pre>{context ? 'Context available' : 'No context'}</pre>
    </div>
  );
}
```

### カスタムContext操作

```typescript
import { useEffectContext } from 'effectts-react';
import * as Context from 'effect/Context';

class CacheService extends Context.Tag('CacheService')<
  CacheService,
  { get: (key: string) => Effect.Effect<string | null> }
>() {}

class ApiService extends Context.Tag('ApiService')<
  ApiService,
  { fetch: (url: string) => Effect.Effect<string> }
>() {}

function CustomContextManipulation() {
  const baseContext = useEffectContext<CacheService | ApiService>();

  // Contextから特定のサービスのみを抽出して新しいContextを作る
  const apiOnlyContext = useMemo(() => {
    if (!baseContext) return null;

    // ApiServiceのみを含む新しいContextを作成
    const apiService = Context.unsafeGet(baseContext, ApiService);
    return Context.make(ApiService, apiService);
  }, [baseContext]);

  const fetchData = useCallback(
    (url: string) => {
      if (!apiOnlyContext) return Promise.reject('No context');

      const effect = Effect.gen(function* () {
        const api = yield* ApiService;
        return yield* api.fetch(url);
      }).pipe(Effect.provide(apiOnlyContext));

      return Effect.runPromise(effect);
    },
    [apiOnlyContext]
  );

  return (
    <button onClick={() => fetchData('/api/data')}>
      Fetch with Custom Context
    </button>
  );
}
```

### ランタイム固有のContext取得

```typescript
import { useEffectContext } from 'effectts-react';
import { useRuntimeContext } from 'effectts-react';
import * as Context from 'effect/Context';

class RuntimeSpecificService extends Context.Tag('RuntimeSpecificService')<
  RuntimeSpecificService,
  { version: string; execute: () => Effect.Effect<void> }
>() {}

function RuntimeContextExample() {
  const runtime = useRuntimeContext();
  const context = useEffectContext<RuntimeSpecificService>();

  useEffect(() => {
    if (!context || !runtime) return;

    // ランタイムのContextから情報を取得
    const effect = Effect.gen(function* () {
      const service = yield* RuntimeSpecificService;
      console.log('Service version:', service.version);
      yield* service.execute();
    }).pipe(Effect.provide(context));

    Effect.runPromise(effect);
  }, [context, runtime]);

  return <div>Runtime Context Example</div>;
}
```

## 実装詳細

```typescript
import { useContext } from 'react';
import * as Context from 'effect/Context';

// EffectProviderで提供されるReact Context
const EffectContextContext = React.createContext<Context.Context<any> | null>(
  null
);

export function useEffectContext<R>(): Context.Context<R> | null {
  const context = useContext(EffectContextContext);
  return context as Context.Context<R> | null;
}

// EffectProviderでの使用例
export function EffectProvider<R>({
  layer,
  children,
}: {
  layer: Layer.Layer<R, never, never>;
  children: ReactNode;
}) {
  const [context, setContext] = useState<Context.Context<R> | null>(null);

  useEffect(() => {
    const runtime = ManagedRuntime.make(layer);

    Effect.runPromise(
      runtime.pipe(
        Effect.flatMap((rt) =>
          Effect.sync(() => {
            // RuntimeからContextを取得
            const ctx = (rt as any).context;
            setContext(ctx);
          })
        )
      )
    );

    return () => {
      Effect.runPromise(runtime.dispose());
    };
  }, [layer]);

  return (
    <EffectContextContext.Provider value={context}>
      {children}
    </EffectContextContext.Provider>
  );
}
```

## 注意事項

### useServiceとの使い分け

- **useService**: 単一のサービスを型安全に取得したい場合（推奨）
- **useEffectContext**: 複数のサービスや高度なContext操作が必要な場合

```typescript
// シンプルな場合 - useServiceを使う ✅
const logger = useService(LoggerService);

// 複雑な場合 - useEffectContextを使う ✅
const context = useEffectContext<LoggerService | DatabaseService>();
```

### 型安全性

`useEffectContext`は型パラメータで利用可能なサービスを指定しますが、実際にそのサービスが提供されているかは実行時にチェックが必要です。

```typescript
const context = useEffectContext<MyService>();

// 安全に取得
const maybeService = context
  ? Context.getOption(context, MyService)
  : Option.none();
```

### パフォーマンス

Context全体を取得するため、useServiceよりも若干オーバーヘッドがあります。必要がなければuseServiceを使用してください。

## テストケース

- ✅ Context取得の基本動作
- ✅ Context未提供時のnull返却
- ✅ 複数サービスの取得
- ✅ Contextのマージと拡張
- ✅ 条件付きサービス取得（Option使用）
- ✅ Context変更時の再レンダリング
- ✅ アンマウント時のクリーンアップ
- ✅ 型安全性の検証

## useServiceとの比較

| 機能 | useService | useEffectContext |
|------|-----------|------------------|
| 使いやすさ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 型安全性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 柔軟性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| パフォーマンス | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 推奨用途 | 単一サービス取得 | 複雑なContext操作 |

## 関連Hooks

- [useService](./useService.md) - シンプルなサービス取得（多くの場合はこちらを推奨）
- [EffectProvider](./EffectProvider.md) - Context提供元
- [useLayer](./useLayer.md) - LayerからのContext構築
- [useRuntimeContext](./useRuntimeContext.md) - ランタイムコンテキストの共有

## 参考

- [Effect Context Documentation](https://effect.website/docs/context-management/context)
- [Effect Services Documentation](https://effect.website/docs/context-management/services)
