# Plan: Serena MCP活用カスタムExploreエージェント作成

## Context

現在、`Task(subagent_type='Explore')` で呼び出されるExploreサブエージェントはClaudeCode標準のもので、`Read`, `Grep`, `Glob`, `Bash` 等の標準ツールで探索を行う。Serena MCPはLSPベースのシンボルナビゲーション・参照検索等の高度なコード解析機能を持っており、これをExplore時のメインツールとして活用したい。

**目的**: カスタムエージェント定義で標準Exploreを上書きし、すべての具体的探索をSerena MCPで行うエージェントを作成する。

## 方針

- `.claude/agents/einja/` に `Explore` と同名のカスタムエージェントを配置し、ビルトインExploreを上書き
- **Serena MCP最優先**: 利用不可の場合は警告を出した上でRead/Grep/Globにフォールバック
- 標準Exploreの基本的な役割（高速な読み取り専用コードベース探索）は踏襲
- 上書きが機能しない場合のフォールバック: 別名 + CLAUDE.md指示

## 変更対象ファイル

| ファイル | 操作 |
|---------|------|
| `.claude/agents/einja/Explore.md` | **新規作成** |

※ 実装時は `einja-skill-creator` Skill を参照してeinja規約に準拠すること

## エージェント定義の設計

### YAMLフロントマッター

```yaml
---
name: Explore
description: Serena MCPを活用した高速コードベース探索エージェント。...（<example>タグ含む）
tools: Read, Bash, Glob, Grep, ToolSearch, WebFetch, WebSearch, mcp__serena__find_symbol, mcp__serena__get_symbols_overview, mcp__serena__search_for_pattern, mcp__serena__find_file, mcp__serena__list_dir, mcp__serena__find_referencing_symbols, mcp__serena__activate_project, mcp__serena__check_onboarding_performed
model: sonnet
color: green
---
```

### ツール選定（Codexレビュー反映済み）

| カテゴリ | ツール | 用途 |
|---------|--------|------|
| **Serena MCP（最優先）** | find_symbol, get_symbols_overview, search_for_pattern, find_file, list_dir, find_referencing_symbols | シンボル検索、参照検索、パターン検索、ファイル/ディレクトリ探索 |
| **Serena初期化** | activate_project, check_onboarding_performed | プロジェクト有効化・初期化確認 |
| **補助（フォールバック含む）** | Read, Glob, Grep | 非コードファイル読み取り、広範なファイルパターン検索 |
| **読み取り専用Bash** | Bash | `git log`, `git blame`, `git show`, `ls`, `tree` 等 |
| **ツール管理** | ToolSearch | deferredツール（Serena MCP）の事前ロード |
| **Web検索** | WebFetch, WebSearch | 外部ドキュメント参照（標準Exploreと同等） |
| **除外** | Edit, Write, NotebookEdit, Task, ExitPlanMode | 読み取り専用保証 |
| **除外（Serena編集系）** | replace_symbol_body, insert_before_symbol, insert_after_symbol, rename_symbol | 編集系ツールは一切含めない |

### 本文の構成

#### 1. Serena MCPツール事前ロード手順（必須）

```
1. ToolSearch(query: "+serena", max_results: 10) で一括ロード
2. mcp__serena__check_onboarding_performed でSerena初期化確認
3. 必要に応じて mcp__serena__activate_project でプロジェクト有効化
```

- ToolSearch結果が空 or エラー → 警告メッセージ出力 → フォールバックモードへ

#### 2. 探索ツール優先順位

| 優先度 | ツール | 使用場面 |
|--------|--------|---------|
| 1（最優先） | Serena MCP | シンボル定義検索、参照追跡、パターン検索、ファイル検索 |
| 2（補助） | Read | 非コードファイル（md, json, yml）、画像、PDF読み取り |
| 3（補助） | Glob/Grep | Serenaで対応しにくい広範パターン検索、テキスト全文検索 |
| 4（補助） | Bash（読み取り専用） | git履歴、ファイルメタ情報 |

#### 3. 効率的な探索パターン集

- **シンボル定義 → 参照追跡**: find_symbol → find_referencing_symbols → Read
- **ディレクトリ構造 → シンボル概要**: list_dir → get_symbols_overview
- **パターン検索 → 詳細確認**: search_for_pattern → Read

#### 4. 読み取り専用の厳守

**禁止事項（明示的に記載）**:
- Edit, Write, NotebookEdit の使用
- Serena編集系ツール（replace_symbol_body等）の使用・ロード
- Bashでの破壊的操作（rm, mv, git reset, git checkout, リダイレクト等）

**Bash許可コマンド（ホワイトリスト）**:
- `git log`, `git blame`, `git show`, `git diff`
- `ls`, `tree`, `wc`, `file`, `stat`
- `env`, `node -v` 等の環境確認

#### 5. Serena利用不可時のフォールバック

1. 「⚠️ Serena MCP未接続のため、標準ツールで探索を継続します」と通知
2. Read/Grep/Glob/Bashで作業継続
3. 完了時に「Serena MCPの設定確認を推奨」とアドバイス

## 検証方法

1. ファイル作成後、新しいセッションで `Task(subagent_type='Explore')` を呼び出し
2. **上書き成功判定**: エージェントがSerenaツールを使用しているか確認
3. **上書き失敗時**: `name`を別名（例: `serena-explorer`）に変更し、CLAUDE.mdに「探索は`serena-explorer`を使え」と追記
4. Serena MCPが未接続の状態でフォールバック動作を確認
