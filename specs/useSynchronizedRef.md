# useSynchronizedRef

**ステータス**: ✅ 実装済み

## 概要

SynchronizedRefによるアトミックなeffectful更新を行うhook。Effect内での状態更新が必要な場合に使用し、並行更新の順序を保証する。

## ユースケース

- 副作用を伴う状態更新
- データベース操作後の状態更新
- API呼び出し後の状態更新
- 並行処理での順序保証
- トランザクショナルな状態管理

## API設計

```typescript
function useSynchronizedRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  updateEffect: <E>(f: (a: A) => Effect.Effect<A, E, never>) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
}
```

**パラメータ:**
- `initialValue`: 初期値

**戻り値:**
- useRefと同じ + `updateEffect`メソッド

### updateEffectメソッド

`updateEffect`は、Effect内で副作用を実行しながら状態を更新するための特別なメソッドです。

```typescript
updateEffect: <E>(f: (a: A) => Effect.Effect<A, E, never>) => Promise<void>
```

## 使用例

### API呼び出し後の状態更新

```typescript
import { useSynchronizedRef } from 'effectts-react';
import * as Effect from 'effect/Effect';

function UserList() {
  const { value, loading, updateEffect } = useSynchronizedRef<User[]>([]);

  const fetchAndAddUser = async () => {
    await updateEffect(users =>
      Effect.gen(function* () {
        // API呼び出し
        const response = yield* Effect.promise(() =>
          fetch('/api/user/random').then(r => r.json())
        );

        // ログ記録
        yield* Effect.sync(() =>
          console.log('Fetched user:', response.name)
        );

        // 既存リストに追加
        return [...users, response];
      })
    );
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={fetchAndAddUser}>Add Random User</button>
      <ul>
        {value?.map((user, i) => <li key={i}>{user.name}</li>)}
      </ul>
    </div>
  );
}
```

### 並行更新の順序保証

```typescript
function ConcurrentUpdater() {
  const { value, updateEffect } = useSynchronizedRef<number[]>([]);

  const addMultipleItems = async () => {
    // これらは開始順に実行される（SynchronizedRefの特性）
    await Promise.all([
      updateEffect(arr =>
        Effect.gen(function* () {
          yield* Effect.sleep('100 millis');
          console.log('Adding 1');
          return [...arr, 1];
        })
      ),
      updateEffect(arr =>
        Effect.gen(function* () {
          yield* Effect.sleep('50 millis');
          console.log('Adding 2');
          return [...arr, 2];
        })
      ),
      updateEffect(arr =>
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis');
          console.log('Adding 3');
          return [...arr, 3];
        })
      ),
    ]);

    // 結果: [1, 2, 3] （実行開始順）
  };

  return (
    <div>
      <button onClick={addMultipleItems}>Add Items</button>
      <div>Items: {JSON.stringify(value)}</div>
    </div>
  );
}
```

### データベース操作を伴う更新

```typescript
interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

function TodoList() {
  const { value: todos, updateEffect } = useSynchronizedRef<TodoItem[]>([]);

  const addTodo = async (title: string) => {
    await updateEffect(currentTodos =>
      Effect.gen(function* () {
        const db = yield* Effect.service(Database);

        // データベースに保存
        const newTodo = yield* db.insert('todos', {
          title,
          completed: false,
        });

        // ログ記録
        const logger = yield* Effect.service(Logger);
        yield* logger.info(`Created todo: ${newTodo.id}`);

        // ローカル状態に追加
        return [...currentTodos, newTodo];
      })
    );
  };

  const toggleTodo = async (id: string) => {
    await updateEffect(currentTodos =>
      Effect.gen(function* () {
        const db = yield* Effect.service(Database);
        const todo = currentTodos.find(t => t.id === id);

        if (!todo) return currentTodos;

        // データベースを更新
        yield* db.update('todos', id, {
          completed: !todo.completed,
        });

        // ローカル状態を更新
        return currentTodos.map(t =>
          t.id === id ? { ...t, completed: !t.completed } : t
        );
      })
    );
  };

  return (
    <div>
      {todos?.map(todo => (
        <div key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
          />
          {todo.title}
        </div>
      ))}
    </div>
  );
}
```

### エラーハンドリング付き更新

```typescript
function DataFetcher() {
  const { value, updateEffect } = useSynchronizedRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      await updateEffect(items =>
        Effect.gen(function* () {
          const response = yield* Effect.promise(() =>
            fetch('/api/data').then(r => {
              if (!r.ok) throw new Error('Fetch failed');
              return r.json();
            })
          );

          // リトライ付き
        }).pipe(
          Effect.retry({ times: 3, schedule: Schedule.exponential('100 millis') }),
          Effect.timeout('5 seconds')
        )
      );
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
      {error && <div>Error: {error}</div>}
      <div>Items: {value?.length}</div>
    </div>
  );
}
```

## 実装詳細

```typescript
export function useSynchronizedRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  updateEffect: <E>(f: (a: A) => Effect.Effect<A, E, never>) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<SynchronizedRef.SynchronizedRef<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(SynchronizedRef.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      Effect.runPromise(SynchronizedRef.get(r)).then((v) => {
        if (cancelled) return;
        setValue(v);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateEffect = useCallback(async <E>(
    f: (a: A) => Effect.Effect<A, E, never>
  ): Promise<void> => {
    if (!ref) throw new Error('SynchronizedRef not initialized');
    await Effect.runPromise(SynchronizedRef.updateEffect(ref, f));
    const newValue = await Effect.runPromise(SynchronizedRef.get(ref));
    setValue(newValue);
  }, [ref]);

  // ... その他のメソッド

  return {
    value,
    loading,
    get,
    set,
    update,
    updateEffect,
    modify,
  };
}
```

### 実装の特徴

- ✅ `SynchronizedRef.make`で初期化
- ✅ `updateEffect`メソッドの提供
- ✅ 並行更新の順序保証（開始順に実行）
- ✅ Effect内での副作用実行可能
- ✅ トランザクショナルな更新

### useRefとの違い

| 機能 | useRef | useSynchronizedRef |
|------|--------|-------------------|
| 基本的な更新 | ✅ | ✅ |
| effectful更新 | ❌ | ✅ (updateEffect) |
| 並行更新の順序 | 保証なし | 開始順に保証 |
| 副作用の実行 | 外部で実行 | Effect内で実行可能 |

## テストケース

- ✅ 初期値での初期化
- ✅ 基本的な更新操作（get/set/update）
- ✅ effectful更新（updateEffect）
- ✅ 並行更新の順序保証
- ✅ Effect内での副作用実行

## 関連Hooks

- [useRef](./useRef.md) - シンプルな可変参照
- [useSubscriptionRef](./useSubscriptionRef.md) - リアクティブな自動更新
