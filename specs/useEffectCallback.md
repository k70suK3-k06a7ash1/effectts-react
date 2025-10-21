# useEffectCallback

**ステータス**: ✅ 実装済み

## 概要

ユーザーインタラクション（ボタンクリック、フォーム送信など）から Effect を実行するためのhook。イベントハンドラ内で Effect を安全に実行し、その状態を管理します。

## ユースケース

- フォーム送信処理
- ボタンクリックによるAPI呼び出し
- ユーザーアクションに応じた非同期処理
- 手動トリガーによるデータ更新
- 楽観的更新パターン
- ミューテーション操作

## API設計

```typescript
function useEffectCallback<A, E = never, Args extends any[] = []>(
  createEffect: (...args: Args) => Effect.Effect<A, E>,
  options?: {
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
  }
): {
  execute: (...args: Args) => Promise<void>;
  data: A | null;
  error: E | null;
  loading: boolean;
  reset: () => void;
}
```

**パラメータ:**
- `createEffect`: 引数を受け取ってEffectを生成する関数
- `options.onSuccess`: 成功時のコールバック
- `options.onFailure`: 失敗時のコールバック

**戻り値:**
- `execute`: Effectを実行する非同期関数
- `data`: 成功時のデータ（初期値・エラー時は`null`）
- `error`: エラー時のエラー値（成功時は`null`）
- `loading`: 実行中かどうか
- `reset`: 状態をリセットする関数

## 使用例

### 基本的なフォーム送信

