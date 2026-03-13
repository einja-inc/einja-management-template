# Plan: CLAUDE.mdのmemory関連セクション整理 + Claude-Memプラグイン配布設定

## Context

CLAUDE.mdに「進捗報告の原則」「学習ループ」セクションがあるが機能していない。memory管理の代替としてClaude-Memプラグインを導入し、プロジェクト内`.claude-mem/`で共有記憶をgit管理する。

## 現状

- `CLAUDE.md` の「報告ルール」セクション内に「進捗報告の原則」（3項目の行動規範）がある
- `CLAUDE.md` の「学習ループ」セクションに `docs/einja/memory/` への記録指示がある（未使用）
- `.claude/settings.json` の `enabledPlugins` でプラグイン配布可能（`copy-presets.mjs` でそのままコピー）
- `~/.claude/settings.json` に `extraKnownMarketplaces` の設定例あり（einja-skills）

## 変更内容

### 1. CLAUDE.mdのセクション整理

対象ファイル: `CLAUDE.md`

- **「進捗報告の原則」** → 「報告ルール」セクション内に統合（「複数ステップでは各完了時に報告」「問題発生時は即共有」の2行に縮小）
- **「学習ループ」セクション全体** → Claude-Memベースの記述に置き換え:
  - 修正指摘を受けた場合はClaude-Memに記録
  - `.claude-mem/shared-memory.json` はgit管理でチーム共有
  - セッション開始時にClaude-Memの記憶を活用
  - `docs/einja/memory/` への記録指示は削除

### 2. `.claude/settings.json` にClaude-Memプラグインを追加

対象ファイル: `.claude/settings.json`

`extraKnownMarketplaces` にthedotmackリポジトリを登録し、`enabledPlugins` でclaude-memを有効化。`copy-presets.mjs` により `presets/default/.claude/settings.json` に自動コピーされ、全下流プロジェクトにデフォルト配布される。

```json
"extraKnownMarketplaces": {
  "einja-skills": { ... },
  "thedotmack": {
    "source": {
      "source": "github",
      "repo": "thedotmack/claude-mem"
    }
  }
},
"enabledPlugins": {
  ...,
  "claude-mem@thedotmack": true
}
```

### 3. `.claude-mem/` のgit管理設定

#### 3a. `.gitignore` に除外ルール追加

対象ファイル: `.gitignore`（テンプレートリポジトリ）

```gitignore
# Claude-Mem: 機密/バイナリ除外、共有部分のみコミット
.claude-mem/*.db
.claude-mem/private/
.claude-mem/temp/
.claude-mem/*.lock
```

#### 3b. 初期ディレクトリ・ファイル作成

- `.claude-mem/shared-memory.json` を空JSON `{}` で作成（git管理対象）
- `.claude-mem/.gitkeep` は不要（shared-memory.jsonがあればディレクトリは追跡される）

#### 3c. 下流配布の対応

- `copy-presets.mjs` は `.gitignore` をコピーしない（`knownIgnoreList`）
- 下流配布は `@einja-inc/create-app` の `init` テンプレートで対応:
  - `presets/default/.gitignore.append` にClaude-Mem除外ルールを記載し、create-app initで既存 `.gitignore` に追記する方式
  - **OR** create-appのテンプレート `.gitignore` に最初から含める
- `.claude-mem/shared-memory.json` もテンプレートに含めて配布

> **注意**: create-appの`.gitignore`配布方式はタスク2aの調査結果で決定する

#### 3d. `copy-presets.mjs` の `knownIgnoreList` に `.claude-mem` を追加

ビルド時の未登録エントリ警告を防止するため追加。

### 4. Claude-Memデータディレクトリ設定

対象ファイル: `.claude/settings.json` の `env` セクション

```json
"env": {
  ...,
  "CLAUDE_MEM_DATA_DIR": ".claude-mem"
}
```

settings.jsonの`env`に含めることで、`copy-presets.mjs`経由で下流に自動配布される。

### 変更しないもの

- auto memory（`~/.claude/projects/.../memory/`）: そのまま
- `docs/einja/memory/` ディレクトリ: テンプレートは残す（下流リポジトリ向け）

## タスク概要

| # | 内容 | Skill/ツール |
|---|------|-------------|
| 0 | Planファイルを `docs/plans/202603/20260313-memory-cleanup.plan.md` にリネーム | `Bash(mv)` |
| 1 | `extraKnownMarketplaces` のプロジェクト設定でのスキーマ確認 + create-appの`.gitignore`配布方式調査 | `WebFetch` / `Explore` |
| 2 | CLAUDE.md整理:「進捗報告の原則」を「報告ルール」に統合縮小、「学習ループ」をClaude-Memベースに置換 | `Edit` |
| 3 | `.claude/settings.json` にClaude-Memの`extraKnownMarketplaces` + `enabledPlugins` + `CLAUDE_MEM_DATA_DIR` 追加 | `Edit` |
| 4 | `.gitignore` にClaude-Mem除外ルール追加 | `Edit` |
| 5 | `.claude-mem/shared-memory.json` 初期ファイル作成（空JSON `{}`） | `Write` |
| 6 | `copy-presets.mjs` の `knownIgnoreList` に `.claude-mem` 追加 | `Edit` |
| 7 | create-appテンプレートに `.gitignore` ルール + `.claude-mem/` 追加（タスク1の調査結果に基づく） | `Edit` |
| 8 | 動作確認: Claude Code再起動 → `/plugin list` でclaude-mem表示確認。失敗時は手動 `/plugin install` 手順をCLAUDE.mdに追記 | 手動確認 |

## 並列実行計画

```
Phase 1（先行）: タスク1（スキーマ・配布方式調査）
Phase 2（並列）: タスク2, 3, 4, 5, 6（タスク1の結果を踏まえて並列実行）
Phase 3（依存）: タスク7（タスク1の調査結果に基づく）
Phase 4（最終）: タスク8（全タスク完了後）
```

## リスク・不明点

| リスク | 対処 |
|--------|------|
| `extraKnownMarketplaces` がプロジェクト設定で未サポート | タスク1で事前確認。問題なら `enabledPlugins` のみで配布し、マーケットプレイス登録はグローバル設定の手動指示をドキュメント化 |
| `enabledPlugins` だけで自動インストールされるか不明 | タスク8で検証。不可の場合はCLAUDE.mdに手動 `/plugin install` 手順を記載 |
| `.claude-mem/*.db` がコミットされて肥大化 | `.gitignore` でDB除外。万が一コミットされたら `git rm --cached` で対処 |
| create-appの `.gitignore` 配布方式が未確定 | タスク1で調査。追記方式 or テンプレート内包方式のどちらかを選択 |
| `CLAUDE_MEM_DATA_DIR` が相対パスで動作するか不明 | タスク8で検証。絶対パスが必要なら設定方法を変更 |

## 検証・動作確認方法

- CLAUDE.md: 「進捗報告の原則」が「報告ルール」に統合されていること + Claude-Mem記述が追加されていること
- settings.json: `extraKnownMarketplaces`, `enabledPlugins`, `env.CLAUDE_MEM_DATA_DIR` が正しく設定されていること
- .gitignore: `git status` で `.claude-mem/*.db` が追跡対象外であること
- .claude-mem/shared-memory.json: `git status` で追跡対象であること
- copy-presets.mjs: `pnpm build` で未登録エントリ警告が出ないこと
- プラグイン動作: Claude Code再起動 → `/plugin list` でclaude-memが表示されること
