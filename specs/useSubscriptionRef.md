# useSubscriptionRef

**ステータス**: ✅ 実装済み

## 概要

SubscriptionRefによるリアクティブなステート管理。値の変更を自動的にReactステートに反映し、changesストリームを購読する。

## ユースケース

- リアクティブプログラミング
- 自動UI更新
- 状態の購読
- イベント駆動UI
- 複数コンポーネント間での状態共有

## API設計

```typescript
function useSubscriptionRef<A>(initialValue: A): {
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
- useSynchronizedRefと同じAPI

### 特徴

SubscriptionRefの最大の特徴は、**changesストリームを自動購読し、値の変更を即座にReactステートに反映**することです。手動で`setValue`を呼ぶ必要がありません。

## 使用例

### リアクティブカウンター

```typescript
import { useSubscriptionRef } from 'effectts-react';

function ReactiveCounter() {
  const { value, loading, update } = useSubscriptionRef(0);

  // 値の変更は自動的にUIに反映される
  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => update(n => n + 1)}>+1</button>
      <button onClick={() => update(n => n - 1)}>-1</button>
    </div>
  );
}
```

### リアルタイム通知カウンター

```typescript
function NotificationBadge() {
  const { value: count, updateEffect } = useSubscriptionRef(0);

  useEffect(() => {
    // WebSocketやSSEからの通知を受信
    const eventSource = new EventSource('/api/notifications');

    eventSource.onmessage = () => {
      updateEffect(current =>
        Effect.gen(function* () {
          // 通知音を再生
          yield* Effect.sync(() => {
            new Audio('/notification.mp3').play();
          });

          // カウントを増やす
          return current + 1;
        })
      );
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="badge">
      {count > 0 && <span>{count}</span>}
    </div>
  );
}
```

### フォーム状態の自動同期

```typescript
interface FormState {
  name: string;
  email: string;
  message: string;
  isDirty: boolean;
}

function ContactForm() {
  const { value, update } = useSubscriptionRef<FormState>({
    name: '',
    email: '',
    message: '',
    isDirty: false,
  });

  const updateField = (field: keyof Omit<FormState, 'isDirty'>) =>
    (newValue: string) => {
      update(state => ({
        ...state,
        [field]: newValue,
        isDirty: true, // 自動的にdirtyフラグを立てる
      }));
    };

  // valueは自動的に最新状態に更新される
  return (
    <form>
      <input
        value={value?.name || ''}
        onChange={e => updateField('name')(e.target.value)}
      />
      <input
        value={value?.email || ''}
        onChange={e => updateField('email')(e.target.value)}
      />
      <textarea
        value={value?.message || ''}
        onChange={e => updateField('message')(e.target.value)}
      />
      {value?.isDirty && <div>Unsaved changes</div>}
    </form>
  );
}
```

### ショッピングカートの自動計算

```typescript
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  total: number;
}

function ShoppingCart() {
  const { value: cart, updateEffect } = useSubscriptionRef<CartState>({
    items: [],
    total: 0,
  });

  const addItem = async (item: CartItem) => {
    await updateEffect(current =>
      Effect.gen(function* () {
        const existingIndex = current.items.findIndex(i => i.id === item.id);

        let newItems: CartItem[];
        if (existingIndex >= 0) {
          newItems = current.items.map((i, idx) =>
            idx === existingIndex
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        } else {
          newItems = [...current.items, item];
        }

        // 合計金額を自動計算
        const total = newItems.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        );

        // ログ記録
        yield* Effect.sync(() =>
          console.log(`Cart updated. New total: $${total}`)
        );

        return { items: newItems, total };
      })
    );
  };

  const removeItem = async (itemId: string) => {
    await update(current => {
      const newItems = current.items.filter(i => i.id !== itemId);
      const total = newItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );
      return { items: newItems, total };
    });
  };

  return (
    <div>
      <h2>Shopping Cart</h2>
      {cart?.items.map(item => (
        <div key={item.id}>
          {item.name} x {item.quantity} = ${item.price * item.quantity}
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <div>Total: ${cart?.total}</div>
    </div>
  );
}
```

### 複数コンポーネントでの状態共有

```typescript
// グローバルな状態（コンポーネント外で作成可能）
const createGlobalCounter = () => {
  let refInstance: SubscriptionRef.SubscriptionRef<number> | null = null;

  return {
    getRef: async () => {
      if (!refInstance) {
        refInstance = await Effect.runPromise(
          SubscriptionRef.make(0)
        );
      }
      return refInstance;
    },
  };
};

const globalCounter = createGlobalCounter();

function Counter1() {
  const { value, update } = useSubscriptionRef(0);

  return (
    <div>
      Counter 1: {value}
      <button onClick={() => update(n => n + 1)}>+</button>
    </div>
  );
}

function Counter2() {
  const { value } = useSubscriptionRef(0);

  // 同じrefを参照していれば、Counter1の更新がCounter2にも反映される
  return <div>Counter 2: {value}</div>;
}
```

## 実装詳細

```typescript
export function useSubscriptionRef<A>(initialValue: A): {
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
  const [ref, setRef] = useState<SubscriptionRef.SubscriptionRef<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(SubscriptionRef.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      // changesストリームを購読
      const changesStream = r.changes;
      const effect = Stream.runForEach(changesStream, (newValue) =>
        Effect.sync(() => {
          if (!cancelled) {
            setValue(newValue); // 自動的にReactステート更新
            setLoading(false);
          }
        })
      );

      Effect.runPromise(effect).catch((error) => {
        if (!cancelled) {
          console.error('SubscriptionRef stream error:', error);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // set/update/updateEffectは実行するだけ
  // 値の更新は自動的にchangesストリーム経由で反映される
  const set = useCallback(async (newValue: A): Promise<void> => {
    if (!ref) throw new Error('SubscriptionRef not initialized');
    await Effect.runPromise(SubscriptionRef.set(ref, newValue));
    // setValueは不要！changesストリームが自動更新
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

- ✅ `SubscriptionRef.make`で初期化
- ✅ `changes`ストリームを自動購読
- ✅ 値の変更を自動検知してReactステート更新
- ✅ リアクティブな動作
- ✅ 手動でsetValueを呼ぶ必要なし

### 他のhooksとの違い

| 機能 | useRef | useSynchronizedRef | useSubscriptionRef |
|------|--------|-------------------|-------------------|
| 基本更新 | ✅ | ✅ | ✅ |
| effectful更新 | ❌ | ✅ | ✅ |
| 並行順序保証 | ❌ | ✅ | ✅ |
| 自動UI更新 | 手動 | 手動 | **✅ 自動** |
| changesストリーム | ❌ | ❌ | **✅** |

## テストケース

- ✅ 初期値での初期化
- ✅ 値変更の自動反映
- ✅ 複数回の更新
- ✅ effectful更新
- ✅ modify操作
- ✅ 文字列値のサポート
- ✅ 複雑なオブジェクトの更新
- ✅ 高速連続更新

## 関連Hooks

- [useRef](./useRef.md) - シンプルな可変参照
- [useSynchronizedRef](./useSynchronizedRef.md) - effectful更新
- [useStream](./stream-hooks.md#usestream) - より汎用的なストリーム購読（提案）
