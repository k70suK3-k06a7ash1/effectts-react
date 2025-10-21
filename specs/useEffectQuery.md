# useEffectQuery

**ステータス**: ✅ 実装済み

## 概要

Effectを実行してその結果をReactコンポーネントで取得するhook。非同期処理の状態（loading, data, error）を自動管理する。

## ユースケース

- API呼び出し
- データフェッチング
- 非同期計算
- 副作用を伴う処理

## API設計

```typescript
function useEffectQuery<A, E>(
  effect: Effect.Effect<A, E>,
  deps?: React.DependencyList
): {
  data: A | null;
  error: E | null;
  loading: boolean;
}
```

**パラメータ:**
- `effect`: 実行するEffect
- `deps`: 依存配列（React.useEffectと同様）

**戻り値:**
- `data`: 成功時のデータ（初期値・エラー時は`null`）
- `error`: エラー時のエラー値（成功時は`null`）
- `loading`: ローディング状態

## 使用例

### 基本的な使用例

```typescript
import { useEffectQuery } from 'effectts-react';
import * as Effect from 'effect/Effect';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading } = useEffectQuery(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        fetch(`/api/users/${userId}`).then(r => r.json())
      );
      return response;
    }),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  return <div>{data?.name}</div>;
}
```

### エラーハンドリングとリトライ

```typescript
function DataFetcher() {
  const { data, error, loading } = useEffectQuery(
    Effect.gen(function* () {
      const api = yield* Effect.service(ApiService);
      const users = yield* api.getUsers();

      // データ変換
      return users.map(u => ({
        id: u.id,
        displayName: `${u.firstName} ${u.lastName}`
      }));
    }).pipe(
      Effect.retry({ times: 3 }),
      Effect.timeout('5 seconds')
    ),
    []
  );

  return (
    <div>
      {loading && <Spinner />}
      {error && <ErrorMessage error={error} />}
      {data && <UserList users={data} />}
    </div>
  );
}
```

### 依存配列による再実行

```typescript
function SearchResults({ query }: { query: string }) {
  const { data, loading } = useEffectQuery(
    Effect.gen(function* () {
      if (!query) return [];

      const response = yield* Effect.promise(() =>
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
          .then(r => r.json())
      );

      return response.results;
    }),
    [query] // queryが変更されるたびに再実行
  );

  if (loading) return <div>Searching...</div>;

  return (
    <ul>
      {data?.map(item => <li key={item.id}>{item.title}</li>)}
    </ul>
  );
}
```

## 実装詳細

```typescript
export function useEffectQuery<A, E>(
  effect: Effect.Effect<A, E>,
  deps: React.DependencyList = []
): {
  data: A | null;
  error: E | null;
  loading: boolean;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useReactEffect(() => {
    let cancelled = false;

    setState({ data: null, error: null, loading: true });

    Effect.runPromiseExit(effect).then((exit) => {
      if (cancelled) return;

      if (Exit.isSuccess(exit)) {
        setState({ data: exit.value, error: null, loading: false });
      } else {
        const failure = Cause.failureOption(exit.cause);
        setState({
          data: null,
          error: failure._tag === 'Some' ? failure.value : null,
          loading: false
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}
```

### 実装の特徴

- ✅ `Effect.runPromiseExit`で実行し、`Exit`型を使って成功・失敗を判定
- ✅ `Cause.failureOption`でエラーを抽出
- ✅ コンポーネントアンマウント時の`cancelled`フラグでメモリリーク防止
- ✅ 依存配列による再実行制御
- ✅ 各実行時にstateをリセットしてローディング状態に戻す

## テストケース

- ✅ 初期ローディング状態の確認
- ✅ 成功時のデータ取得
- ✅ エラー時のエラー取得
- ✅ 依存配列変更時の再実行
- ✅ 非同期Effect処理
- ✅ アンマウント時のクリーンアップ

## 関連Hooks

- [usePoll](./usePoll.md) - 定期的なEffect実行
- [useRuntime](./useRuntime.md) - カスタムランタイムでの実行
