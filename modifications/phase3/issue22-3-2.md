# 修正記録: Issue #22 タスク3.2（3.2.1 + ISSUE-3.2-001修正 + ISSUE-3.2-002修正）

## 概要

このファイルは以下3つの修正を記録します：
1. **タスク3.2.1**: 生成後セットアップ実装
2. **ISSUE-3.2-001**: テンプレート変数置換の誤り修正（QA検出）
3. **ISSUE-3.2-002**: {{packageName}}/プレースホルダー置換エラーの修正（QA検出）

---

## 1. タスク3.2.1 - 生成後セットアップ実装

### 新規作成したファイル

1. `packages/create-einja-app/src/generators/post-setup.ts`
   - 生成後セットアップ処理の実装
   - Git初期化、依存関係インストール、Prismaクライアント生成
   - direnv allow確認・実行
   - @einja/cli初期化
   - 完了メッセージ表示

## 編集したファイル

1. `packages/create-einja-app/src/commands/create.ts`
   - post-setupモジュールをインポート
   - printCompletionMessage関数を削除（post-setupに移動）
   - execPostSetupを呼び出すように変更

## 削除したファイル

なし

## 実装メモ

### 使用した技術
- **execa**: 安全なコマンド実行（array形式でシェルインジェクション防止）
- **ora**: スピナー表示によるユーザーフィードバック
- **inquirer**: direnv allow確認プロンプト
- **chalk**: カラー出力

### 主な実装内容

1. **Git初期化**
   - `git init` → `git add .` → `git commit -m "Initial commit"`
   - skipGitオプションでスキップ可能
   - エラー時は警告メッセージを表示して続行

2. **依存関係インストール**
   - `pnpm install`を実行
   - skipInstallオプションでスキップ可能
   - インストール成功後、`pnpm db:generate`でPrismaクライアント生成

3. **direnv allow**
   - direnvが有効かつコマンドが利用可能な場合のみ実行
   - ユーザーに確認プロンプトを表示
   - エラー時は手動実行を促すメッセージを表示

4. **@einja/cli init**
   - setupEinjaCliがtrueの場合に実行
   - `npx @einja/cli init`を実行
   - エラー時は手動実行を促すメッセージを表示

5. **完了メッセージ**
   - 次のステップを表示:
     - `cd [project-name]`
     - `docker-compose up -d postgres`
     - `pnpm dev`
   - 開発サーバーURL: http://localhost:3000

### 設計上の決定事項

- エラーハンドリング: 各処理でエラーが発生しても、警告メッセージを表示して次の処理に進む設計
- スキップオプション: skipGit、skipInstallで柔軟にセットアップをスキップ可能
- ユーザー確認: direnv allowは確認プロンプトを表示して安全性を確保
- 型安全性: PostSetupOptions型でオプションを明示的に定義

---

## 2. ISSUE-3.2-001 - テンプレート変数置換の誤り修正

### 問題の詳細

**症状**: 生成されたプロジェクトで`pnpm install`が失敗する

**原因**: テンプレート更新スクリプト（`scripts/template-update.ts`）が、`packages/*/package.json`のnameフィールドを全て`{{projectName}}`に変換していた。

**期待される動作**:
- `packages/config/package.json`のnameは`@repo/config`を維持
- `packages/front-core/package.json`のnameは`@repo/front-core`を維持
- `packages/server-core/package.json`のnameは`@repo/server-core`を維持
- `packages/ui/package.json`のnameは`@repo/ui`を維持
- ルートの`package.json`のnameは`{{projectName}}`に変換

**実際の動作**:
全てのパッケージのnameが`{{projectName}}`に変換されていた。

### 編集したファイル

1. `packages/create-einja-app/scripts/template-update.ts`
   - **修正箇所1**: `transformContent`関数のpackage.json変換ロジック（67-71行目）
     - `@repo/`で始まるnameフィールドは変換対象から除外
     - 条件: `if (pkg.name && !pkg.name.startsWith("@repo/"))`
   - **修正箇所2**: ディレクトリ削除処理（135-136行目）
     - `fse.emptyDir()`を追加してディレクトリを空にしてから削除
     - ENOTEMPTYエラーを回避

