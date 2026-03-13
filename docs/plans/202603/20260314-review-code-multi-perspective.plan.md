# Plan: レビュー機構の統一 — einja-review-code を観点並列の本体にし、task-reviewer から呼ぶ

## Context

現在、コードレビューが2箇所で別々に定義されている：
- **`einja-review-code` Skill**: CLAUDE.md 99-1用。4観点を1サブエージェントにまとめて渡す + codex-agent
- **`task-reviewer` エージェント**: task-exec/issue-exec用。4並列Explore（アーキ/品質/スメル/テスト）+ review-guidelines.md + 品質コマンド

問題：
1. 観点定義が二重管理で不統一
2. 修正内容に応じた観点ピックがない
3. Codex並列がtask-reviewer側にない

方針：**`einja-review-code` を観点別並列レビューの本体（Single Source of Truth）にし、`task-reviewer` はそれを呼ぶ + task-exec固有の付加機能（要件照合・仮実装検出・lint/build/test）を担う**

## 現状

### einja-review-code Skill（`.claude/skills/einja-review-code/SKILL.md`）
- Step 1: git diff取得
- Step 1.5: Codex MCP確認
- Step 2: レビュアー1（general-purpose: A〜D観点を1プロンプト）+ レビュアー2（codex-agent）を並列
- Step 3: 統合（MAX判定）
- Step 4: 結果返却

### task-reviewer エージェント（`.claude/agents/einja/task/task-reviewer.md`）
- Step 0: 品質判定ゲート（LSP/セキュリティスキャン/テストカバレッジ/react-doctor）
- 並列レビュー: 4 Exploreサブエージェント（アーキ/品質/スメル/テスト）→ review-guidelines.md参照
- Step 1-2: 実装確認・要件照合
- Step 3: ガイドライン準拠性
- Step 4: 仮実装検出
- Step 5: 品質コマンド（lint/typecheck/build/test）

### CLAUDE.md 99-1
```
| 99-1 | コードレビュー [`einja-review-code` + `codex-agent`] | `einja-review-code` Skill（MAJOR → 修正→再レビュー）。Codex MCP有効時は `codex-agent` も並列実行。差分確認（`git diff --stat`）もここで実施 |
```

### 委託ルール Skill表（CLAUDE.md L50）
```
| `einja-review-code` | コード変更の完了レビュー（レビューサブエージェント + codex-agent並行） |
```

## 変更内容

### 1. `einja-review-code` Skill — 観点別並列レビューの本体に改修

#### スキップ条件の削除
現行の「task-exec経由での実行時はスキップ」条件を**削除**する。新構成では task-reviewer が einja-review-code を呼び出すため、この条件は矛盾する。

#### 新しいレビュー観点一覧

| ID | 観点名 | 説明 | 適用条件 |
|----|--------|------|----------|
| A | Skill設計 | `einja-skill-plan-guide` の品質基準に照らしたSkill設計レビュー | SKILL.mdの変更を含む場合 |
| B | コード・ロジック | 設計パターン整合性、型安全性、プロジェクト規約準拠、コード品質 | コード変更がある場合（ほぼ常時） |
| C | セキュリティ・エラーハンドリング・異常系 | OWASP Top 10、入力バリデーション、エラー伝播、異常系パス | API・認証・外部入力・DB操作等 |
| D | 整合性 | 既存コードベースとの一貫性、後方互換性、型・インターフェース整合 | 複数ファイル変更、公開API変更 |
| E | 影響範囲・水平展開 | 他モジュールへの波及、同種パターンの水平適用漏れ、未使用コード残存 | リファクタリング、共通ロジック変更 |
| F | テスト観点 | テストカバレッジ、テストケース不足、境界値・異常系テスト | テストの追加・変更、またはテスト追加が必要な本体変更 |
| G | ドキュメント作成・更新漏れ | README、JSDoc、CLAUDE.md、Skill説明文、steering docs等の更新必要性 | 公開API変更、設定変更、新機能追加 |

#### 新しい実行フロー

