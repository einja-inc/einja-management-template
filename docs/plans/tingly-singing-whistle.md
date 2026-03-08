# einja プロジェクト初期化・同期プラグイン

## Context

### 現状の課題
新規プロジェクトのeinja環境セットアップには `create-einja-app` または `@einja/dev-cli` のインストール → CLI操作が必要。Claude Desktopユーザーにとって導入障壁が高い。

### 解決策
Claude Codeプラグインで `/einja:init` と `/einja:sync` を提供。プラグインインストール → コマンド実行でeinja環境を構築・更新。

### 調査で判明した事実
- Claude Codeプラグインは CLI・VSCode・Claude Desktop（Codeタブ）すべてで共通動作
- プライベートリポジトリからのインストール対応済み（`GITHUB_TOKEN`）
- マーケットプレイス構造（`marketplace.json`）が公式導線
- サードパーティmarketplaceはauto-update既定OFF

## 方針

- プラグインのSkillは **`init` と `sync` の2つ**
- `/einja:init` → `npx --yes @einja-inc/create-app@latest` で新規プロジェクト作成
- `/einja:sync` → `npx --yes @einja-inc/dev-cli@latest sync` でテンプレート同期
- 開発用Skill（`einja-task-exec`等）はsyncで配布されたスタンドアロン版を使用
- プラグインは `einja-inc/einja-skills`（プライベートリポジトリ）で配布
- **既存の `einja-sync` Skill/コマンドは破壊的変更として削除**（プラグインに一本化）

### 前提: パッケージ移行（別PR: shimmering-snuggling-kay）
本計画は以下のパッケージ名変更が完了していることを前提とする（**shimmering-snuggling-kay PRのマージ完了後**に本PRを作成・マージすること）:
- `create-einja-app` → `@einja-inc/create-app`（GitHub Packages）
- `@einja/dev-cli` → `@einja-inc/dev-cli`（GitHub Packages）
- レジストリ: `npmjs.org` → `npm.pkg.github.com`
- npx実行には `.npmrc` + `GITHUB_PACKAGES_TOKEN` が必要

## 実装計画

### TODO-1: GitHubリポジトリ作成

```bash
gh repo create einja-inc/einja-skills --private \
  --description "einja Claude Code Skills"
```

### TODO-2: プラグイン構造構築

```
einja-inc/einja-skills/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   └── einja-dev/
│       ├── .claude-plugin/
│       │   └── plugin.json     # name: "einja"
│       └── skills/
│           ├── init/
│           │   └── SKILL.md    # プロジェクト新規作成
│           └── sync/
│               └── SKILL.md    # テンプレート同期
└── README.md
```

#### marketplace.json
```json
{
  "name": "einja-skills",
  "owner": { "name": "einja-inc" },
  "metadata": {
    "description": "einja開発環境スキル集",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "einja-dev",
      "source": "./plugins/einja-dev",
      "description": "einjaプロジェクト初期化・同期"
    }
  ]
}
```
※ `pluginRoot` を削除し `source` にフルパス指定（Codexレビュー P1 対応: 二重パス解決リスク回避）

#### plugin.json
```json
{
  "name": "einja",
  "description": "einjaプロジェクト初期化・同期プラグイン",
  "version": "0.1.0",
  "author": { "name": "einja-inc" },
  "repository": "https://github.com/einja-inc/einja-skills",
  "license": "UNLICENSED"
}
```

### TODO-3: Skill実装

#### `/einja:init` — プロジェクト新規作成
1. `.npmrc` の設定を確認（`@einja-inc:registry` + `authToken`。未設定なら移行ガイドへ誘導）
2. `npx --yes @einja-inc/create-app@latest` を実行（対話的にオプション選択）
3. 環境変数の設定案内
4. 完了メッセージ + 利用可能になったSkill/コマンドの一覧表示

#### `/einja:sync` — テンプレート同期
移行元:
- `.claude/skills/einja-sync/SKILL.md`（Skillとしての定義）

動作:
1. `.npmrc` の設定を確認（`@einja-inc:registry` + `authToken`。未設定なら移行ガイドへ誘導）
2. `npx --yes @einja-inc/dev-cli@latest sync` を実行（カテゴリ選択式）
3. コンフリクトがあれば `einja-conflict-resolver` Skill相当の解消を案内
4. 同期結果を表示

※ `@latest` を必ず指定（Codexレビュー P1 対応: npxキャッシュによる旧バージョン実行回避）

### TODO-4: このリポジトリからeinja-sync削除 + ドキュメント更新（破壊的変更）

#### 4-1. 削除対象
- `.claude/skills/einja-sync/SKILL.md`（ディレクトリごと削除）

