# Effect-TS React Hooks - Design Specifications

このディレクトリには、effectts-reactライブラリのカスタムhooksの設計仕様が含まれています。

## 📚 ドキュメント構成

### 実装済みHooks
- **[useEffectQuery.md](./useEffectQuery.md)** - 非同期データ取得
- **[useRuntime.md](./useRuntime.md)** - ランタイム管理
- **[usePoll.md](./usePoll.md)** - 定期実行
- **[useEffectRef.md](./useEffectRef.md)** - 可変ステート
- **[useSynchronizedRef.md](./useSynchronizedRef.md)** - effectful更新
- **[useSubscriptionRef.md](./useSubscriptionRef.md)** - リアクティブステート

### 提案中のHooks
- **[runtime-hooks.md](./runtime-hooks.md)** - ランタイム管理hooks
- **[stream-hooks.md](./stream-hooks.md)** - ストリーム処理hooks
- **[service-hooks.md](./service-hooks.md)** - サービス・依存性注入hooks
- **[concurrency-hooks.md](./concurrency-hooks.md)** - 並行処理hooks
- **[request-hooks.md](./request-hooks.md)** - リクエスト最適化hooks

### その他
- **[summary.md](./summary.md)** - 実装ロードマップ

## 実装済みHooks ✅

### データフェッチング
- ✅ **[useEffectQuery](./useEffectQuery.md)** - Effectを実行してデータ取得
  - loading/data/error状態管理
  - 依存配列による再実行制御
  - 自動クリーンアップ

### ランタイム管理
- ✅ **[useRuntime](./useRuntime.md)** - Effectランタイムの作成
  - カスタムコンテキストサポート
  - メモ化による最適化

### 定期実行
- ✅ **[usePoll](./usePoll.md)** - 定期的なEffect実行
  - 指定間隔での自動実行
  - リアルタイム更新

### ステート管理
- ✅ **[useEffectRef](./useEffectRef.md)** - Effect Refによるミュータブル参照
  - get/set/update/modify操作
  - 並行アクセス安全

- ✅ **[useSynchronizedRef](./useSynchronizedRef.md)** - アトミックなeffectful更新
  - updateEffectメソッド
  - 並行更新の順序保証

- ✅ **[useSubscriptionRef](./useSubscriptionRef.md)** - リアクティブなステート管理
  - 自動UI更新
  - changesストリーム購読

## 提案中の新規hooks

### ランタイム管理
- 📋 [useManagedRuntime](./runtime-hooks.md#usemanagedruntime) - カスタムランタイムの管理
- 📋 [useRuntimeContext](./runtime-hooks.md#useruntimecontext) - ランタイムコンテキストの提供

### サービス・依存性注入
- 📋 [useService](./service-hooks.md#useservice) - Effect Serviceの利用
- 📋 [useLayer](./service-hooks.md#uselayer) - Layerによるサービス提供
- 📋 [useProvideService](./service-hooks.md#useprovideservice) - サービスの提供

### ストリーム処理
- 📋 [useStream](./stream-hooks.md#usestream) - Effect Streamの購読
- 📋 [useStreamValue](./stream-hooks.md#usestreamvalue) - Stream値の取得

### 並行処理・Fiber管理
- 📋 [useFiber](./concurrency-hooks.md#usefiber) - Fiberの管理
- 📋 [useQueue](./concurrency-hooks.md#usequeue) - 並行キューの管理
- 📋 [useDeferred](./concurrency-hooks.md#usedeferred) - Deferred値の管理

### リクエスト最適化
- 📋 [useRequest](./request-hooks.md#userequest) - リクエストバッチング
- 📋 [useCachedRequest](./request-hooks.md#usecachedrequest) - キャッシュ付きリクエスト

### スケジューリング
- 📋 [useSchedule](./schedule-hooks.md#useschedule) - リトライロジックとスケジューリング
- 📋 [useRetry](./schedule-hooks.md#useretry) - 自動リトライ

### 設定管理
- 📋 [useConfig](./config-hooks.md#useconfig) - 設定値の読み込み
- 📋 [useConfigProvider](./config-hooks.md#useconfigprovider) - カスタム設定プロバイダー

## 優先度

### High Priority (Phase 1)
1. `useManagedRuntime` - 高度なランタイム管理
2. `useStream` - リアクティブデータストリーム
3. `useService` - 依存性注入の基本

### Medium Priority (Phase 2)
4. `useLayer` - サービス構成
5. `useRequest` - リクエスト最適化
6. `useFiber` - 並行処理制御

### Low Priority (Phase 3)
7. `useSchedule` - スケジューリング
8. `useConfig` - 設定管理
9. その他のユーティリティhooks

## 設計原則

1. **型安全性** - 完全なTypeScript型推論
2. **コンポーザビリティ** - hooks間での組み合わせ可能
3. **React準拠** - Reactのルールに従う
4. **パフォーマンス** - 不要な再レンダリングを避ける
5. **クリーンアップ** - 適切なリソース解放
6. **エラーハンドリング** - 明示的なエラー型
