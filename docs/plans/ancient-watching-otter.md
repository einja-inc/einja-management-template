# Plan: OrbStack推奨統一 + CLAUDE.md修正 + GitHub自動セットアップ + パッケージ仕様Skill

## Context

1. `create-einja-app` がGitHubリポジトリの作成・設定を行っていない
2. Docker環境でOrbStackを推奨に統一したい
3. CLAUDE.mdの「マネージドディレクトリ（編集禁止）」は下流リポジトリ向けルールであり、このテンプレートリポジトリ（原本）では `docs/einja/` は編集可能
4. 2パッケージ（`@einja/dev-cli`, `create-einja-app`）のビルド仕様を毎回確認するのが手間なので、Skillとして参照できるようにする

---

## TODO-0: パッケージ仕様参照Skill作成

### 目的
`@einja/dev-cli` と `create-einja-app` の2パッケージのビルド・テンプレート仕様を、既存ドキュメント・コードへの参照として1箇所にまとめる。配布しない（このリポジトリ専用）。

### 作成ファイル
- `.claude/skills/cli-package-specs/SKILL.md`

### 命名理由
`einja-` プレフィックスなし → `file-copier.ts:195` のフィルタにより `presets/default/` にコピーされない

### 内容（参照ベース）
- 2パッケージの概要と役割
- ビルドパイプライン
  - `packages/cli/scripts/generate-template.mjs`: CLAUDE.md → CLAUDE.md.template（`@einja:excluded` 除去 + プレースホルダー変換）
  - `packages/create-einja-app/scripts/template-update.ts`: テンプレートファイルコピー（CLAUDE.mdは無変換でコピー）
  - `scripts/_cli-template-update.ts`: CLIプリセット更新（`FileCopier` 経由、CLAUDE.mdは対象外）
  - `scripts/_template-update.ts`: create-einja-appテンプレート更新（README.mdのみexcluded除去）
- ファイルマッピング（CLAUDE.md「CLIパッケージの二重管理禁止」テーブル参照）
- コピー対象フィルタ: `.claude/skills/einja-*/` のみ配布（`file-copier.ts:195`）
- マーカー仕様: `@einja:excluded`, `@einja:project-private`, `@einja:managed`
- `post-setup.ts` の処理フロー参照
- `setup-dev.ts` の処理フロー参照

---

## TODO-1: CLAUDE.md excludedセクション修正

### 変更方針
マネージドディレクトリセクション自体は残す（下流リポジトリ向けに正しいルール）。`@einja:excluded` ブロック内に以下2点を追加。

### 変更内容（`CLAUDE.md` excludedセクション内）

#### 1. パッケージ仕様Skillの参照指示を追加

```markdown
### パッケージビルド仕様（テンプレートリポジトリ限定）

`@einja/dev-cli` と `create-einja-app` の2パッケージのビルド・テンプレート仕様については、以下のSkillを参照すること:

`.claude/skills/cli-package-specs/SKILL.md`
```

#### 2. マネージドディレクトリのオーバーライド注記を追加

```markdown
### マネージドディレクトリの編集について（テンプレートリポジトリ限定）

このリポジトリは `docs/einja/` の**原本（Single Source of Truth）**である。
上記「マネージドディレクトリ（編集禁止）」ルールは下流リポジトリ（create-einja-appで生成されたプロジェクト）向けであり、
**このリポジトリでは `docs/einja/` 配下の全ファイルを編集してよい**。
変更はビルド時に `presets/default/` へ自動コピーされる。
```

### 対象ファイル
- `CLAUDE.md`（excludedセクション内 L218付近）

---

## TODO-2: OrbStack推奨に統一

### 2-1. `scripts/setup-dev.ts` 修正（L621-625）

Docker未インストール時のメッセージをOS別に分岐し、macOSではOrbStack推奨:

```typescript
} else {
    warn("Dockerがインストールされていません");
    const platform = getPlatform();
    if (platform === "macos") {
        console.log(colors.yellow("  OrbStack（Docker互換の軽量ツール）のインストールを推奨します:"));
        console.log(colors.cyan("    brew install orbstack"));
        console.log(colors.gray("  または: https://orbstack.dev/"));
    } else if (platform === "windows") {
        console.log(colors.yellow("  Dockerをインストールしてください:"));
        console.log(colors.gray("    https://docs.docker.com/desktop/install/windows-install/"));
    } else {
        console.log(colors.yellow("  Docker Engineをインストールしてください:"));
        console.log(colors.gray("    https://docs.docker.com/engine/install/"));
    }
    console.log(colors.gray("  インストール後、以下を実行してください:"));
    console.log(colors.gray("    docker-compose up -d postgres"));
    console.log(colors.gray("    pnpm db:generate && pnpm db:push"));
}
```

### 2-2. `docs/einja/instructions/deployment-setup.md` 修正（L38）

```
Before: | Docker | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | PostgreSQL実行 |
After:  | Docker | macOS: [OrbStack](https://orbstack.dev/)（推奨）/ その他: [Docker Engine](https://docs.docker.com/engine/install/) | PostgreSQL実行 |
```

### 2-3. `docs/einja/instructions/local-server-environment-and-worktree.md` 修正（L62-63）

```
Before:
  - macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
  - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)

After:
  - macOS: [OrbStack](https://orbstack.dev/)（推奨。`brew install orbstack`）
  - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
```

### 対象ファイル
- `scripts/setup-dev.ts` (L596-625)
- `docs/einja/instructions/deployment-setup.md` (L38)
- `docs/einja/instructions/local-server-environment-and-worktree.md` (L62-63)

---

## TODO-3: GitHub自動セットアップスクリプト作成

### 概要
`scripts/init-github.ts` を新規作成。`pnpm init:github` で実行。

### 処理フロー
1. `gh` CLIの存在確認（なければインストール案内して終了）
2. `gh auth status` で認証確認
3. `git remote get-url origin` でリモート有無確認
4. リモートなし → org/repo名を対話入力（デフォルト: ディレクトリ名）→ `gh repo create`
5. `git push -u origin main`
6. Branch Protection設定（`gh api`）
7. GitHub Secrets設定（`.env.keys` から読み取り → `gh secret set`）
8. Environments作成（production, preview）

### 対象ファイル
- `scripts/init-github.ts`（新規）
- `package.json`（`"init:github"` スクリプト追加）
- `scripts/setup-dev.ts`（完了メッセージに `pnpm init:github` 案内追加）

---

## 検証方法

1. **Skill**: `.claude/skills/cli-package-specs/SKILL.md` が存在し、参照先のファイルパスが正しいこと
2. **CLAUDE.md**: excludedセクション内にオーバーライド注記があること
3. **OrbStack**: `grep -r "Docker Desktop"` でsetup-dev.tsとdocs 2ファイルに残っていないこと
4. **init-github.ts**: `pnpm init:github --help` が動作すること
5. `pnpm prepush` が通ること
