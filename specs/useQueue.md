# useQueue

**ステータス**: 📋 提案中

## 概要
Effect Queueを管理し、並行処理用のキューを提供するhook。

## ユースケース
- タスクキューの管理
- プロデューサー・コンシューマーパターン
- レート制限付き処理
- バッファリングが必要な処理

## API設計

```typescript
function useQueue<A>(
  capacity?: number
): {
  queue: Queue.Queue<A> | null;
  offer: (value: A) => Promise<boolean>;
  take: () => Promise<A>;
  size: number;
  isEmpty: boolean;
  isFull: boolean;
}
```

**パラメータ:**
- `capacity` - キューの最大容量（デフォルト: 100）

**戻り値:**
- `queue` - Effect Queue インスタンス
- `offer` - キューに値を追加する関数
- `take` - キューから値を取得する関数
- `size` - 現在のキューサイズ
- `isEmpty` - キューが空かどうか
- `isFull` - キューが満杯かどうか

## 使用例

### 基本的な使用例

```typescript
import { useQueue } from 'effectts-react';
import * as Effect from 'effect/Effect';

function TaskQueue() {
  const { queue, offer, take, size } = useQueue<Task>(10);

  const addTask = async (task: Task) => {
    const added = await offer(task);
    if (!added) {
      console.error('Queue is full');
    }
  };

  const processNext = async () => {
    const task = await take();
    console.log('Processing:', task);
  };

  return (
    <div>
      <div>Queue size: {size}</div>
      <button onClick={() => addTask({ id: Date.now() })}>
        Add Task
      </button>
      <button onClick={processNext}>Process Next</button>
    </div>
  );
}
```

### プロデューサー・コンシューマーパターン

```typescript
import { useQueue } from 'effectts-react';
import { useEffect } from 'react';

interface Message {
  id: number;
  content: string;
}

function MessageProcessor() {
  const { offer, take, size, isEmpty } = useQueue<Message>(50);

  // プロデューサー: メッセージを生成してキューに追加
  const produceMessage = async (content: string) => {
    const message = { id: Date.now(), content };
    await offer(message);
  };

  // コンシューマー: キューからメッセージを取得して処理
  useEffect(() => {
    const processMessages = async () => {
      while (!isEmpty) {
        const message = await take();
        console.log('Processing message:', message);
        // メッセージ処理ロジック
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    processMessages();
  }, [isEmpty, take]);

  return (
    <div>
      <div>Queued messages: {size}</div>
      <button onClick={() => produceMessage('Hello')}>
        Send Message
      </button>
    </div>
  );
}
```

## 実装詳細

```typescript
import { useEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';

export function useQueue<A>(
  capacity: number = 100
): {
  queue: Queue.Queue<A> | null;
  offer: (value: A) => Promise<boolean>;
  take: () => Promise<A>;
  size: number;
  isEmpty: boolean;
  isFull: boolean;
} {
  const [queue, setQueue] = useState<Queue.Queue<A> | null>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const effect = Queue.bounded<A>(capacity);

    Effect.runPromise(effect).then((q) => {
      setQueue(q);
    });
  }, [capacity]);

  const offer = useCallback(
    async (value: A): Promise<boolean> => {
      if (!queue) return false;
      return Effect.runPromise(Queue.offer(queue, value));
    },
    [queue]
  );

  const take = useCallback(async (): Promise<A> => {
    if (!queue) throw new Error('Queue not initialized');
    return Effect.runPromise(Queue.take(queue));
  }, [queue]);

  return {
    queue,
    offer,
    take,
    size,
    isEmpty: size === 0,
    isFull: size >= capacity,
  };
}
```

## テストケース
- ✅ キューの作成
- ✅ 値の追加（offer）
- ✅ 値の取得（take）
- ✅ キャパシティ制限
- ✅ サイズ追跡
- ✅ isEmpty状態の確認
- ✅ isFull状態の確認
- ✅ アンマウント時のクリーンアップ

## 関連Hooks
- [useFiber](./useFiber.md) - Fiber管理によるバックグラウンド処理
- [useDeferred](./useDeferred.md) - 外部から解決可能な値の管理
- [useStream](./useStream.md) - ストリーム処理

## 参考
- [Effect Queue Documentation](https://effect.website/docs/concurrency/queue)
