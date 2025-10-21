# Specs ディレクトリ - 記載ルール

このディレクトリには、effectts-reactライブラリのカスタムhooksの設計仕様が含まれています。

## ファイル命名規則

### ✅ 正しい命名

各hookは**個別のファイル**として、以下の命名規則に従う必要があります：

```
useXXX.md
```

**例:**
- `useEffectQuery.md`
- `useEffectRun.md`
- `useRuntime.md`
- `useService.md`
- `useStream.md`
- `usePoll.md`

### ❌ 誤った命名

以下のような命名は**禁止**です：

```
❌ runtime-hooks.md        （複数のhooksをまとめたファイル）
❌ service-hooks.md        （複数のhooksをまとめたファイル）
❌ stream-hooks.md         （複数のhooksをまとめたファイル）
❌ concurrency-hooks.md    （複数のhooksをまとめたファイル）
❌ request-hooks.md        （複数のhooksをまとめたファイル）
```

### 例外

以下のファイルは例外として許可されます：

- `index.md` - 全体のインデックス
- `summary.md` - 実装ロードマップ
- `README.md` - このドキュメント
- `rename-proposal.md` - 提案書類

## ファイル構成

各hookの仕様ファイルは、以下の構成に従う必要があります：

```markdown
# useXXX

**ステータス**: ✅ 実装済み / 📋 提案中

## 概要
hookの目的と機能の概要

## ユースケース
- ユースケース1
- ユースケース2
- ...

## API設計
​```typescript
function useXXX<A, E>(...): ReturnType {
  // 型定義
}
​```

**パラメータ:**
- 各パラメータの説明

**戻り値:**
- 戻り値の説明

## 使用例

### 基本的な使用例
​```typescript
// 実装可能なレベルのコード例
​```

### より複雑な例
​```typescript
// 実装可能なレベルのコード例
​```

## 実装詳細

​```typescript
// 完全な実装コード
export function useXXX<A, E>(...): ReturnType {
  // 実装
}
​```

### 実装の特徴
- ✅ 特徴1
- ✅ 特徴2

### エッジケース
実装時に注意すべきエッジケースの説明

## テストケース
- ✅ テストケース1
- ✅ テストケース2
- ...

## 既存Hooksとの比較（必要に応じて）
類似hookとの違いを明確化

## 関連Hooks
- [useXXX](./useXXX.md) - 説明

## 参考
- Effect Documentation リンク
```

## 必須セクション

各仕様ファイルには、以下のセクションが**必須**です：

1. ✅ **タイトル** - `# useXXX`
2. ✅ **ステータス** - 実装済み or 提案中
3. ✅ **概要** - hookの目的
4. ✅ **ユースケース** - 具体的な使用場面
5. ✅ **API設計** - TypeScript型定義
6. ✅ **使用例** - 実装可能なレベルのコード例（複数）
7. ✅ **実装詳細** - 完全な実装コード
8. ✅ **テストケース** - テスト項目のリスト
9. ✅ **関連Hooks** - 関連するhooksへのリンク

## 推奨セクション

以下のセクションは、必要に応じて追加することを推奨：

- **実装の特徴** - 実装上の重要なポイント
- **エッジケース** - 注意すべきエッジケース
- **既存Hooksとの比較** - 類似hookとの違い
- **ヘルパー関数** - 関連するユーティリティ関数
- **参考** - Effect Documentation等へのリンク

## 粒度の基準

### ✅ 適切な粒度

仕様は**実装できるレベルの粒度**で記述する必要があります：

```typescript
// ✅ Good - 完全な実装コード
export function useEffectQuery<A, E>(
  effect: Effect.Effect<A, E>,
  deps: React.DependencyList = []
): {
  data: A | null;
  error: E | null;
  loading: boolean;
} {
  const [state, setState] = useState<{
    data: A | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    // 完全な実装...
  }, deps);

  return state;
}
```

### ❌ 不適切な粒度

```typescript
// ❌ Bad - 抽象的すぎる
export function useEffectQuery(effect, deps) {
  // Effectを実行する
  // 結果を返す
}
```

## 使用例の基準

### ✅ 適切な使用例

```typescript
// ✅ Good - 実際に動作するコード
import { useEffectQuery } from 'effectts-react';
import * as Effect from 'effect/Effect';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading } = useEffectQuery(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        fetch(`/api/users/${userId}`).then(r => r.json())
      );
      return response;
    }),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  return <div>{data?.name}</div>;
}
```

### ❌ 不適切な使用例

```typescript
// ❌ Bad - 抽象的で実装できない
function MyComponent() {
  const result = useEffectQuery(someEffect);
  // なんかする
}
```

## コード品質

### TypeScript型定義

- 完全な型パラメータの定義
- パラメータと戻り値の型を明示
- ジェネリック型の適切な使用

### 実装コード

- 実際に動作するコード
- エッジケースの処理を含む
- コメントで重要なポイントを説明

### 使用例

- 最低2つ以上の使用例を含む
- 基本的な例と、より複雑な例の両方
- 実際のユースケースを反映

## ファイル管理

### 新しいhookを追加する場合

1. `useXXX.md`ファイルを作成
2. 上記の構成に従って記述
3. `index.md`の該当セクションにリンクを追加
4. 必要に応じて`summary.md`を更新

### 既存のhookを更新する場合

1. 該当する`useXXX.md`ファイルを編集
2. ステータスを更新（提案中 → 実装済み等）
3. 実装詳細を最新の実装に合わせる

## チェックリスト

新しい仕様ファイルを作成する際は、以下を確認：

- [ ] ファイル名が`useXXX.md`形式
- [ ] ステータスが明記されている
- [ ] API設計に完全な型定義がある
- [ ] 使用例が2つ以上ある
- [ ] 実装詳細に完全なコードがある
- [ ] テストケースがリストされている
- [ ] 関連Hooksへのリンクがある
- [ ] コードが実際に動作するレベルで記述されている
- [ ] `index.md`にリンクを追加した

## 参考

既存の良い例：
- [useEffectQuery.md](./useEffectQuery.md)
- [useRuntime.md](./useRuntime.md)
- [usePoll.md](./usePoll.md)
- [useEffectRef.md](./useEffectRef.md)