### 検証結果

テンプレート再生成後、以下を確認：
- ✅ `packages/config/package.json`: `"name": "@repo/config"`
- ✅ `packages/front-core/package.json`: `"name": "@repo/front-core"`
- ✅ `packages/server-core/package.json`: `"name": "@repo/server-core"`
- ✅ `packages/ui/package.json`: `"name": "@repo/ui"`
- ✅ ルート`package.json`: `"name": "{{projectName}}"`

### 影響範囲

- テンプレートファイル: 256個のファイルが再生成された
- 変換されたファイル: 48個（package.json、tsconfig.json、import文）

### 重要な決定事項

**パッケージ名の保護**: 共有パッケージ（`@repo/*`パターン）のnameフィールドは、プロジェクト間で一貫性を保つため、テンプレート変数に変換せず固定値として維持する設計。

---

## 3. ISSUE-3.2-002 - {{packageName}}/プレースホルダー置換エラーの修正

### 問題の詳細

**症状**: 生成されたプロジェクトで型チェックエラーが発生する

**エラー例**:
```
error TS2307: Cannot find module '{{packageName}}/ui/utils'
error TS2307: Cannot find module '{{packageName}}/front-core/auth'
error TS2307: Cannot find module '{{packageName}}/server-core/infrastructure/database/client'
```

**根本原因**:
- テンプレート更新時（`template-update.ts`）: `@repo/` を `{{packageName}}/` に変換
- プロジェクト生成時（`template.ts`）:
  - `{{packageName}}`を`@repo`に置換（末尾の`/`なし）
  - `{{packageName}}/`パターンが置換されずに残り、型エラーが発生

### 編集したファイル

1. `packages/create-einja-app/src/generators/template.ts`
   - **修正箇所**: `replacePlaceholders`関数の置換順序を変更（78-82行目）
   - **修正前**:
     ```typescript
     // {{packageName}} の置換
     result = result.replaceAll("{{packageName}}", variables.packageName);
     ```
   - **修正後**:
     ```typescript
     // {{packageName}}/ の置換（長いパターンを先に置換）
     result = result.replaceAll("{{packageName}}/", `${variables.packageName}/`);

     // {{packageName}} の置換
     result = result.replaceAll("{{packageName}}", variables.packageName);
     ```
   - **理由**: 長いパターン（`{{packageName}}/`）を先に置換しないと、短いパターン（`{{packageName}}`）の置換により`@repo/`となり、意図した置換が行われない

2. `packages/create-einja-app/tests/unit/generators/template.test.ts`
   - **追加**: `{{packageName}}/パターンが正しく置換される`テストケース（262-304行目）
   - **テスト内容**:
     - `{{packageName}}/ui/utils` → `@custom/ui/utils` の置換を検証
     - `{{packageName}}/front-core/auth` → `@custom/front-core/auth` の置換を検証
     - `{{packageName}}/server-core/infrastructure/database/client` → `@custom/server-core/infrastructure/database/client` の置換を検証
     - `{{packageName}}/` パターンが残っていないことを確認

### 検証結果

#### 1. ユニットテスト
```bash
pnpm test
```
結果: ✅ 全テストパス（48/48）

#### 2. ビルド
```bash
pnpm build
```
結果: ✅ ビルド成功

#### 3. 型チェック
```bash
pnpm typecheck
```
結果: ✅ 型エラーなし

### 影響範囲

- テンプレート生成時の `{{packageName}}/` パターンの置換が正しく動作するようになりました
- 生成されたプロジェクトで以下のようなインポート文が正しく置換されます:
  - `{{packageName}}/ui/utils` → `@repo/ui/utils`
  - `{{packageName}}/front-core/auth` → `@repo/front-core/auth`
  - `{{packageName}}/server-core/infrastructure/database/client` → `@repo/server-core/infrastructure/database/client`

### 重要な決定事項

**置換順序の原則**: 長いパターンを先に置換することで、部分一致による誤った置換を防ぐ設計。これにより、`{{packageName}}/` と `{{packageName}}` が混在する場合でも、正しく処理されます。
