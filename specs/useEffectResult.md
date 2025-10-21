# useEffectResult

**ステータス**: ✅ 実装済み

## 概要

Effectの実行結果を`Exit`型ベースの判別可能なユニオン型として扱い、パターンマッチングを容易にするhook。UIコンポーネント内での状態処理をより型安全でシンプルに記述できます。

## ユースケース

- 成功・失敗・ローディングの明確な状態分岐
- 型安全なエラーハンドリング
- 宣言的なUI記述
- Exit型を活用した高度な制御
- Defectと通常のエラーを区別した処理

## API設計

```typescript
type EffectResult<A, E> =
  | { _tag: 'Initial' }
  | { _tag: 'Loading' }
  | { _tag: 'Success'; value: A }
  | { _tag: 'Failure'; error: E }
  | { _tag: 'Defect'; cause: Cause.Cause<never> };

function useEffectResult<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    deps?: React.DependencyList;
    runtime?: Runtime.Runtime<R>;
  }
): EffectResult<A, E>
```

**パラメータ:**
- `effect`: 実行するEffect
- `options.deps`: 依存配列（React.useEffectと同様、デフォルトは`[]`）
- `options.runtime`: カスタムランタイム（オプション）

**戻り値:**
- `EffectResult<A, E>`: 判別可能なユニオン型
  - `Initial`: 初期状態（まだ実行されていない）
  - `Loading`: 実行中
  - `Success`: 成功（valueを含む）
  - `Failure`: 失敗（errorを含む）
  - `Defect`: 予期しないエラー（causeを含む）

## 使用例

### 基本的なパターンマッチング

```typescript
import { useEffectResult } from 'effectts-react';
import { Effect } from 'effect';

function UserProfile({ userId }: { userId: string }) {
  const result = useEffectResult(
    Effect.gen(function* () {
      const api = yield* Effect.service(UserAPI);
      return yield* api.getUser(userId);
    }),
    { deps: [userId] }
  );

  // switch文でパターンマッチング
  switch (result._tag) {
    case 'Initial':
    case 'Loading':
      return <Spinner />;

    case 'Success':
      return (
        <div>
          <h1>{result.value.name}</h1>
          <p>{result.value.email}</p>
        </div>
      );

    case 'Failure':
      return (
        <ErrorMessage
          title="Failed to load user"
          error={result.error}
        />
      );

    case 'Defect':
      return <CriticalError cause={result.cause} />;
  }
}
```

### matchヘルパー関数の使用

```typescript
import { useEffectResult, matchEffectResult } from 'effectts-react';

function ProductList() {
  const result = useEffectResult(
    Effect.gen(function* () {
      const api = yield* Effect.service(ProductAPI);
      return yield* api.listProducts();
    }),
    { deps: [] }
  );

  return matchEffectResult(result, {
    onInitial: () => <div>Ready to load</div>,
    onLoading: () => <Spinner />,
    onSuccess: (products) => (
      <ul>
        {products.map(p => (
          <li key={p.id}>
            {p.name} - ${p.price}
          </li>
        ))}
      </ul>
    ),
    onFailure: (error) => <ErrorBanner error={error} />,
    onDefect: (cause) => <FatalError cause={cause} />
  });
}
```

### 複数の結果の組み合わせ

```typescript
function Dashboard() {
  const usersResult = useEffectResult(
    Effect.gen(function* () {
      const api = yield* Effect.service(UserAPI);
      return yield* api.listUsers();
    }),
    { deps: [] }
  );

  const statsResult = useEffectResult(
    Effect.gen(function* () {
      const api = yield* Effect.service(StatsAPI);
      return yield* api.getStats();
    }),
    { deps: [] }
  );

  // 両方が成功した場合のみ表示
  if (usersResult._tag === 'Success' && statsResult._tag === 'Success') {
    return (
      <div>
        <UserList users={usersResult.value} />
        <Statistics stats={statsResult.value} />
      </div>
    );
  }

  // どちらかがローディング中
  if (usersResult._tag === 'Loading' || statsResult._tag === 'Loading') {
    return <Spinner />;
  }

  // エラーハンドリング
  const error = usersResult._tag === 'Failure' ? usersResult.error
    : statsResult._tag === 'Failure' ? statsResult.error
    : null;

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return <div>Initializing...</div>;
}
```

### カスタムランタイムの使用