※ `.claude/commands/einja/einja-sync.md` は既に存在しないため削除不要

#### 4-2. ドキュメント更新

> **注**: README.md、CLAUDE.md、setup-flow.md のパッケージ名変更（`@einja/dev-cli` → `@einja-inc/dev-cli` 等）は `shimmering-snuggling-kay` PRで実施済みの前提。本TODOではプラグイン関連の変更のみ行う。

| ファイル | 変更内容 |
|---------|---------|
| `README.md` | L76: `pnpm einja:sync` → プラグイン `/einja:sync` の案内に変更。L82-87: `npx @einja/dev-cli sync` の手順をプラグイン経由に更新。L99: 使い分けガイドの「Claude設定を最新に更新したい」行を更新。パッケージ利用者向けセクション全体にプラグインインストール手順を追加 |
| `CLAUDE.md` | L145: shimmering-snuggling-kayでパッケージ名更新済みの場合、本PRでは「`@einja-inc/dev-cli sync`」→「`/einja:sync`（プラグイン）経由の sync」に変更。Skillテーブルにeinja-syncは元々記載なし。キーワードトリガーがあれば削除 |
| `docs/einja/instructions/setup-flow.md` | セクション3「einja sync」（L153-312）: Mermaidシーケンス図の `einja-sync Skill` アクターを `/einja:sync プラグイン` に変更。`Skill->>DevCLI` の矢印ラベルをプラグイン経由に。L312の「`einja-sync` Skill から統合的に呼び出されます」を「プラグイン `/einja:sync` から呼び出されます」に。ファイル別リファレンステーブル（L276-288）からSkill行を削除 |
| `package.json` | `einja:sync` スクリプトを削除（プラグイン `/einja:sync` に一本化。CLI直接実行は `npx @einja/dev-cli@latest sync` で可能なため残す必要なし） |

#### 4-3. copy-presets.mjs への影響確認
- `einja-sync` は `einja-` プレフィックスのためpresets配布対象 → 削除後はコピーされなくなる（意図通り）
- 下流リポジトリにコピー済みの `einja-sync` Skillは次回syncで孤児ファイルとして検出・削除される

### TODO-5: ローカルテスト

```bash
gh repo clone einja-inc/einja-skills /tmp/einja-skills
claude --plugin-dir /tmp/einja-skills/plugins/einja-dev
```

検証項目:
- [ ] `/einja:init` が `@einja-inc/create-app@latest` を正しく呼び出す
- [ ] `/einja:sync` が `@einja-inc/dev-cli@latest sync` を正しく呼び出す
- [ ] sync後にスタンドアロンSkill（`/einja-task-exec`等）が利用可能
- [ ] `claude plugin validate .` でプラグイン構造が正しいことを確認

### TODO-6: マーケットプレイス経由インストール検証

```bash
export GITHUB_TOKEN=ghp_xxxxx
/plugin marketplace add einja-inc/einja-skills
/plugin install einja-dev@einja-skills
```

- [ ] マーケットプレイス追加成功
- [ ] プラグインインストール成功
- [ ] GITHUB_TOKEN未設定時のエラーメッセージ確認
- [ ] auto-update手動有効化の動作確認

### TODO-7: README整備

#### 7-1. einja-skillsリポジトリのREADME
プラグインのインストール手順と使い方:

```bash
# 前提: GITHUB_TOKEN設定（初回のみ）
export GITHUB_TOKEN=ghp_xxxxx

# マーケットプレイス追加 + インストール（初回のみ）
/plugin marketplace add einja-inc/einja-skills
/plugin install einja-dev@einja-skills

# 新規プロジェクト作成
/einja:init

# テンプレート同期（定期的に実行）
/einja:sync

# ※ auto-updateを有効にする場合:
# /plugin → Marketplaces → einja-skills → Enable auto-update

# 以降は sync済みのSkillで開発
/einja-task-exec  # タスク実行
/einja-create-pr  # PR作成
```

#### 7-2. このリポジトリ（einja-management-template）のREADME更新
パッケージ利用者向けセクション（`<!-- @einja:excluded -->` 内）を以下の方針で更新:

| セクション | 現状 | 更新後 |
|-----------|------|--------|
| 推奨セットアップ方法 | CLIコマンド中心（`npx create-einja-app`, `npx @einja/dev-cli`） | **プラグイン経由を推奨**として冒頭に追加。CLIは「代替手段」として残す |
| `pnpm einja:sync` | npm script経由のsync手順 | `/einja:sync`（プラグイン）を推奨、`npx @einja/dev-cli@latest sync` は代替 |
| 使い分けガイド | 3行テーブル（create/init/sync） | プラグインの `/einja:init` `/einja:sync` を第一選択肢に |
| セットアップフロー参照 | `setup-flow.md` へのリンク | リンクはそのまま（setup-flow.md自体をTODO-4で更新済み） |

