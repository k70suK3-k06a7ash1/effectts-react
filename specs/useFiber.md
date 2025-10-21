# useFiber

**ステータス**: 📋 提案中

## 概要
Effect Fiberを管理し、バックグラウンドタスクの開始・停止・監視を行うhook。

## ユースケース
- バックグラウンドタスク
- キャンセル可能な非同期処理
- 並行処理の制御

## API設計

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

**パラメータ:**
- `effect` - 実行するEffect
- `options.autoStart` - 自動的に開始するかどうか（デフォルト: false）
- `options.onSuccess` - 成功時のコールバック
- `options.onFailure` - 失敗時のコールバック

**戻り値:**
- `start` - Fiberを開始する関数
- `interrupt` - Fiberを中断する関数
- `status` - Fiberの現在の状態
- `result` - 成功時の結果値
- `error` - 失敗時のエラー

## 使用例

### 基本的な使用例

```typescript
import { useFiber } from 'effectts-react';
import * as Effect from 'effect/Effect';

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

## 実装詳細

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';

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

## テストケース
- ✅ Fiberの開始
- ✅ Fiberの中断
- ✅ 自動開始
- ✅ 成功時のコールバック
- ✅ 失敗時のコールバック
- ✅ アンマウント時のクリーンアップ

## 関連Hooks
- [useEffectRun](./useEffectRun.md) - シンプルなEffect実行
- [useQueue](./useQueue.md) - 並行処理用のキュー管理
- [useDeferred](./useDeferred.md) - 外部から解決可能な値の管理

## 参考
- [Effect Fiber Documentation](https://effect.website/docs/concurrency/fibers)
