# useDeferred

**ステータス**: 📋 提案中

## 概要
Deferredを管理し、外部から解決可能なPromiseのような値を提供するhook。

## ユースケース
- 外部イベントによる非同期処理の完了
- 手動での値の解決・拒否が必要な場面
- 複数の非同期処理の調整
- ユーザー操作待ちの処理

## API設計

```typescript
function useDeferred<A, E = never>(): {
  deferred: Deferred.Deferred<A, E> | null;
  succeed: (value: A) => Promise<boolean>;
  fail: (error: E) => Promise<boolean>;
  await: () => Promise<A>;
  isDone: boolean;
}
```

**パラメータ:**
なし

**戻り値:**
- `deferred` - Effect Deferred インスタンス
- `succeed` - 成功値で解決する関数
- `fail` - エラーで解決する関数
- `await` - 解決を待機する関数
- `isDone` - 解決済みかどうか

## 使用例

### 基本的な使用例

```typescript
import { useDeferred } from 'effectts-react';
import * as Effect from 'effect/Effect';

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

### ユーザー確認ダイアログ

```typescript
import { useDeferred } from 'effectts-react';
import { useState } from 'react';

function ConfirmationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { succeed, fail, await: awaitConfirmation, isDone } =
    useDeferred<boolean, Error>();

  const requestConfirmation = async () => {
    setIsOpen(true);
    try {
      const confirmed = await awaitConfirmation();
      console.log('User confirmed:', confirmed);
      return confirmed;
    } catch (error) {
      console.log('User cancelled');
      return false;
    } finally {
      setIsOpen(false);
    }
  };

  const handleConfirm = () => {
    succeed(true);
  };

  const handleCancel = () => {
    succeed(false);
  };

  return (
    <div>
      <button onClick={requestConfirmation}>
        Request Confirmation
      </button>

      {isOpen && (
        <div className="dialog">
          <p>Are you sure?</p>
          <button onClick={handleConfirm}>Yes</button>
          <button onClick={handleCancel}>No</button>
        </div>
      )}
    </div>
  );
}
```

### 複数の非同期処理の調整

```typescript
import { useDeferred } from 'effectts-react';
import { useEffect } from 'react';

function MultiStepProcess() {
  const step1 = useDeferred<string, Error>();
  const step2 = useDeferred<string, Error>();
  const step3 = useDeferred<string, Error>();

  useEffect(() => {
    const runProcess = async () => {
      try {
        const result1 = await step1.await();
        console.log('Step 1 complete:', result1);

        const result2 = await step2.await();
        console.log('Step 2 complete:', result2);

        const result3 = await step3.await();
        console.log('Step 3 complete:', result3);

        console.log('All steps complete!');
      } catch (error) {
        console.error('Process failed:', error);
      }
    };

    runProcess();
  }, []);

  return (
    <div>
      <button onClick={() => step1.succeed('Step 1 done')}>
        Complete Step 1
      </button>
      <button onClick={() => step2.succeed('Step 2 done')}>
        Complete Step 2
      </button>
      <button onClick={() => step3.succeed('Step 3 done')}>
        Complete Step 3
      </button>
    </div>
  );
}
```

## 実装詳細

```typescript
import { useEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Deferred from 'effect/Deferred';

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

## テストケース
- ✅ Deferredの作成
- ✅ 成功による解決（succeed）
- ✅ エラーによる解決（fail）
- ✅ await による待機
- ✅ 完了状態の追跡（isDone）
- ✅ 初期化前のエラーハンドリング
- ✅ アンマウント時のクリーンアップ

## 関連Hooks
- [useFiber](./useFiber.md) - Fiber管理によるバックグラウンド処理
- [useQueue](./useQueue.md) - 並行処理用のキュー管理
- [useEffectRun](./useEffectRun.md) - シンプルなEffect実行

## 参考
- [Effect Deferred Documentation](https://effect.website/docs/concurrency/deferred)
