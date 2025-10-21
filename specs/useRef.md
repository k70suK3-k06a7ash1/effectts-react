# useRef

**ステータス**: ✅ 実装済み

## 概要

Effect RefによるミュータブルなステートをReactで管理するhook。並行アクセスに安全な可変参照を提供。

## ユースケース

- 共有可変ステート
- カウンター実装
- アキュムレーター
- 並行処理での状態管理
- 複雑な状態更新ロジック

## API設計

```typescript
function useRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
}
```

**パラメータ:**
- `initialValue`: Refの初期値

**戻り値:**
- `value`: 現在の値（Reactステートと同期）
- `loading`: 初期化中かどうか
- `get`: 値を取得する関数
- `set`: 値を設定する関数
- `update`: 関数で値を更新する関数
- `modify`: 値を更新して結果も返す関数

## 使用例

### シンプルなカウンター

```typescript
import { useRef } from 'effectts-react';

function Counter() {
  const { value, loading, set, update } = useRef(0);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => update(n => n + 1)}>+1</button>
      <button onClick={() => update(n => n - 1)}>-1</button>
      <button onClick={() => set(0)}>Reset</button>
    </div>
  );
}
```

### ショッピングカート

```typescript
interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

function ShoppingCart() {
  const { value: items, update, modify } = useRef<CartItem[]>([]);

  const addItem = async (item: CartItem) => {
    await update(cart => {
      const existing = cart.find(i => i.id === item.id);
      if (existing) {
        return cart.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...cart, item];
    });
  };

  const removeItem = async (itemId: string) => {
    await update(cart => cart.filter(i => i.id !== itemId));
  };

  const getTotalPrice = async () => {
    const total = await modify(cart => {
      const sum = cart.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      );
      return [sum, cart]; // [計算結果, 新しい状態]
    });
    return total;
  };

  return (
    <div>
      <h2>Shopping Cart</h2>
      {items?.map(item => (
        <div key={item.id}>
          {item.name} x {item.quantity} = ${item.price * item.quantity}
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <button onClick={getTotalPrice}>Calculate Total</button>
    </div>
  );
}
```

### フォームステート管理

```typescript
interface FormData {
  name: string;
  email: string;
  message: string;
}

function ContactForm() {
  const { value: formData, update, get } = useRef<FormData>({
    name: '',
    email: '',
    message: '',
  });

  const updateField = (field: keyof FormData) => (value: string) => {
    update(data => ({ ...data, [field]: value }));
  };

  const handleSubmit = async () => {
    const data = await get();
    console.log('Submitting:', data);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <input
        value={formData?.name || ''}
        onChange={e => updateField('name')(e.target.value)}
        placeholder="Name"
      />
      <input
        value={formData?.email || ''}
        onChange={e => updateField('email')(e.target.value)}
        placeholder="Email"
      />
      <textarea
        value={formData?.message || ''}
        onChange={e => updateField('message')(e.target.value)}
        placeholder="Message"
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## 実装詳細

```typescript
export function useRef<A>(initialValue: A): {
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<Ref.Ref<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(Ref.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);

      Effect.runPromise(Ref.get(r)).then((v) => {
        if (cancelled) return;
        setValue(v);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const get = useCallback(async (): Promise<A> => {
    if (!ref) throw new Error('Ref not initialized');
    const result = await Effect.runPromise(Ref.get(ref));
    setValue(result);
    return result;
  }, [ref]);

  const set = useCallback(async (newValue: A): Promise<void> => {
    if (!ref) throw new Error('Ref not initialized');
    await Effect.runPromise(Ref.set(ref, newValue));
    setValue(newValue);
  }, [ref]);

  const update = useCallback(async (f: (a: A) => A): Promise<void> => {
    if (!ref) throw new Error('Ref not initialized');
    await Effect.runPromise(Ref.update(ref, f));
    const newValue = await Effect.runPromise(Ref.get(ref));
    setValue(newValue);
  }, [ref]);

  const modify = useCallback(async <B>(f: (a: A) => readonly [B, A]): Promise<B> => {
    if (!ref) throw new Error('Ref not initialized');
    const result = await Effect.runPromise(Ref.modify(ref, f));
    const newValue = await Effect.runPromise(Ref.get(ref));
    setValue(newValue);
    return result;
  }, [ref]);

  return {
    value,
    loading,
    get,
    set,
    update,
    modify,
  };
}
```

### 実装の特徴

- ✅ `Ref.make`で初期化
- ✅ ReactステートとEffect Refを同期
- ✅ 全操作が非同期（Promiseベース）
- ✅ 並行アクセスに安全
- ✅ `modify`で計算結果と更新を同時実行

## テストケース

- ✅ 初期値での初期化
- ✅ 値の取得（get）
- ✅ 値の設定（set）
- ✅ 関数による更新（update）
- ✅ modify操作
- ✅ 文字列値のサポート
- ✅ オブジェクト値のサポート

## 関連Hooks

- [useSynchronizedRef](./useSynchronizedRef.md) - effectful更新のサポート
- [useSubscriptionRef](./useSubscriptionRef.md) - リアクティブな自動更新