```typescript
import { useEffectCallback } from 'effectts-react';
import { Effect } from 'effect';

function LoginForm() {
  const { execute, loading, error } = useEffectCallback(
    (email: string, password: string) =>
      Effect.gen(function* () {
        const api = yield* Effect.service(AuthAPI);
        const session = yield* api.login(email, password);
        return session;
      }),
    {
      onSuccess: (session) => {
        console.log('Logged in:', session.userId);
        navigate('/dashboard');
      },
      onFailure: (error) => {
        console.error('Login failed:', error);
      }
    }
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await execute(
      formData.get('email') as string,
      formData.get('password') as string
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

### データの更新とreset

```typescript
function UserSettings({ userId }: { userId: string }) {
  const {
    execute: updateName,
    loading,
    error,
    data,
    reset
  } = useEffectCallback(
    (newName: string) =>
      Effect.gen(function* () {
        const api = yield* Effect.service(UserAPI);
        const updated = yield* api.updateUser(userId, { name: newName });
        return updated;
      }),
    {
      onSuccess: () => {
        toast.success('Name updated successfully!');
      }
    }
  );

  const handleUpdate = async () => {
    const name = prompt('Enter new name:');
    if (name) {
      await execute(name);
    }
  };

  return (
    <div>
      <button onClick={handleUpdate} disabled={loading}>
        Update Name
      </button>
      {loading && <Spinner />}
      {error && (
        <div>
          <ErrorMessage error={error} />
          <button onClick={reset}>Dismiss</button>
        </div>
      )}
      {data && <p>Updated to: {data.name}</p>}
    </div>
  );
}
```

### 楽観的更新

```typescript
function TodoItem({ todo }: { todo: Todo }) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(
    todo.completed
  );

  const { execute: toggleComplete, loading } = useEffectCallback(
    (completed: boolean) =>
      Effect.gen(function* () {
        const api = yield* Effect.service(TodoAPI);
        return yield* api.updateTodo(todo.id, { completed });
      }),
    {
      onFailure: () => {
        // エラー時は楽観的更新をロールバック
        setOptimisticCompleted(todo.completed);
        toast.error('Failed to update todo');
      }
    }
  );

  const handleToggle = async () => {
    const newCompleted = !optimisticCompleted;
    // 楽観的更新
    setOptimisticCompleted(newCompleted);
    // サーバーに送信
    await execute(newCompleted);
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={optimisticCompleted}
        onChange={handleToggle}
        disabled={loading}
      />
      <span style={{ opacity: loading ? 0.5 : 1 }}>
        {todo.title}
      </span>
    </div>
  );
}
```

### 複数のミューテーション

```typescript
function PostActions({ postId }: { postId: string }) {
  const like = useEffectCallback(
    () =>
      Effect.gen(function* () {
        const api = yield* Effect.service(PostAPI);
        return yield* api.likePost(postId);
      }),
    {
      onSuccess: () => toast.success('Liked!')
    }
  );

  const delete = useEffectCallback(
    () =>
      Effect.gen(function* () {
        const api = yield* Effect.service(PostAPI);
        yield* api.deletePost(postId);
        return { deleted: true };
      }),
    {
      onSuccess: () => {
        toast.success('Post deleted');
        navigate('/posts');
      }
    }
  );

  return (
    <div>
      <button
        onClick={() => like.execute()}
        disabled={like.loading}
      >
        {like.loading ? 'Liking...' : 'Like'}
      </button>
      <button
        onClick={() => {
          if (confirm('Delete this post?')) {
            delete.execute();
          }
        }}
        disabled={delete.loading}
      >
        {delete.loading ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}
```

### ファイルアップロード

```typescript
function FileUploader() {
  const { execute, loading, error, data, reset } = useEffectCallback(
    (file: File) =>
      Effect.gen(function* () {
        const api = yield* Effect.service(StorageAPI);

        // プログレスを報告しながらアップロード
        const formData = new FormData();
        formData.append('file', file);

        const result = yield* api.uploadFile(formData);
        return result;
      }),
    {
      onSuccess: (result) => {
        console.log('Uploaded:', result.url);
      }
    }
  );

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      reset(); // 前の状態をクリア
      await execute(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        disabled={loading}
      />
      {loading && <ProgressBar />}
      {error && <ErrorMessage error={error} />}
      {data && (
        <div>
          <p>Upload complete!</p>
          <a href={data.url} target="_blank">View file</a>
        </div>
      )}
    </div>
  );
}
```

### リトライとタイムアウト

```typescript
function RobustSubmit() {
  const { execute, loading, error } = useEffectCallback(
    (formData: FormData) =>
      Effect.gen(function* () {
        const api = yield* Effect.service(FormAPI);
        return yield* api.submit(formData);
      }).pipe(
        // リトライとタイムアウトをEffectレベルで設定
        Effect.retry({ times: 3, schedule: Schedule.exponential('100 millis') }),
        Effect.timeout('30 seconds')
      ),
    {
      onSuccess: () => toast.success('Submitted!'),
      onFailure: (error) => toast.error(`Failed: ${error.message}`)
    }
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await execute(new FormData(e.currentTarget));
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

## 実装詳細

```typescript
import { useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';

export function useEffectCallback<A, E = never, Args extends any[] = []>(
  createEffect: (...args: Args) => Effect.Effect<A, E>,
  options?: {
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
  }
): {
  execute: (...args: Args) => Promise<void>;
  data: A | null;
  error: E | null;
  loading: boolean;
  reset: () => void;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: false
  });

  const execute = useCallback(
    async (...args: Args) => {
      // ローディング開始
      setState({ data: null, error: null, loading: true });

      // Effectを生成して実行
      const effect = createEffect(...args);
      const exit = await Effect.runPromiseExit(effect);

      if (Exit.isSuccess(exit)) {
        // 成功
        setState({ data: exit.value, error: null, loading: false });
        options?.onSuccess?.(exit.value);
      } else {
        // 失敗
        const failure = Cause.failureOption(exit.cause);
        const error = failure._tag === 'Some' ? failure.value : null;

        setState({ data: null, error, loading: false });

        if (error) {
          options?.onFailure?.(error);
        }
      }
    },
    [createEffect, options?.onSuccess, options?.onFailure]
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    execute,
    data: state.data,
    error: state.error,
    loading: state.loading,
    reset
  };
}
```

### 実装の特徴

- ✅ 引数を受け取る`createEffect`関数
- ✅ `execute`関数による手動実行
- ✅ Promise返却による await 可能性
- ✅ 成功・失敗コールバックのサポート
- ✅ `reset`による状態のクリア
- ✅ TypeScriptの完全な型推論
- ✅ useCallbackによるメモ化

### エッジケース

#### 1. 連続したexecute呼び出し
```typescript
// 前の実行は無視され、最新の実行のみが状態に反映される
await execute(arg1);
await execute(arg2); // これが最終的な状態になる
```

#### 2. コンポーネントアンマウント中の実行完了
```typescript
// 実装では状態更新前にコンポーネントがアンマウントされても
// エラーは発生しない（useCallbackの依存配列による）
```

#### 3. execute中のreset呼び出し
```typescript
// reset()を呼んでも実行中のEffectは止まらない
// 完了時に状態が上書きされる
```

## テストケース

### 基本機能
- ✅ execute関数の呼び出し
- ✅ 引数の正しい渡し方
- ✅ ローディング状態の管理（false → true → false）
- ✅ 成功時のdata設定
- ✅ エラー時のerror設定

### コールバック
- ✅ 成功時のonSuccessコールバック実行
- ✅ 失敗時のonFailureコールバック実行
- ✅ コールバックへの正しい値の渡し方

### reset機能
- ✅ reset関数による状態のクリア
- ✅ reset後の再execute

### 複数実行
- ✅ 連続したexecute呼び出し
- ✅ 並行したexecute呼び出し（同一hook内）
- ✅ 複数のuseEffectCallback使用（異なるhook）

### 型推論
- ✅ 引数の型推論
- ✅ 戻り値の型推論
- ✅ エラー型の推論

### エッジケース
- ✅ コンポーネントアンマウント中の完了
- ✅ execute中のreset呼び出し
- ✅ オプションなしでの使用

## 既存Hooksとの比較

### useEffectQuery / useEffectRun との違い

| 機能 | useEffectQuery | useEffectRun | useEffectCallback |
|------|---------------|--------------|-------------------|
| 実行タイミング | 自動（mount/deps変更） | 自動（mount/deps変更） | 手動（execute呼び出し） |
| execute関数 | ❌ | ✅ (rerun) | ✅ (引数付き) |
| 引数の受け渡し | deps経由 | deps経由 | execute引数 |
| 推奨用途 | データフェッチ | 長時間タスク | ユーザーアクション |

### いつuseEffectCallbackを使うべきか

✅ **useEffectCallbackを使う場合:**
- ユーザーインタラクションによる実行
- フォーム送信
- ボタンクリック
- ミューテーション操作
- 引数を渡して実行したい
- 楽観的更新

✅ **useEffectQuery/useEffectRunを使う場合:**
- 自動実行が必要
- データフェッチ
- コンポーネントマウント時の処理

## 関連Hooks

- [useEffectQuery](./useEffectQuery.md) - 自動実行されるデータフェッチ
- [useEffectRun](./useEffectRun.md) - Fiberベースの高度な制御
- [useEffectResult](./useEffectResult.md) - パターンマッチング

## 参考

- [Effect Documentation - Running Effects](https://effect.website/docs/running-effects)
- React - Event Handlers
- React - Forms