```typescript
function DataDisplay() {
  const runtime = useRuntime(AppLayer);

  const result = useEffectResult(
    Effect.gen(function* () {
      const db = yield* Effect.service(Database);
      const logger = yield* Effect.service(Logger);

      yield* logger.info('Loading data');
      return yield* db.query('SELECT * FROM data');
    }),
    { runtime, deps: [] }
  );

  return matchEffectResult(result, {
    onLoading: () => <LoadingBar />,
    onSuccess: (data) => <DataTable data={data} />,
    onFailure: (error) => <Alert type="error">{error.message}</Alert>,
    onDefect: (cause) => {
      console.error('Unexpected error:', cause);
      return <Alert type="critical">System error occurred</Alert>;
    }
  });
}
```

### Defectと通常のエラーを区別

```typescript
function RobustComponent() {
  const result = useEffectResult(
    Effect.gen(function* () {
      // 予期されるエラー（Failure）
      const validated = yield* Effect.try({
        try: () => validateInput(input),
        catch: (e) => new ValidationError(e)
      });

      // 予期しないエラーはDefectとして扱われる
      // （例：uncaught exception）
      return validated;
    }),
    { deps: [input] }
  );

  switch (result._tag) {
    case 'Loading':
      return <Spinner />;

    case 'Success':
      return <SuccessView data={result.value} />;

    case 'Failure':
      // 予期されるエラー - ユーザーに表示
      return <ValidationErrorView error={result.error} />;

    case 'Defect':
      // 予期しないエラー - ログ記録 + フォールバック
      logToSentry(result.cause);
      return <FallbackView />;

    default:
      return null;
  }
}
```

## 実装詳細

```typescript
import { useState, useEffect } from 'react';
import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export type EffectResult<A, E> =
  | { _tag: 'Initial' }
  | { _tag: 'Loading' }
  | { _tag: 'Success'; value: A }
  | { _tag: 'Failure'; error: E }
  | { _tag: 'Defect'; cause: Cause.Cause<never> };

export function useEffectResult<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    deps?: React.DependencyList;
    runtime?: Runtime.Runtime<R>;
  }
): EffectResult<A, E> {
  const [result, setResult] = useState<EffectResult<A, E>>({
    _tag: 'Initial'
  });

  const deps = options?.deps || [];

  useEffect(() => {
    let cancelled = false;

    // ローディング状態に設定
    setResult({ _tag: 'Loading' });

    const runEffect = options?.runtime
      ? Runtime.runPromiseExit(options.runtime)
      : Effect.runPromiseExit;

    runEffect(effect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        // 成功
        setResult({ _tag: 'Success', value: exit.value });
      } else {
        // 失敗またはDefect
        const failure = Cause.failureOption(exit.cause);

        if (failure._tag === 'Some') {
          // 通常のエラー（Failure）
          setResult({ _tag: 'Failure', error: failure.value });
        } else {
          // 予期しないエラー（Defect）
          setResult({ _tag: 'Defect', cause: exit.cause });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, deps);

  return result;
}
```

## ヘルパー関数

```typescript
/**
 * EffectResultのパターンマッチングヘルパー
 */
export function matchEffectResult<A, E, R>(
  result: EffectResult<A, E>,
  handlers: {
    onInitial?: () => R;
    onLoading?: () => R;
    onSuccess: (value: A) => R;
    onFailure: (error: E) => R;
    onDefect?: (cause: Cause.Cause<never>) => R;
  }
): R {
  switch (result._tag) {
    case 'Initial':
      return handlers.onInitial?.() ?? (handlers.onLoading?.() as R);

    case 'Loading':
      return handlers.onLoading?.() as R;

    case 'Success':
      return handlers.onSuccess(result.value);

    case 'Failure':
      return handlers.onFailure(result.error);

    case 'Defect':
      return handlers.onDefect?.(result.cause) as R;
  }
}

/**
 * 成功した結果のみを取得
 */
export function getSuccessValue<A, E>(
  result: EffectResult<A, E>
): A | null {
  return result._tag === 'Success' ? result.value : null;
}

/**
 * 失敗した結果のみを取得
 */
export function getFailureError<A, E>(
  result: EffectResult<A, E>
): E | null {
  return result._tag === 'Failure' ? result.error : null;
}

/**
 * ローディング中かどうか
 */
export function isLoading<A, E>(
  result: EffectResult<A, E>
): boolean {
  return result._tag === 'Loading' || result._tag === 'Initial';
}

/**
 * 成功したかどうか（型ガード）
 */
export function isSuccess<A, E>(
  result: EffectResult<A, E>
): result is { _tag: 'Success'; value: A } {
  return result._tag === 'Success';
}

/**
 * 失敗したかどうか（型ガード）
 */
export function isFailure<A, E>(
  result: EffectResult<A, E>
): result is { _tag: 'Failure'; error: E } {
  return result._tag === 'Failure';
}

/**
 * Defectかどうか（型ガード）
 */
export function isDefect<A, E>(
  result: EffectResult<A, E>
): result is { _tag: 'Defect'; cause: Cause.Cause<never> } {
  return result._tag === 'Defect';
}
```

