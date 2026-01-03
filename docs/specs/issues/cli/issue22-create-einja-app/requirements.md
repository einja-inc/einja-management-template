# create-einja-app 要件定義書

## 1. 概要

### 1.1 ドキュメント情報

| 項目 | 内容 |
|------|------|
| 機能名 | create-einja-app |
| GitHub Issue | [#22](https://github.com/einja-inc/einja-management-template/issues/22) |
| 作成日 | 2026-01-04 |
| ステータス | Draft |

### 1.2 目的

`npx create-einja-app my-project` でプロジェクトテンプレートを一発展開できるCLIパッケージを新規作成する。また、`--setup` オプションで既存プロジェクトに環境ツールを追加する機能も提供する。

### 1.3 背景

社内の受託開発で多数のプロジェクトを立ち上げるため、Turborepo + Next.js 15 + Auth.js + Prisma 構成を効率的に展開したい。また、既存プロジェクトにも同様の環境ツール（direnv, dotenvx, Volta, Biome）を追加したいケースがある。

### 1.4 スコープ

**対象範囲:**
- 新規プロジェクト作成CLI
- 既存プロジェクトへの環境ツール追加（--setupモード）
- テンプレート同期スクリプト
- 対話式プロンプトシステム

**対象外:**
- @einja/cli（別パッケージとして配布）
- Einja固有のビジネスロジック
- プロジェクト固有の設定・データ

---

## 2. ユーザーストーリー

### US-001: 新規プロジェクト作成

**ストーリー:**
> 開発者として、コマンド一発でEinja標準構成のプロジェクトを作成したい。
> そうすることで、環境構築の時間を削減し、すぐに開発に着手できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-001-1 | `npx create-einja-app my-project` でプロジェクトディレクトリが作成される | CLI実行テスト |
| AC-001-2 | 作成されたプロジェクトで `pnpm install` が成功する | 統合テスト |
| AC-001-3 | 作成されたプロジェクトで `pnpm dev` が成功する | 統合テスト |
| AC-001-4 | 対話式プロンプトでプロジェクト名、認証方式、環境ツールを選択できる | E2Eテスト |
| AC-001-5 | 生成後のセットアップ手順が表示される | CLI出力テスト |

### US-002: 既存プロジェクトへの環境ツール追加

**ストーリー:**
> 開発者として、既存プロジェクトに環境ツール（direnv, dotenvx, Volta等）を追加したい。
> そうすることで、新規プロジェクトと同じ開発環境を既存プロジェクトにも適用できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-002-1 | `npx create-einja-app --setup` で対話式プロンプトが表示される | CLI実行テスト |
| AC-002-2 | 既存の設定ファイルがある場合、マージ・上書き・スキップを選択できる | E2Eテスト |
| AC-002-3 | 選択したツールのみがセットアップされる | 統合テスト |
| AC-002-4 | 既存ファイルを破壊せずにツールが追加される（マージモード時） | ユニットテスト |

### US-003: direnvセットアップ

**ストーリー:**
> 開発者として、プロジェクトにdirenvを設定したい。
> そうすることで、ディレクトリごとに環境変数を自動で切り替えられる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-003-1 | `.envrc` ファイルが生成される | ファイル存在テスト |
| AC-003-2 | `.envrc.example` ファイルが生成される | ファイル存在テスト |
| AC-003-3 | `.gitignore` に `.envrc` が追加される | ファイル内容テスト |
| AC-003-4 | 確認後 `direnv allow` が実行される | CLI実行テスト |

### US-004: dotenvxセットアップ

**ストーリー:**
> 開発者として、プロジェクトにdotenvxを設定したい。
> そうすることで、.envファイルを暗号化して安全に管理できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-004-1 | package.jsonに依存関係が追加される | ファイル内容テスト |
| AC-004-2 | npm scriptsにdotenvxコマンドが追加される | ファイル内容テスト |
| AC-004-3 | `.env.example` が生成される | ファイル存在テスト |

### US-005: Voltaセットアップ

**ストーリー:**
> 開発者として、プロジェクトにVoltaを設定したい。
> そうすることで、チームメンバー全員が同じNode.jsバージョンを使用できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-005-1 | package.jsonにvoltaフィールドが追加される | ファイル内容テスト |
| AC-005-2 | `.node-version` ファイルが生成される | ファイル存在テスト |

### US-006: Biomeセットアップ（--setupモードのみ）

**ストーリー:**
> 開発者として、既存プロジェクトにBiomeを設定したい。
> そうすることで、一貫したコードスタイルとLintルールを適用できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-006-1 | `biome.json` が生成される | ファイル存在テスト |
| AC-006-2 | package.jsonにlint/formatスクリプトが追加される | ファイル内容テスト |
| AC-006-3 | VSCode設定が追加される | ファイル存在テスト |

### US-007: Husky + lint-stagedセットアップ（--setupモードのみ）

**ストーリー:**
> 開発者として、既存プロジェクトにGit hooksを設定したい。
> そうすることで、コミット前に自動でLintとフォーマットが実行される。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-007-1 | `.husky/` ディレクトリが生成される | ディレクトリ存在テスト |
| AC-007-2 | pre-commitフックが設定される | ファイル内容テスト |
| AC-007-3 | lint-staged設定が追加される | ファイル内容テスト |

### US-008: テンプレート同期

**ストーリー:**
> 開発者として、メインリポジトリの変更をテンプレートに同期したい。
> そうすることで、常に最新のテンプレートをnpmで配布できる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-008-1 | `pnpm template:sync` でテンプレートが同期される | CLI実行テスト |
| AC-008-2 | `.templateignore` に基づきファイルが除外される | ファイル存在テスト |
| AC-008-3 | プレースホルダー変数が適切に置換される | ファイル内容テスト |

### US-009: 認証方式選択

**ストーリー:**
> 開発者として、プロジェクト作成時に認証方式を選択したい。
> そうすることで、プロジェクトに適した認証設定が最初から組み込まれる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-009-1 | Google OAuth、Credentials、GitHub OAuth、なしを選択できる | E2Eテスト |
| AC-009-2 | 選択した認証方式に応じた設定ファイルが生成される | ファイル内容テスト |
| AC-009-3 | 認証なしを選択した場合、認証関連コードが除外される | ファイル内容テスト |

### US-010: Worktree設定カスタマイズ

**ストーリー:**
> 開発者として、Worktree設定をカスタマイズしたい。
> そうすることで、複数ブランチの並行開発でポート競合を避けられる。

**受け入れ基準:**

| AC ID | 受け入れ基準 | 検証方法 |
|-------|-------------|--------|
| AC-010-1 | PostgreSQLポートをカスタマイズできる | E2Eテスト |
| AC-010-2 | Dockerコンテナ名をカスタマイズできる | E2Eテスト |
| AC-010-3 | `worktree.config.json` が生成される | ファイル存在テスト |
| AC-010-4 | アプリ追加でポート範囲を設定できる | E2Eテスト |

---

## 3. 機能要件

### 3.1 CLIコマンド

#### 3.1.1 新規プロジェクト作成

```bash
# 基本使用法
npx create-einja-app my-project

# オプション指定
npx create-einja-app my-project --template turborepo-pandacss --skip-git

# 利用可能オプション
--template <name>    # テンプレート名（default: turborepo-pandacss）
--skip-git           # Git初期化をスキップ
--skip-install       # 依存関係インストールをスキップ
--yes, -y            # 対話プロンプトをスキップ（デフォルト値使用）
```

#### 3.1.2 既存プロジェクトセットアップ

```bash
# 現在のディレクトリにセットアップ
npx create-einja-app --setup

# 特定ディレクトリにセットアップ
cd existing-project && npx create-einja-app --setup
```

### 3.2 対話式プロンプト

#### 3.2.1 新規プロジェクト作成時

| プロンプト | 選択肢 | デフォルト |
|-----------|--------|----------|
| プロジェクト名 | テキスト入力 | コマンド引数 or `my-project` |
| テンプレート | turborepo-pandacss, minimal | turborepo-pandacss |
| 認証方式 | Google OAuth, Credentials, GitHub OAuth, なし | Google OAuth |
| 環境ツール（複数選択） | direnv, dotenvx, Volta | 全て選択 |
| @einja/cli 自動セットアップ | はい, いいえ | はい |
| Worktree設定カスタマイズ | はい, いいえ | いいえ |

#### 3.2.2 --setupモード時

| プロンプト | 選択肢 | デフォルト |
|-----------|--------|----------|
| セットアップするツール（複数選択） | direnv, dotenvx, Volta, Biome, Husky + lint-staged | direnv, dotenvx, Volta |
| 既存ファイルがある場合の動作 | マージ, 上書き, スキップ | マージ |

### 3.3 テンプレート構成

#### 3.3.1 turborepo-pandacss テンプレート

```
templates/turborepo-pandacss/
├── apps/
│   └── web/                      # Next.js 15 + Panda CSS
│       ├── src/
│       │   ├── app/
│       │   │   ├── (authenticated)/
│       │   │   │   └── dashboard/  # 汎用サンプルダッシュボード
│       │   │   ├── signin/
│       │   │   ├── signup/
│       │   │   └── api/auth/
│       │   └── components/
│       └── ...
├── packages/
│   ├── config/                   # Biome, TypeScript, Panda CSS設定
│   ├── types/                    # NextAuth型拡張
│   ├── database/                 # Prismaスキーマ
│   ├── auth/                     # NextAuth v5設定
│   └── ui/                       # shadcn/ui コンポーネント
├── .claude/
│   ├── commands/einja/           # CLIテンプレート
│   ├── agents/einja/             # CLIテンプレート
│   └── skills/einja/             # CLIテンプレート
├── docs/einja/                   # CLIテンプレート
├── .envrc.template
├── .env.example
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json.template
```

#### 3.3.2 除外対象（.templateignore）

```
packages/cli/
packages/create-einja-app/
node_modules/
.git/
.next/
*.log
.env
.env.local
.env.*.local
```

### 3.4 固定設定

以下は選択肢として提供せず、固定とする：

| 項目 | 値 | 理由 |
|------|-----|------|
| データベース | PostgreSQL（Docker） | 統一性 |
| パッケージマネージャー | pnpm | Turborepo要件 |
| Node.jsバージョン | 22.16.0 | LTS版 |

---

## 4. 非機能要件

### 4.1 パフォーマンス

| 要件 | 目標値 | 測定方法 |
|------|--------|--------|
| プロジェクト生成時間 | 30秒以内（インストール除く） | タイムスタンプ |
| テンプレート同期時間 | 10秒以内 | タイムスタンプ |

### 4.2 互換性

| 環境 | バージョン |
|------|----------|
| Node.js | 20.x以上 |
| OS | macOS, Linux, Windows（WSL2推奨） |
| npm/npx | 10.x以上 |

### 4.3 セキュリティ

- 環境変数（.env, .env.local）をテンプレートに含めない
- シークレット情報をコードにハードコーディングしない
- ユーザー入力のバリデーション

### 4.4 ユーザビリティ

- 進捗表示（ora spinners）
- エラー時の明確なメッセージ表示
- 生成後の次のステップを明示

---

## 5. 技術要件

### 5.1 技術スタック

| ライブラリ | 用途 | バージョン |
|-----------|------|----------|
| TypeScript | 言語 | ^5.0.0 |
| Commander.js | CLIパーサー | ^12.0.0 |
| inquirer | 対話式プロンプト | ^9.0.0 |
| ora | プログレス表示 | ^8.0.0 |
| chalk | カラー出力 | ^5.0.0 |
| execa | コマンド実行 | ^9.0.0 |
| tsup | ビルド | ^8.0.0 |

### 5.2 パッケージ構成

```
packages/create-einja-app/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # エントリーポイント
│   ├── commands/
│   │   ├── create.ts       # 新規プロジェクト作成
│   │   └── setup.ts        # 既存プロジェクトセットアップ
│   ├── prompts/
│   │   ├── project.ts      # プロジェクト作成用プロンプト
│   │   └── setup.ts        # セットアップ用プロンプト
│   ├── generators/
│   │   ├── template.ts     # テンプレート展開
│   │   ├── tools/          # 各ツールのセットアップ
│   │   │   ├── direnv.ts
│   │   │   ├── dotenvx.ts
│   │   │   ├── volta.ts
│   │   │   ├── biome.ts
│   │   │   └── husky.ts
│   │   └── post-setup.ts   # 生成後セットアップ
│   └── utils/
│       ├── fs.ts           # ファイル操作
│       ├── git.ts          # Git操作
│       └── logger.ts       # ログ出力
├── templates/
│   └── turborepo-pandacss/
└── README.md
```

### 5.3 テンプレート同期スクリプト

**コマンド:** `pnpm template:sync`

**処理内容:**
1. `apps/`、`packages/` から `templates/default/` へコピー
2. `.templateignore` に基づき除外ファイルを削除
3. テンプレート変数のプレースホルダー化
4. `package.json` の名前を `{{projectName}}` に置換

**プレースホルダー:**
- `{{projectName}}` - プロジェクト名
- `{{packageName}}` - パッケージ名（@scope/name形式）
- `{{description}}` - プロジェクト説明

---

## 6. 制約事項

### 6.1 技術的制約

- ESM形式で出力（CommonJSは非対応）
- pnpm workspaces内のパッケージとして管理
- Turborepoのビルドパイプラインに統合

### 6.2 ビジネス制約

- Einja社内プロジェクト向けに最適化
- テンプレートはオープンソースとして公開可能な内容のみ

---

## 7. 依存関係

### 7.1 外部依存

| 依存 | 種類 | 説明 |
|------|------|------|
| npm レジストリ | 必須 | パッケージ配布 |
| GitHub | 任意 | CI/CD、ソースコード管理 |

### 7.2 内部依存

| 依存 | 種類 | 説明 |
|------|------|------|
| @einja/cli | 任意 | 自動セットアップ対象 |
| Issue #21 | 関連 | @einja/cli sync コマンド |

---

## 8. 将来の拡張性

### 8.1 計画されている拡張

- `minimal` テンプレートの追加（最小構成）
- テンプレートのカスタマイズ機能
- プラグインシステム

### 8.2 統合計画

Issue #22完了後、`pnpm setup` の内部実装を `npx create-einja-app --setup` の呼び出しに変更予定：

```json
{
  "scripts": {
    "setup": "npx create-einja-app@latest --setup"
  }
}
```

---

## 9. 用語集

| 用語 | 説明 |
|------|------|
| CLI | Command Line Interface（コマンドラインインターフェース） |
| direnv | ディレクトリごとの環境変数管理ツール |
| dotenvx | .envファイルの暗号化ツール |
| Volta | Node.jsバージョン管理ツール |
| Biome | Linter/Formatterツール |
| Husky | Git hooksツール |
| lint-staged | ステージングファイルへのLint実行ツール |
| Worktree | Git worktree（複数ブランチの並行開発機能） |