1. **Step 1**: `git diff HEAD --stat` / `git diff HEAD` で変更把握
2. **Step 1.5**: `ToolSearch` で `mcp__codex__codex` 利用可否を確認
3. **Step 2**: diffのファイルパス・内容から必要な観点をピック（曖昧なら全観点）
4. **Step 3**: ピックした観点ごとにサブエージェント（general-purpose）を並列起動。Codex有効時は `codex-agent` に**包括的・批判的な目線**での独立レビューも並列依頼
5. **Step 4**: 全レビュー結果を統合（MAX判定）、結果返却

### 2. `task-reviewer` エージェント — 既存の並列レビュー部分を `einja-review-code` 呼び出しに置換

変更点：
- **削除**: 現在の「並列レビューの実行（必須）」セクション（4 Exploreサブエージェント）
- **追加**: `einja-review-code` Skillを呼び出す手順（Skill toolで呼び出し）
- **追加**: frontmatter `skills:` に `einja-review-code` を追加
- **維持**: Step 0（品質判定ゲート: LSP/セキュリティスキャン/テストカバレッジ/react-doctor）、Step 1-2（実装確認・要件照合）、Step 4（仮実装検出）、Step 5（品質コマンド）
- **Step 3（ガイドライン準拠性）の役割縮小**: einja-review-codeの7観点でカバーされない「プロジェクト固有ガイドライン違反の最終ゲート」のみに限定
- react-doctor結果は `einja-review-code` のプロンプトに埋め込んで渡す

### 3. `CLAUDE.md` — 微修正

- 99-1の説明文を更新（「観点別並列レビュー」であることを明記）
- 委託ルール Skill表の `einja-review-code` 用途欄を更新

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.claude/skills/einja-review-code/SKILL.md` | 観点別並列レビュー方式に全面改修 |
| `.claude/agents/einja/task/task-reviewer.md` | 並列レビュー部分をeinja-review-code呼び出しに置換 |
| `CLAUDE.md` | 99-1説明文・委託ルール表の微修正 |

## タスク概要

| # | タスク | 使用Skill/ツール | 備考 |
|---|--------|-----------------|------|
| 0-1 | Planファイルを `docs/plans/202603/20260314-review-code-multi-perspective.plan.md` にリネーム | [Bash] | |
| 1 | `einja-review-code/SKILL.md` を観点別並列レビュー方式に改修 | [general-purpose] | メイン作業 |
| 2 | `task-reviewer.md` の並列レビュー部分を `einja-review-code` 呼び出しに置換 | [general-purpose] | タスク1と並行可 |
| 3 | `CLAUDE.md` 99-1説明文・委託ルール表を微修正 | [general-purpose] | タスク1,2と並行可 |
| 99-G | コミット承認ゲート | [AskUserQuestion] | |
| 99-3 | コミット・プッシュ | [einja-task-commit] | |

## 並列実行計画

- タスク1, 2, 3は**全て並行実行可能**（異なるファイル）
- 99系は順次実行

## リスク・不明点

- 観点が7つあるため最大8並列（7観点 + Codex）になりうる。コスト増だがレビュー品質向上とのトレードオフとして許容
- **Skill→Agent呼び出しチェーンの検証**: task-reviewer→Skill(einja-review-code)→Agent(並列サブエージェント)の実行可否。`.claude/settings.json` で `Skill(*)` はグローバル許可済みだが、Skill内部のAgent呼び出しがtask-reviewerコンテキストで動作するか要確認。動作しない場合は task-reviewer の `allowed-tools` に `Agent` を追加するか、einja-review-code の実装方式を調整する
- `review-guidelines.md` との関係: task-reviewerのStep 3は「プロジェクト固有ガイドライン違反の最終ゲート」に役割縮小。einja-review-codeの各観点プロンプトでもreview-guidelines.mdを参照させる

## 検証・動作確認方法

- 各ファイルの変更内容を目視確認（観点一覧、ピックロジック、プロンプトテンプレート、統合ルール、task-reviewerからの呼び出し手順）
- `git diff --stat` で変更ファイルが3ファイルのみであることを確認
