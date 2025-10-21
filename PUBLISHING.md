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

## バージョン管理

### バージョンの更新

パッケージを更新する際は、セマンティックバージョニングに従ってバージョンを更新します：

```bash
# パッチバージョンの更新（バグフィックス）
npm version patch

# マイナーバージョンの更新（新機能追加、後方互換性あり）
npm version minor

# メジャーバージョンの更新（破壊的変更）
npm version major
```

バージョン更新後、再度公開します：

```bash
npm publish
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

## ベストプラクティス

1. **git tagの作成**: バージョンごとにgit tagを作成
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **CHANGELOG.mdの作成**: 変更履歴を記録

3. **GitHub Actionsでの自動公開**: CI/CDパイプラインを構築

4. **テストの追加**: 公開前にテストを実行

5. **ドキュメントの充実**: READMEを詳細に記述
