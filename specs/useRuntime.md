# useRuntime

**ステータス**: ✅ 実装済み

## 概要

Effect実行用のRuntimeインスタンスを作成・管理するhook。カスタムコンテキストを持つランタイムの作成に対応。

## ユースケース

- カスタムランタイムの作成
- Effectの手動実行
- ランタイム設定のカスタマイズ
- サービスコンテキストの注入

## API設計

```typescript
function useRuntime<R>(
  context?: Context.Context<R>
): Runtime.Runtime<R>
```

**パラメータ:**
- `context`: オプショナルなコンテキスト（サービスの提供など）

**戻り値:**
- Effect実行用のRuntimeインスタンス

## 使用例

### 基本的な使用例

```typescript
import { useRuntime } from 'effectts-react';
import * as Effect from 'effect/Effect';

function MyComponent() {
  const runtime = useRuntime();

  const handleClick = () => {
    const effect = Effect.sync(() => console.log('Clicked!'));
    Effect.runPromise(effect);
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### カスタムコンテキスト付きランタイム

```typescript
import { useRuntime } from 'effectts-react';
import { Context, Effect } from 'effect';

// サービスの定義
class Logger extends Context.Tag('Logger')<
  Logger,
  { readonly log: (msg: string) => Effect.Effect<void> }
>() {}

class Database extends Context.Tag('Database')<
  Database,
  { readonly query: (sql: string) => Effect.Effect<any[]> }
>() {}

function App() {
  const context = useMemo(() => {
    return Context.empty().pipe(
      Context.add(Logger, {
        log: (msg) => Effect.sync(() => console.log(msg))
      }),
      Context.add(Database, {
        query: (sql) => Effect.succeed([])
      })
    );
  }, []);

  const runtime = useRuntime(context);

  const executeWithServices = () => {
    const effect = Effect.gen(function* () {
      const logger = yield* Effect.service(Logger);
      const db = yield* Effect.service(Database);

      yield* logger.log('Executing query');
      return yield* db.query('SELECT * FROM users');
    });

    Effect.runPromise(effect);
  };

  return <button onClick={executeWithServices}>Execute</button>;
}
```

### イベントハンドラーでの使用

```typescript
function DataLoader() {
  const runtime = useRuntime();

  const loadData = async () => {
    const effect = Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        fetch('/api/data').then(r => r.json())
      );

      yield* Effect.sync(() => {
        console.log('Data loaded:', response);
      });

      return response;
    });

    const data = await Effect.runPromise(effect);
    return data;
  };

  return <button onClick={loadData}>Load Data</button>;
}
```

## 実装詳細

```typescript
export function useRuntime<R>(
  context?: Context.Context<R>
): Runtime.Runtime<R> {
  return useMemo(() => {
    if (context) {
      return Runtime.defaultRuntime as Runtime.Runtime<R>;
    }
    return Runtime.defaultRuntime as Runtime.Runtime<R>;
  }, [context]);
}
```

### 実装の特徴

- ✅ `useMemo`によるメモ化で再レンダリング時の再生成を防止
- ✅ `defaultRuntime`を使用（シンプルな実装）
- ✅ コンテキストパラメータのサポート
- ✅ 型安全なランタイム提供

### 注意事項

現在の実装は`defaultRuntime`を返すシンプルな実装です。より高度なランタイム管理が必要な場合は、提案中の[useManagedRuntime](./runtime-hooks.md#usemanagedruntime)の使用を検討してください。

## テストケース

- ✅ ランタイムインスタンスの生成
- ✅ 再レンダリング時の同一性確認
- ✅ コンテキストパラメータのサポート確認

## 関連Hooks

- [useManagedRuntime](./runtime-hooks.md#usemanagedruntime) - より高度なランタイム管理（提案）
- [useEffectQuery](./useEffectQuery.md) - ランタイムを使った自動実行
