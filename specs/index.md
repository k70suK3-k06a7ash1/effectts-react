# Effect-TS React Hooks - Design Specifications

このディレクトリには、effectts-reactライブラリに追加予定のカスタムhooksの設計仕様が含まれています。

## 現在実装済み

- ✅ `useEffectQuery` - Effectを実行して結果を取得
- ✅ `useRuntime` - Effectランタイムの作成
- ✅ `usePoll` - 定期的なEffect実行
- ✅ `useRef` - Effect Refによるミュータブル参照
- ✅ `useSynchronizedRef` - アトミックなeffectful更新
- ✅ `useSubscriptionRef` - リアクティブなステート管理

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
