# Hooks リネーム提案 - React組み込みhooksとの衝突回避

## 概要

React組み込みhooksとの名前衝突を避けるため、以下のhooksのリネームを提案します。

## 衝突しているHooks

### 1. useRef ❌ 重大な衝突

**現在の名前**: `useRef`
**衝突するReact hook**: `React.useRef`

**問題点**:
- React.useRefは最も頻繁に使用される組み込みhookの1つ
- インポート時に名前衝突が発生
- IDEの自動補完で混乱を招く
- 開発者の認知負荷が高い

**影響範囲**: ✅ 実装済み

#### リネーム案

##### 案1: `useEffectRef` ⭐ 推奨

```typescript
import { useEffectRef } from 'effectts-react';
import { useRef } from 'react'; // 衝突なし

function MyComponent() {
  const reactRef = useRef(null);           // React.useRef
  const { value, update } = useEffectRef(0); // Effect-TS Ref
}
```

**メリット**:
- Effect-TSのRefを使用していることが明確
- React.useRefとの区別が容易
- 命名規則が一貫（useEffectQuery, useEffectRefなど）

**デメリット**:
- 名前が少し長い

##### 案2: `useAtomicRef`

```typescript
import { useAtomicRef } from 'effectts-react';
```

**メリット**:
- アトミックな操作を強調
- 技術的に正確

**デメリット**:
- Effect-TSとの関連性が不明確
- 初見の開発者には理解しづらい

##### 案3: `useMutableRef`

```typescript
import { useMutableRef } from 'effectts-react';
```

**メリット**:
- ミュータブルな性質を強調

**デメリット**:
- React.useRefもミュータブルなので混乱の可能性

##### 案4: `useRefValue`

```typescript
import { useRefValue } from 'effectts-react';
```

**メリット**:
- 値を管理することを強調

**デメリット**:
- やや曖昧

### 推奨: 案1 `useEffectRef`

最も明確で、ライブラリの命名規則とも一貫性があります。

---

## 潜在的な衝突（注意が必要）

### 2. useDeferred ⚠️ 注意

**現在の名前**: `useDeferred` （提案中）
**類似するReact hook**: `React.useDeferredValue`

**問題点**:
- 名前が似ているが、機能は全く異なる
- React.useDeferredValueは値の遅延レンダリング用
- useDeferred（提案）はEffect-TSのDeferred用

**影響範囲**: 📋 提案中

#### リネーム案

##### 案1: `useEffectDeferred` ⭐ 推奨

```typescript
import { useEffectDeferred } from 'effectts-react';
import { useDeferredValue } from 'react'; // 衝突なし
```

**メリット**:
- React.useDeferredValueと明確に区別
- Effect-TSのDeferredであることが明確

##### 案2: そのまま `useDeferred`

```typescript
import { useDeferred } from 'effectts-react';
```

**メリット**:
- 簡潔
- useDeferredValueとは完全に異なる単語

**判断**:
- React.useDeferredValueと完全に異なる名前（Deferred vs DeferredValue）
- 機能も全く異なるため、混乱は少ないと予想
- **そのまま維持でも可**

---

## 実装計画

### Phase 1: useRef → useEffectRef のリネーム

#### 1.1 ソースコードの変更

```bash
# ファイル名の変更
mv src/useRef.ts src/useEffectRef.ts
mv src/useRef.test.ts src/useEffectRef.test.ts
```

#### 1.2 コード内の変更

**src/useEffectRef.ts**:
```typescript
// Before
export function useRef<A>(initialValue: A): { ... }

// After
export function useEffectRef<A>(initialValue: A): { ... }
```

**src/index.ts**:
```typescript
// Before
export { useRef } from './useRef';

// After
export { useEffectRef } from './useEffectRef';
```

#### 1.3 テストの更新

**src/useEffectRef.test.ts**:
```typescript
// Before
import { useRef } from './useRef';
describe('useRef', () => { ... });

// After
import { useEffectRef } from './useEffectRef';
describe('useEffectRef', () => { ... });
```

