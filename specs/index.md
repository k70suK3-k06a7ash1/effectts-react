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

### 提案中のHooks - Phase 1完了 ✅
- **[useEffectRun.md](./useEffectRun.md)** - Fiberベースの高度なEffect実行
- **[useEffectResult.md](./useEffectResult.md)** - Exit型とパターンマッチング
- **[useEffectCallback.md](./useEffectCallback.md)** - ユーザーインタラクションからのEffect実行
- **[useService.md](./useService.md)** - Effect Serviceの利用（依存性注入）
- **[useStream.md](./useStream.md)** - Effect Streamの購読

### 提案中のHooks - Phase 2完了 ✅
- **[EffectProvider.md](./EffectProvider.md)** - アプリケーション全体への依存性注入
- **[useStreamValue.md](./useStreamValue.md)** - Stream最新値のみ取得（軽量版）
- **[useLayer.md](./useLayer.md)** - Layerの構築とContext取得
- **[useManagedRuntime.md](./useManagedRuntime.md)** - ManagedRuntimeの管理
- **[useRuntimeContext.md](./useRuntimeContext.md)** - ランタイムコンテキストの共有

### 提案中のHooks - Phase 3完了 ✅
- **[useEffectContext.md](./useEffectContext.md)** - Effect Contextの直接取得
- **[useProvideService.md](./useProvideService.md)** - シンプルなサービス提供（ProvideServiceコンポーネント）
- **[useFiber.md](./useFiber.md)** - Fiberの管理とバックグラウンドタスク制御
- **[useQueue.md](./useQueue.md)** - 並行キューの管理
- **[useDeferred.md](./useDeferred.md)** - Deferred値の管理

### その他
- **[README.md](./README.md)** - Specsディレクトリの記載ルール
- **[summary.md](./guidelines/summary.md)** - 実装ロードマップ

### ✅ 規約準拠完了
以下の規約違反ファイルは、すべて個別の`useXXX.md`ファイルに分割されました：
- ✅ ~~runtime-hooks.md~~ → 分割完了（useManagedRuntime.md, useRuntimeContext.md）
- ✅ ~~stream-hooks.md~~ → 分割完了（useStream.md, useStreamValue.md）
- ✅ ~~service-hooks.md~~ → 分割完了（useService.md, EffectProvider.md, useLayer.md, useProvideService.md, useEffectContext.md）
- ✅ ~~concurrency-hooks.md~~ → 分割完了（useFiber.md, useQueue.md, useDeferred.md）
- 📋 request-hooks.md → Phase 4で分割予定（useRequest.md, useCachedRequest.md）

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

### Effect実行 (NEW) ✨
- 📋 **[useEffectRun](./useEffectRun.md)** - Fiberベースのキャンセル機能付きEffect実行
  - Fiber.interruptによる適切なキャンセル処理
  - カスタムランタイムサポート
  - 手動再実行機能
- 📋 **[useEffectResult](./useEffectResult.md)** - Exit型とパターンマッチング
  - 判別可能なユニオン型による型安全な状態管理
  - Initial/Loading/Success/Failure/Defect状態
  - matchヘルパー関数
- 📋 **[useEffectCallback](./useEffectCallback.md)** - ユーザーインタラクションからのEffect実行
  - フォーム送信・ボタンクリック対応
  - 引数付きexecute関数
  - 楽観的更新パターン

### サービス・依存性注入 (NEW) ✨
- 📋 **[useService](./useService.md)** - Effect Serviceの利用
  - Context.Tagからのサービス取得
  - 依存性注入パターン
  - テスト容易性

### ストリーム処理 (NEW) ✨
- 📋 **[useStream](./useStream.md)** - Effect Streamの購読
  - WebSocket/SSE対応
  - リアルタイムデータ購読
  - バッファサイズ管理

### 将来の拡張 (Phase 4以降 - 仕様未作成)

#### リクエスト最適化
- 📋 useRequest - リクエストバッチング
- 📋 useCachedRequest - キャッシュ付きリクエスト

#### スケジューリング
- 📋 useSchedule - リトライロジックとスケジューリング
- 📋 useRetry - 自動リトライ

#### 設定管理
- 📋 useConfig - 設定値の読み込み
- 📋 useConfigProvider - カスタム設定プロバイダー

## 優先度と実装ロードマップ

### ✅ 仕様完成 (Phase 1)
以下のhooksは実装可能なレベルで仕様が定義されています：
1. ✅ **useEffectRun** - Fiberベースの高度なEffect実行
2. ✅ **useEffectResult** - パターンマッチングによる型安全な状態管理
3. ✅ **useEffectCallback** - ユーザーインタラクション対応
4. ✅ **useService** - 依存性注入の基本
5. ✅ **useStream** - リアクティブデータストリーム

### ✅ 仕様完成 (Phase 2 - 完了)
次のhooksも実装可能なレベルで仕様が定義されています：
6. ✅ **EffectProvider** - アプリケーション全体での依存性注入
7. ✅ **useStreamValue** - Stream最新値のみ取得（軽量版）
8. ✅ **useLayer** - サービス構成
9. ✅ **useManagedRuntime** - 高度なランタイム管理
10. ✅ **useRuntimeContext** - グローバルランタイム共有

### ✅ 仕様完成 (Phase 3 - 完了)
高度な機能とコンテキスト操作のhooksが完成しました：
11. ✅ **useEffectContext** - Context直接操作
12. ✅ **useProvideService** - シンプルなサービス提供
13. ✅ **useFiber** - 並行処理制御
14. ✅ **useQueue** - 並行キューの管理
15. ✅ **useDeferred** - Deferred値の管理

### 📋 仕様作成予定 (Phase 4)
16. `useRequest` - リクエストバッチング
17. `useCachedRequest` - キャッシュ付きリクエスト

## 設計原則

1. **型安全性** - 完全なTypeScript型推論
2. **コンポーザビリティ** - hooks間での組み合わせ可能
3. **React準拠** - Reactのルールに従う
4. **パフォーマンス** - 不要な再レンダリングを避ける
5. **クリーンアップ** - 適切なリソース解放
6. **エラーハンドリング** - 明示的なエラー型

## 📝 Specsファイルの記載ルール

新しいhookの仕様を作成する際は、[README.md](./README.md)の記載ルールに従ってください。

### 重要なルール
- ✅ ファイル名は `useXXX.md` 形式
- ✅ 実装できるレベルの粒度で記述
- ✅ 完全な型定義とコード例を含む
- ❌ 複数のhooksをまとめたファイル（`xxx-hooks.md`）は禁止

詳細は [README.md](./README.md) を参照してください。