### 実装の特徴

- ✅ 判別可能なユニオン型による型安全なパターンマッチング
- ✅ Initial/Loading/Success/Failure/Defectの明確な状態分離
- ✅ TypeScriptの型推論が完全に機能
- ✅ Exit型との完全な統合
- ✅ 豊富なヘルパー関数
- ✅ カスタムランタイムのサポート

### エッジケース

#### 1. 初期状態の扱い
```typescript
// コンポーネントマウント直後はInitial状態
// deps配列が空でもuseEffect実行までInitialのまま
```

#### 2. 中断されたEffect
```typescript
// 依存配列変更による中断は、新しいLoading状態に遷移
// 前の結果は破棄される
```

#### 3. 即座に完了するEffect
```typescript
const result = useEffectResult(Effect.succeed('immediate'), { deps: [] });
// Initial -> Loading -> Success と遷移（非常に短時間）
```

## テストケース

### 基本機能
- ✅ Initial状態の初期化
- ✅ Loading状態への遷移
- ✅ Success状態の設定とvalue取得
- ✅ Failure状態の設定とerror取得
- ✅ Defect状態の設定とcause取得

### パターンマッチング
- ✅ switch文によるパターンマッチング
- ✅ matchEffectResultヘルパーの動作
- ✅ 型ガード関数の正しい型推論

### ヘルパー関数
- ✅ getSuccessValueの動作
- ✅ getFailureErrorの動作
- ✅ isLoadingの判定
- ✅ isSuccess型ガードの動作
- ✅ isFailure型ガードの動作
- ✅ isDefect型ガードの動作

### ランタイム
- ✅ カスタムランタイムでの実行
- ✅ デフォルトランタイムの使用

### 依存配列
- ✅ 依存配列変更時の再実行
- ✅ 空の依存配列での単一実行
- ✅ 複数の値を含む依存配列

### エッジケース
- ✅ 即座に完了するEffectの処理
- ✅ コンポーネントアンマウント時のキャンセル
- ✅ 複数の同時実行

## 既存Hooksとの比較

### useEffectQuery との違い

| 機能 | useEffectQuery | useEffectResult |
|------|---------------|-----------------|
| 戻り値 | `{ data, error, loading }` | `EffectResult<A, E>` |
| パターンマッチング | 個別のif文が必要 | switch文で一箇所 |
| Defectの扱い | errorと同じ | 別の状態（Defect） |
| Initial状態 | なし | あり |
| 型安全性 | 高い | より高い（判別可能） |
| 推奨用途 | 従来のReactパターン | 関数型プログラミングスタイル |

### いつuseEffectResultを使うべきか

✅ **useEffectResultを使う場合:**
- パターンマッチングで状態を処理したい
- Defectと通常のエラーを明確に区別したい
- 関数型プログラミングスタイルを好む
- 型安全性を最大限に活用したい
- Initial状態を明示的に扱いたい

✅ **useEffectQueryを使う場合:**
- シンプルなdata/error/loading構造で十分
- 従来のReactパターンを使いたい
- チームがパターンマッチングに不慣れ

## 関連Hooks

- [useEffectQuery](./useEffectQuery.md) - シンプルなデータフェッチング
- [useEffectRun](./useEffectRun.md) - Fiberベースの高度な制御
- [useEffectCallback](./useEffectCallback.md) - ユーザーインタラクション対応

## 参考

- [Effect Documentation - Exit](https://effect.website/docs/data-types/exit)
- [Effect Documentation - Cause](https://effect.website/docs/error-management/cause)
- TypeScript Discriminated Unions