#### 1.4 ドキュメントの更新

- `specs/useRef.md` → `specs/useEffectRef.md`
- `README.md`の全ての参照を更新
- `specs/index.md`のリンクを更新

#### 1.5 後方互換性（オプション）

移行期間中の後方互換性を保つため、deprecatedエクスポートを追加:

```typescript
// src/index.ts
export { useEffectRef } from './useEffectRef';

/** @deprecated Use useEffectRef instead to avoid conflicts with React.useRef */
export { useEffectRef as useRef } from './useEffectRef';
```

---

## マイグレーションガイド

### ユーザー向け

#### Before:
```typescript
import { useRef } from 'effectts-react';
import { useRef as useReactRef } from 'react'; // 回避策が必要

function MyComponent() {
  const reactRef = useReactRef(null);
  const { value, update } = useRef(0); // 混乱しやすい
}
```

#### After:
```typescript
import { useEffectRef } from 'effectts-react';
import { useRef } from 'react'; // 衝突なし！

function MyComponent() {
  const reactRef = useRef(null);           // React.useRef
  const { value, update } = useEffectRef(0); // Effect-TS Ref
}
```

---

## その他の関連Hook名の確認

以下のhooksはReact組み込みhooksと衝突していません:

### 実装済み ✅
- ✅ `useEffectQuery` - 衝突なし
- ✅ `useRuntime` - 衝突なし
- ✅ `usePoll` - 衝突なし
- ✅ `useSynchronizedRef` - 衝突なし
- ✅ `useSubscriptionRef` - 衝突なし

### 提案中 📋
- ✅ `useManagedRuntime` - 衝突なし
- ✅ `useRuntimeContext` - 衝突なし
- ✅ `useStream` - 衝突なし
- ✅ `useStreamValue` - 衝突なし
- ✅ `useService` - 衝突なし
- ✅ `useLayer` - 衝突なし
- ✅ `useProvideService` - 衝突なし
- ✅ `useFiber` - 衝突なし
- ✅ `useQueue` - 衝突なし
- ⚠️ `useDeferred` - 注意（useDeferredValueと類似）→ 維持可能
- ✅ `useRequest` - 衝突なし
- ✅ `useCachedRequest` - 衝突なし
- ✅ `useSchedule` - 衝突なし
- ✅ `useRetry` - 衝突なし
- ✅ `useConfig` - 衝突なし
- ✅ `useConfigProvider` - 衝突なし

---

## 命名規則の統一

リネーム後の命名パターン:

### パターン1: Effect-TS機能を直接ラップ
- `useEffectRef` - Effect Ref
- `useSynchronizedRef` - SynchronizedRef
- `useSubscriptionRef` - SubscriptionRef
- `useFiber` - Fiber
- `useStream` - Stream

### パターン2: React向けの抽象化
- `useEffectQuery` - Effectの実行とクエリ
- `usePoll` - ポーリング機能
- `useRuntime` - ランタイム管理

### パターン3: 複合機能
- `useManagedRuntime` - 管理されたランタイム
- `useCachedRequest` - キャッシュ付きリクエスト

---

## アクション項目

- [ ] `useRef` → `useEffectRef` へのリネーム実装
- [ ] テストの更新
- [ ] ドキュメントの更新
- [ ] READMEの更新
- [ ] マイグレーションガイドの作成
- [ ] CHANGELOG への記載
- [ ] メジャーバージョンアップ or deprecation warning

---

## 推奨タイムライン

### 即座に実施（Breaking Change）
次のメジャーバージョン（v1.0.0）で実施:
- `useRef` → `useEffectRef`

### 段階的移行（Deprecation）
1. v0.2.0: deprecation warning追加
2. v0.3.0: 警告継続
3. v1.0.0: 完全削除

**推奨**: まだv0.1.0なので、Breaking Changeとして即座に実施
