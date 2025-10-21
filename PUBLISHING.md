# npmパッケージ公開手順

このドキュメントでは、`effectts-react`パッケージをnpmに公開する手順を説明します。

## 事前準備

### 1. npmアカウントの作成

npmアカウントを持っていない場合は作成してください：
https://www.npmjs.com/signup

### 2. npmへのログイン

ターミナルでnpmにログインします：

```bash
npm login
```

ユーザー名、パスワード、メールアドレスを入力してください。

### 3. package.jsonの設定を確認

公開前に以下の項目を確認・更新してください：

```json
{
  "name": "effectts-react",  // パッケージ名（既に使われていないか確認）
  "version": "0.1.0",        // セマンティックバージョニングに従う
  "author": "",              // 作者名を追加
  "repository": {
    "type": "git",
    "url": "https://github.com/k70suK3-k06a7ash1/effectts-react"                // GitHubリポジトリURLを追加
  }
}
```

### 4. パッケージ名の確認

パッケージ名が既に使われていないか確認します：

```bash
npm search effectts-react
```

もし既に使われている場合は、`package.json`の`name`フィールドを変更してください。
例：`@yourname/effectts-react` のようにスコープ付きパッケージにする

## 公開手順

### 1. ビルドの実行

```bash
npm run build
```

エラーがないことを確認してください。

### 2. 型チェックの実行

```bash
npm run typecheck
```

### 3. パッケージ内容の確認

公開されるファイルを確認します：

```bash
npm pack --dry-run
```

または実際に`.tgz`ファイルを作成して確認：

```bash
npm pack
tar -tzf effectts-react-*.tgz
```

### 4. 公開

初回公開の場合：

```bash
npm publish
```

スコープ付きパッケージを公開パッケージとして公開する場合：

```bash
npm publish --access public
```

### 5. 公開の確認

公開が成功したら、npmのウェブサイトで確認できます：
https://www.npmjs.com/package/effectts-react

## バージョン管理と公開（Effect-TS Pipeline）

このプロジェクトでは、Effect-TSを使用したpublishスクリプトとMakefileコマンドを提供しています。

### 自動公開スクリプト

Effect-TSのpipelineを使った自動公開スクリプトが `scripts/publish.ts` にあります。
このスクリプトは以下を自動で実行します：

1. バージョンのインクリメント
2. package.jsonの更新
3. gitコミット作成
4. gitタグ作成
5. npm publish

### Makeコマンドでの公開（推奨）

```bash
# パッチバージョン公開（バグフィックス: 0.1.0 → 0.1.1）
make publish-patch

# マイナーバージョン公開（新機能追加: 0.1.0 → 0.2.0）
make publish-minor

# メジャーバージョン公開（破壊的変更: 0.1.0 → 1.0.0）
make publish-major
```

これらのコマンドは自動的に以下を実行します：
- `npm run typecheck` - 型チェック
- `npm test` - テスト実行
- `npm run build` - ビルド
- バージョン更新とnpm publish

### Dry-runモード（テスト実行）

実際にpublishせずに動作確認する場合：

```bash
# スクリプトを直接実行
npx tsx scripts/publish.ts patch --dry-run
npx tsx scripts/publish.ts minor --dry-run
npx tsx scripts/publish.ts major --dry-run
```

### 手動でのバージョン更新

従来の方法でバージョンを更新することも可能です：

```bash
# パッチバージョンの更新（バグフィックス）
npm version patch

# マイナーバージョンの更新（新機能追加、後方互換性あり）
npm version minor

# メジャーバージョンの更新（破壊的変更）
npm version major
```

バージョン更新後、手動で公開：

```bash
npm publish
```

### 公開後の作業

自動スクリプトを使用した場合、git push を忘れずに実行してください：

```bash
git push && git push --tags
```

## トラブルシューティング

### パッケージ名が既に使われている

エラー: `You do not have permission to publish "effectts-react"`

解決策：
1. パッケージ名を変更する
2. スコープ付きパッケージにする（例：`@yourname/effectts-react`）

### 認証エラー

エラー: `You must be logged in to publish packages`

解決策：
```bash
npm logout
npm login
```

### .npmignoreの確認

意図しないファイルが公開されないよう、`.npmignore`を確認してください。

## スクリプトの仕組み

`scripts/publish.ts` は以下のEffect-TS機能を使用しています：

- **Pattern Matching**: バージョンタイプ（major/minor/patch）の処理
- **Effect Pipeline**: 型安全な非同期処理
- **@effect/platform**: ファイルシステム・コマンド実行
- **Effect.gen**: ジェネレーター構文による直感的な処理フロー

詳細は `scripts/publish.ts` のソースコードを参照してください。

## ベストプラクティス

1. **Makeコマンドを使用**: 自動的にテスト・ビルド・公開を実行
   ```bash
   make publish-patch
   ```

2. **dry-runで事前確認**: 本番実行前に必ず確認
   ```bash
   npx tsx scripts/publish.ts patch --dry-run
   ```

3. **CHANGELOG.mdの作成**: 変更履歴を記録

4. **GitHub Actionsでの自動公開**: CI/CDパイプラインを構築

5. **git pushを忘れずに**: タグとコミットをリモートにプッシュ
   ```bash
   git push && git push --tags
   ```
