# Effect-TS Hooks 実装方法論

このドキュメントは、Effect-TSの複雑なAPIを使用するReact Hooksを実装する際に成功したアプローチをまとめたものです。

## 問題の背景

### 遭遇した課題

`useManagedRuntime`と`useRuntimeContext`の実装時に、以下の問題に直面しました：

1. **型エラー**: ManagedRuntimeの型が期待と異なる
2. **APIの誤解**: ManagedRuntime.makeがEffectを返すと誤解していた
3. **リソース管理**: dispose()の正しい呼び方がわからない

### 失敗したアプローチ

最初の試みでは：
- 公式ドキュメントを読まずに推測で実装
- ManagedRuntime.makeがEffect.Effect<Runtime<R>, E>を返すと思い込んだ
- Effect.runPromise()で無理やり実行しようとした
- 型エラーが解決できず実装を延期

## 成功した方法論

### ステップ1: 公式ドキュメントを徹底的に読む

**重要**: 推測で実装せず、必ず公式ドキュメントから始める。

#### 使用したリソース

1. **Effect-TS公式ドキュメント**
   - Runtime概要: https://effect.website/docs/runtime/
   - ManagedRuntime-specific: セクション内で検索

2. **APIリファレンス**
   - https://effect-ts.github.io/effect/effect/ManagedRuntime.ts.html
   - 各メソッドの型シグネチャを確認

3. **WebFetchツールの活用**
   ```typescript
   WebFetch({
     url: "https://effect.website/docs/runtime/",
     prompt: "Extract information about ManagedRuntime, how to create it, use it, and dispose it."
   })
   ```

### ステップ2: APIの正確な理解

#### ManagedRuntimeの実際のAPI

```typescript
// ❌ 間違った理解
const runtime = await Effect.runPromise(ManagedRuntime.make(layer))

// ✅ 正しい理解
const runtime = ManagedRuntime.make(layer)  // 同期的にManagedRuntimeを返す
await runtime.runtime()  // Promiseを返して実際のRuntimeを準備
```

#### 型シグネチャの確認

```typescript
interface ManagedRuntime<in R, out E> extends Effect.Effect<Runtime.Runtime<R>, E> {
  readonly runtime: () => Promise<Runtime.Runtime<R>>
  readonly runPromise: <A, E>(effect: Effect.Effect<A, E, R>) => Promise<A>
  readonly runFork: <A, E>(effect: Effect.Effect<A, E, R>) => RuntimeFiber<A, E>
  readonly dispose: () => Promise<void>
  readonly disposeEffect: Effect<void, never, never>
}
```

#### 重要な発見

1. **ManagedRuntime.make()は同期的**
   - Effectではなく、直接ManagedRuntimeオブジェクトを返す
   - `Promise<ManagedRuntime>`でもない

2. **runtime()メソッドがPromiseを返す**
   - ランタイムが準備できるまで待つ必要がある
   - これがeffect実行の前提条件

3. **dispose()はPromise<void>**
   - Effect形式のdisposeEffectも利用可能
   - React useEffectのクリーンアップで使用

### ステップ3: TDDアプローチで実装

#### 3.1 テストを先に書く

```typescript
// useManagedRuntime.test.ts
it('should create ManagedRuntime from layer', async () => {
  const testLayer = Layer.succeed(TestService, {
    getValue: () => Effect.succeed('test value'),
  });

  const { result } = renderHook(() => useManagedRuntime(testLayer));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.runtime).not.toBe(null);
  expect(result.current.error).toBe(null);
});
```

#### 3.2 実装を書く

```typescript
export function useManagedRuntime<R, E = never>(
  layer: Layer.Layer<R, E, never>,
  options?: { onError?: (error: E) => void }
) {
  const [state, setState] = useState({
    runtime: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let managedRuntime: ManagedRuntime.ManagedRuntime<R, E> | null = null;

    try {
      // 同期的に作成
      managedRuntime = ManagedRuntime.make(layer);

      // ランタイムが準備できるまで待つ
      managedRuntime.runtime()
        .then(() => {
          if (!cancelled) {
            setState({
              runtime: managedRuntime,
              loading: false,
              error: null,
            });
          }
        })
        .catch((err: E) => {
          if (!cancelled) {
            setState({ runtime: null, loading: false, error: err });
            options?.onError?.(err);
          }
        });
    } catch (err) {
      if (!cancelled) {
        setState({ runtime: null, loading: false, error: err as E });
        options?.onError?.(err as E);
      }
    }

    return () => {
      cancelled = true;
      if (managedRuntime) {
        managedRuntime.dispose().catch(console.error);
      }
    };
  }, [layer, options?.onError]);

  return state;
}
```

#### 3.3 検証と修正

```bash
# テスト実行
npm test -- src/useManagedRuntime.test.ts

# 型チェック
npm run typecheck

# 全体テスト
npm test
```

### ステップ4: 完全な統合

#### エクスポート

```typescript
// src/index.ts
export { useManagedRuntime } from './useManagedRuntime';
export { useRuntimeContext, RuntimeProvider } from './useRuntimeContext';
```

#### 完全なバリデーション

```bash
npm run typecheck && npm test && npm run build
```

## 学んだ教訓

### DO ✅

1. **公式ドキュメントを最初に読む**
   - WebFetchツールを活用してドキュメントを取得
   - APIリファレンスで型シグネチャを確認
   - サンプルコードがあれば必ず参照

2. **型シグネチャを正確に理解する**
   - 推測で決めつけない
   - 戻り値の型を確認（Promise? Effect? 同期?）
   - ジェネリック型パラメータの意味を理解

3. **TDDアプローチを維持する**
   - テストを先に書く
   - 小さいテストから始める
   - 各テストが何を検証しているか明確に

4. **段階的に実装する**
   - まず基本機能
   - 次にエラーハンドリング
   - 最後にエッジケース

### DON'T ❌

1. **推測で実装しない**
   - 「おそらくこうだろう」で進まない
   - 公式ドキュメントを読まずにコードを書かない

2. **型エラーを無視しない**
   - `as any`で逃げない（最終手段のみ）
   - 型エラーは正しい理解の欠如を示している

3. **複雑な実装を一度に書かない**
   - 小さく分割して実装
   - 各ステップでテスト実行

## チェックリスト

新しいEffect-TS hookを実装する際のチェックリスト：

- [ ] 公式ドキュメントを読んだ
- [ ] APIリファレンスで型シグネチャを確認した
- [ ] WebFetchで最新情報を取得した
- [ ] テストケースを作成した
- [ ] 基本実装を完成させた
- [ ] エラーハンドリングを追加した
- [ ] リソースクリーンアップを実装した
- [ ] すべてのテストが通る
- [ ] 型チェックが通る
- [ ] ビルドが成功する

## 参考リソース

### 公式ドキュメント

- **Effect-TS Documentation**: https://effect.website/docs/
- **Runtime Guide**: https://effect.website/docs/runtime/
- **API Reference**: https://effect-ts.github.io/effect/

### ツール活用

```typescript
// WebFetchでドキュメント取得
WebFetch({
  url: "https://effect.website/docs/[topic]/",
  prompt: "Extract API documentation including type signatures and examples"
})

// WebSearchで最新情報検索
WebSearch({
  query: "Effect-TS [API名] documentation 2025"
})
```

## まとめ

Effect-TSのような複雑なライブラリを使用する際：

1. **理解が先、実装は後**
2. **公式ドキュメントが最も信頼できる情報源**
3. **型システムはあなたの味方**
4. **TDDで段階的に進める**

この方法論に従うことで、以前は解決できなかった問題を、再現性のある方法で突破できるようになります。
