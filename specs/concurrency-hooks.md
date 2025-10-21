# 並行処理・Fiber管理Hooks

## useFiber

### 概要
Effect Fiberを管理し、バックグラウンドタスクの開始・停止・監視を行うhook。

### ユースケース
- バックグラウンドタスク
- キャンセル可能な非同期処理
- 並行処理の制御

### API設計

```typescript
function useFiber<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    autoStart?: boolean;
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
  }
): {
  start: () => void;
  interrupt: () => void;
  status: 'idle' | 'running' | 'done' | 'failed' | 'interrupted';
  result: A | null;
  error: E | null;
}
```

### 使用例

```typescript
import { useFiber } from 'effectts-react';

function FileUploader({ file }: { file: File }) {
  const uploadEffect = Effect.gen(function* () {
    const uploader = yield* Effect.service(FileUploadService);
    return yield* uploader.upload(file);
  });

  const {
    start,
    interrupt,
    status,
    result,
  } = useFiber(uploadEffect, {
    autoStart: false,
    onSuccess: (url) => console.log('Upload complete:', url),
    onFailure: (err) => console.error('Upload failed:', err),
  });

  return (
    <div>
      {status === 'idle' && (
        <button onClick={start}>Start Upload</button>
      )}
      {status === 'running' && (
        <button onClick={interrupt}>Cancel</button>
      )}
      {status === 'done' && (
        <div>Uploaded: {result}</div>
      )}
    </div>
  );
}
```

### 複数Fiberの管理例

```typescript
function BatchProcessor({ items }: { items: string[] }) {
  const processItem = (item: string) =>
    Effect.gen(function* () {
      yield* Effect.sleep('100 millis');
      return `Processed: ${item}`;
    });

  const fibers = items.map((item) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFiber(processItem(item), { autoStart: true })
  );

  const allDone = fibers.every((f) => f.status === 'done');

  return (
    <div>
      {fibers.map((fiber, i) => (
        <div key={i}>
          Item {i}: {fiber.status} - {fiber.result}
        </div>
      ))}
      {allDone && <div>All items processed!</div>}
    </div>
  );
}
```

### 実装詳細

```typescript
export function useFiber<A, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    autoStart?: boolean;
    onSuccess?: (value: A) => void;
    onFailure?: (error: E) => void;
  }
): {
  start: () => void;
  interrupt: () => void;
  status: 'idle' | 'running' | 'done' | 'failed' | 'interrupted';
  result: A | null;
  error: E | null;
} {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed' | 'interrupted'>('idle');
  const [result, setResult] = useState<A | null>(null);
  const [error, setError] = useState<E | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);

  const start = useCallback(() => {
    setStatus('running');

    const fiber = Effect.runFork(effect);
    fiberRef.current = fiber;

    Fiber.join(fiber).pipe(
      Effect.flatMap((value) =>
        Effect.sync(() => {
          setResult(value);
          setStatus('done');
          options?.onSuccess?.(value);
        })
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          setError(err);
          setStatus('failed');
          options?.onFailure?.(err);
        })
      ),
      Effect.runPromise
    );
  }, [effect]);

  const interrupt = useCallback(() => {
    if (fiberRef.current) {
      Fiber.interrupt(fiberRef.current).pipe(Effect.runPromise);
      setStatus('interrupted');
    }
  }, []);

  useEffect(() => {
    if (options?.autoStart) {
      start();
    }

    return () => {
      if (fiberRef.current) {
        Fiber.interrupt(fiberRef.current).pipe(Effect.runPromise);
      }
    };
  }, []);

  return { start, interrupt, status, result, error };
}
```

### テストケース
- ✅ Fiberの開始
- ✅ Fiberの中断
- ✅ 自動開始
- ✅ 成功時のコールバック
- ✅ 失敗時のコールバック
- ✅ アンマウント時のクリーンアップ

---

## useQueue

### 概要
Effect Queueを管理し、並行処理用のキューを提供するhook。

### API設計

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

### 使用例

```typescript
import { useQueue } from 'effectts-react';

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

### 実装詳細

```typescript
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

### テストケース
- ✅ キューの作成
- ✅ 値の追加
- ✅ 値の取得
- ✅ キャパシティ制限
- ✅ サイズ追跡

---

## useDeferred

### 概要
Deferredを管理し、外部から解決可能なPromiseのような値を提供するhook。

### API設計

```typescript
function useDeferred<A, E = never>(): {
  deferred: Deferred.Deferred<A, E> | null;
  succeed: (value: A) => Promise<boolean>;
  fail: (error: E) => Promise<boolean>;
  await: () => Promise<A>;
  isDone: boolean;
}
```

### 使用例

```typescript
import { useDeferred } from 'effectts-react';

function AsyncButton() {
  const { succeed, fail, await: awaitDeferred } = useDeferred<string, Error>();

  const handleClick = async () => {
    // Simulate async operation
    setTimeout(() => {
      if (Math.random() > 0.5) {
        succeed('Success!');
      } else {
        fail(new Error('Failed!'));
      }
    }, 1000);

    const result = await awaitDeferred();
    console.log('Result:', result);
  };

  return <button onClick={handleClick}>Start Async Operation</button>;
}
```

### 実装詳細

```typescript
export function useDeferred<A, E = never>(): {
  deferred: Deferred.Deferred<A, E> | null;
  succeed: (value: A) => Promise<boolean>;
  fail: (error: E) => Promise<boolean>;
  await: () => Promise<A>;
  isDone: boolean;
} {
  const [deferred, setDeferred] = useState<Deferred.Deferred<A, E> | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    Effect.runPromise(Deferred.make<A, E>()).then(setDeferred);
  }, []);

  const succeed = useCallback(
    async (value: A): Promise<boolean> => {
      if (!deferred) return false;
      const result = await Effect.runPromise(Deferred.succeed(deferred, value));
      setIsDone(true);
      return result;
    },
    [deferred]
  );

  const fail = useCallback(
    async (error: E): Promise<boolean> => {
      if (!deferred) return false;
      const result = await Effect.runPromise(Deferred.fail(deferred, error));
      setIsDone(true);
      return result;
    },
    [deferred]
  );

  const await = useCallback(async (): Promise<A> => {
    if (!deferred) throw new Error('Deferred not initialized');
    return Effect.runPromise(Deferred.await(deferred));
  }, [deferred]);

  return { deferred, succeed, fail, await, isDone };
}
```

### テストケース
- ✅ Deferredの作成
- ✅ 成功による解決
- ✅ エラーによる解決
- ✅ await
- ✅ 完了状態の追跡