## ユーザーフロー図

```
[Claude Desktop / CLI / VSCode]
  ↓
/plugin marketplace add einja-inc/einja-skills
/plugin install einja-dev@einja-skills  ← プラグイン導入（1回）
  ↓
/einja:init                             ← 新規プロジェクト作成
  ↓  (npx --yes @einja-inc/create-app@latest)
  ↓
/einja:sync                             ← テンプレート同期
  ↓  (npx --yes @einja-inc/dev-cli@latest sync)
  ↓
.claude/skills/einja-* が配置される      ← スタンドアロンSkill利用可能に
  ↓
/einja-task-exec, /einja-create-pr ...  ← 通常の開発フロー
```

## 対象ファイル

### einja-skillsリポジトリ（新規作成）
- `.claude-plugin/marketplace.json`
- `plugins/einja-dev/.claude-plugin/plugin.json`
- `plugins/einja-dev/skills/init/SKILL.md`
- `plugins/einja-dev/skills/sync/SKILL.md`
- `README.md`

### einja-management-template（このリポジトリ・破壊的変更）
- `.claude/skills/einja-sync/` — ディレクトリごと削除
- `CLAUDE.md` — L145 `einja sync` 文言更新
- `README.md` — パッケージ利用者向けセクションをプラグイン経由に更新
- `docs/einja/instructions/setup-flow.md` — セクション3のSkill参照をプラグインに更新
- `package.json` — `einja:sync` スクリプト削除

### 影響なし（変更不要）
- `.claude/skills/einja-sync-cursor-commands/` — einja-sync（テンプレート同期）とは無関係。SkillをCursorルールに変換するツールであり影響なし
- `.claude/skills/cli-package-specs/` — 配布対象外。dev-cli syncへの参照あるが、CLIの動作自体は変わらないため変更不要

## 検証方法

1. `claude plugin validate .` でプラグイン構造検証
2. `claude --plugin-dir` でローカルテスト
3. `/einja:init` で新規プロジェクト作成が動作
4. `/einja:sync` でテンプレート同期が動作
5. sync後にスタンドアロンSkillが利用可能
6. マーケットプレイス経由インストール確認（`GITHUB_TOKEN`認証含む）
7. Claude Desktop Codeタブでの動作確認

## Codexレビュー指摘対応

### Round 1-2
| 指摘 | 対応 |
|---|---|
| P0: 移行元ファイル名誤り | `.claude/skills/einja-sync/SKILL.md` のみ（コマンドファイルは存在しない） |
| P0: 既存ユーザー移行パス | 破壊的変更として削除（ユーザー承認済み） |
| P1: pluginRoot + source 二重指定 | `pluginRoot` 削除、`source` にフルパス指定 |
| P1: npx @latest 指定漏れ | `npx --yes <pkg>@latest` に統一 |
| P2: テスト計画不足 | `claude plugin validate .`、GITHUB_TOKEN認証テスト追加 |

### Round 3
| 指摘 | 対応 |
|---|---|
| P0-1: 存在しないコマンドファイル削除 | `.claude/commands/einja/einja-sync.md` を削除対象から除去（ファイル不在確認済み） |
| P0-2: CLAUDE.md Skillテーブル変更が不要 | テーブルにeinja-sync記載なし → L145文言のみ更新に修正 |
| P1-1: einja-sync-cursor-commands漏れ | 誤検知。テンプレート同期とは無関係（Skill→Cursorルール変換ツール） |
| P1-2: cli-package-specs参照漏れ | 配布対象外Skill。CLIの動作は変わらないため変更不要 |
| P1-4: setup-flow.md更新粒度不足 | TODO-4のテーブルにMermaid図・テーブルの具体的変更箇所を追記 |
| P2-1: package.json方針未確定 | `einja:sync` スクリプト削除に確定 |

### Round 4
| 指摘 | 対応 |
|---|---|
| P0-1: テストチェックリスト旧パッケージ名 | `@einja/dev-cli` → `@einja-inc/dev-cli` に修正 |
| P1-1: setup-flow.md更新タイミング | 本PRで更新（shimmering-snuggling-kay後） |
| P1-2: PRマージ順序の明示化 | 前提セクションに「shimmering-snuggling-kay PRマージ完了後」を明記 |
| P1-3: npmrc認証確認の詳細不足 | `authToken` 確認 + 移行ガイドへの誘導を追記 |
| P2-2: CLAUDE.md文言の一貫性 | shimmering-snuggling-kay適用済み前提で、本PRはプラグイン参照に変更 |
