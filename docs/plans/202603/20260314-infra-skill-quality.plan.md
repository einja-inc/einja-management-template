# einja-infra-maintenance Skill品質改善

## Context

3つのレビュー（skill-creator、codex-agent、skill-plan-guide Phase 1チェックリスト）で計14件の指摘が出た。最大の問題はSKILL.md単一ファイル1038行で、Progressive disclosure（references/分離）が未実装。加えてdescription不備、内容の事実誤認、安全性の問題がある。

## 現状

- `.claude/skills/einja-infra-maintenance/SKILL.md` — 単一ファイル1038行
- references/ なし
- frontmatter: name, description, user-invocable のみ（allowed-tools, Do NOT use for 欠落）
- オーケストレーター型（カテゴリ選択→詳細手順実行）

## 変更内容

### A. 構造変更: Progressive disclosure（references/分離）

SKILL.md本体を ~210行に縮小し、カテゴリ別詳細をreferences/に分離する。

**SKILL.md本体に残す内容:**
- Frontmatter（改善版）
- 概要・参照ドキュメント
- 実行フロー Mermaid図（1-8に修正）
- Phase 1: 環境状態の自動検出（起動時毎回実行のため本体に残す）
- Phase 2: 意図判定とメインメニュー（AskUserQuestion 2層記述追加）
- 各カテゴリの概要行（1-2行 + references/参照パス）× 8

**references/ に分離するファイル:**

| ファイル | 内容 |
|---------|------|
| `references/category-1-local-setup.md` | カテゴリ1詳細手順 |
| `references/category-2-env-variables.md` | カテゴリ2詳細手順 |
| `references/category-3-vercel.md` | カテゴリ3詳細手順 |
| `references/category-4-neon.md` | カテゴリ4詳細手順 |
| `references/category-5-github-secrets.md` | カテゴリ5詳細手順 |
| `references/category-6-health-check.md` | カテゴリ6詳細手順（Phase1重複解消済み） |
| `references/category-7-github-actions.md` | カテゴリ7詳細手順 |
| `references/category-8-default-tokens.md` | カテゴリ8詳細手順 |
| `references/common-operations.md` | セキュリティ・エラーハンドリング・CLIトラブルシューティング |

**references/ファイル品質要件:**
- 100行超のファイルにはTOC（目次）を含める
- references/ は1階層のみ（サブディレクトリ禁止）
- 各ファイルは独立して読めること（他references/への依存を最小化）

**Phase1とカテゴリ6の重複解消方針:** カテゴリ6はPhase 1の検出結果を再利用し、外部サービス確認（Vercel/Neon/GitHub）+ サマリー + 推奨アクションのみ記載。ローカル環境チェックの重複コードは削除。

### B. Frontmatter改善

```yaml
description: "Interactively sets up and maintains infrastructure environments including local development, Vercel, Neon, GitHub Actions, environment variables, and default tokens. Triggers: 「インフラ」「環境変数管理」「Vercel」「Neon」「デプロイ設定」「GitHub Secrets」「環境セットアップ」「ローカルセットアップ」「ローカル環境」「セットアップ」「GitHub Actions」「CI/CD」「ワークフロー」「デフォルトトークン」. Do NOT use for: アプリケーションコードの実装、テスト実行、コードレビュー、ローカル開発サーバーの起動のみ（→ einja-start-dev）"
```

### C. 内容修正（references/ファイル内）

| # | 修正 | 対象ファイル |
|---|------|------------|
| 5 | Mermaid図 1-7→1-8 | SKILL.md |
| 6 | トークン検証で `dotenvx run -f .env.personal -- bash -c '...'` 形式でロードしてから実行 | SKILL.md (Phase 1) |
| 7 | `rm && mv` → `cp backup` + 成功確認後削除（カテゴリ2 L229 + カテゴリ4 L409 の両方） | refs/category-2, refs/category-4 |
| 8 | `jq` をオプショナルツールとして前提チェックに追加（`❌ jq（オプション: トークン詳細表示に使用）`） | SKILL.md (Phase 1) |
| 9 | `vercel env add preview` 断定→運用方針に修正 | refs/category-3 |
| 10 | `role_name` 必須→推奨に修正 | refs/common-operations |
| 11 | `claude.yml` `/claude`→`@claude` | refs/category-7 |
| 13 | メニュー選択肢にNote:層追加 | SKILL.md (Phase 2) |
| 14 | 「初版で除外する機能」セクション削除 | refs/common-operations |

### D. CLAUDE.md修正

トリガーキーワード行に `デフォルトトークン` を追加。

## タスク概要

```
タスク0-0: TaskCreate [Task API]
タスク0-1: Planファイルリネーム → docs/plans/202603/20260314-infra-skill-quality.plan.md
タスク0-2: worktree作成 [_einja-worktree-guide]

--- 並行グループ1 ---
タスク1: SKILL.md構造改善 + references/作成 + 内容修正 [einja-skill-creator]
  - skill-creatorの「既存Skill改善」モードで一括実施（構造分離と内容修正を同一セッションで行う）
  - 指摘1-3, 5-14の全てを含む
  - 一括にする理由: skill-creatorは全体を把握した上で分離+修正を行うため、分割すると整合性リスクが増す
タスク2: CLAUDE.mdトリガーキーワード追加 [直接編集]
  - 「デフォルトトークン」追加（1行修正）
  ※タスク1と並行可能（別ファイル）
---

タスク99-1: コードレビュー [einja-review-code + codex-agent]
タスク99-2: 動作確認 [Bash + skill-plan-guide Phase 1再実行]
  - wc -l SKILL.md で500行以内を確認
  - ls references/ で9ファイル存在確認
  - references/ファイルの品質: 100行超はTOC有無確認、サブディレクトリ不在確認
  - SKILL.mdからのreferences/パス参照の整合性確認
  - skill-plan-guide Phase 1チェックリスト再実行 → 全項目pass確認
タスク99-G: コミット承認ゲート [AskUserQuestion]
タスク99-3: コミット・プッシュ [einja-task-commit]
```

## 並列実行計画

```
タスク0-0 → タスク0-1 → タスク0-2
                              ↓
                    ┌─────────┴─────────┐
                    タスク1              タスク2
                    (skill-creator)      (直接編集)
                    └─────────┬─────────┘
                              ↓
                    タスク99-1 → 99-2 → 99-G → 99-3
```

## リスク・不明点

| リスク | 対策 |
|--------|------|
| skill-creatorが1038行を正確に分離できるか | 分離後のSKILL.md行数・references/ファイル数を動作確認で検証 |
| 分離しすぎて管理コスト増（calm-stirring-bonbon知見） | カテゴリ選択型のため各ファイルは独立。ガイドライン型の統合事例とは構造が異なり、分離が適切 |
| 内容修正の抜け漏れ | 99-1レビューで全14件の反映を確認 |

## 検証・動作確認方法

1. `wc -l .claude/skills/einja-infra-maintenance/SKILL.md` → 500行以内
2. `ls .claude/skills/einja-infra-maintenance/references/` → 9ファイル
3. SKILL.md内のreferences/パスが実在ファイルと一致
4. frontmatter descriptionが3rd person + When + Do NOT use forを含む
5. `grep "デフォルトトークン" CLAUDE.md` → キーワード行に存在
6. skill-plan-guide Phase 1チェックリスト再実行 → 全項目pass
