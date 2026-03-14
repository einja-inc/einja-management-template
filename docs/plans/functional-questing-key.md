# GWS CLI Skill 追加: Gmail, Drive, Calendar, Slides, Docs

## Context

現在 GWS CLI (`@googleworkspace/cli`) のSkillは `gws-sheets-guide` と `gws-setup` の2つしかない。ユーザーから Gmail, Drive, Calendar, Slides, Docs のSkill追加を要求された。`gws-sheets-guide` のパターンに倣い、各サービスのガイドSkillを作成する。

## 現状

- **既存Skill**: `gws-sheets-guide`（SKILL.md + references/2ファイル）、`gws-setup`（SKILL.md のみ）
- **配置先**: `/Users/kzp/code/GitHub/einja-inc/einja-skills/plugins/einja-common/skills/`
- **gws-setup の制限**: 現在は `--scopes "https://www.googleapis.com/auth/spreadsheets"` のみ。新サービス追加に伴いスコープ拡張が必要

## 変更内容

### 1. 新規Skill作成（5つ）

`gws-sheets-guide` のパターンに倣い、各サービス用のガイドSkillを作成する。

| Skill名 | 説明 | ヘルパーコマンド |
|---------|------|----------------|
| `gws-gmail-guide` | メール送受信・管理 | `+send`, `+triage`, `+reply`, `+reply-all`, `+forward` |
| `gws-drive-guide` | ファイル・フォルダ管理 | `+upload` |
| `gws-calendar-guide` | カレンダー・イベント管理 | `+insert`, `+agenda` |
| `gws-slides-guide` | プレゼンテーション読み書き | なし（batchUpdate API） |
| `gws-docs-guide` | ドキュメント読み書き | `+write` |

各Skillの構成:
```
gws-{service}-guide/
  SKILL.md                           # メインSkill（ワークフロー + コマンド概要 + 参考リソース）
  references/gws-cli-operations.md   # CLIコマンド詳細リファレンス
```

### 2. gws-setup のスコープ拡張

`gws-setup/SKILL.md` の認証スコープを全サービス対応に変更:
```bash
gws auth login --scopes "https://www.googleapis.com/auth/spreadsheets,https://mail.google.com/,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/presentations,https://www.googleapis.com/auth/documents"
```

また、description にGmail/Drive/Calendar等のトリガーキーワードを追加。

### 3. 各Skillの設計方針

`gws-sheets-guide` から継承するパターン:
- 前提条件チェック（gws/環境変数/認証の自動確認・リフレッシュ）
- 環境変数変換（`export GOOGLE_WORKSPACE_CLI_CLIENT_ID/SECRET`）を毎回必須
- URL解析（該当する場合）
- ワークフロー（入力収集 → 実行 → 検証）
- 技術用語禁止・平易な日本語
- AskUserQuestion の2層記述
- write操作前のユーザー確認
- Troubleshootingセクション
- `<!-- @references -->` に GWS CLI 公式スキルURL を記載

### 4. 参考文献

すべてのSkillの `<!-- @references -->` セクションに以下を含める:
- `https://github.com/googleworkspace/cli/tree/main/skills` — GWS CLI 公式スキル一覧
- 各サービス固有のGWS CLI公式スキルURL

## タスク概要

| ID | タスク | 依存 | Skill/ツール |
|----|--------|------|-------------|
| 0-0 | TaskCreate でタスク登録 | - | - |
| 0-1 | Planファイルリネーム | 0-0 | [Bash] |
| 1 | `gws-gmail-guide` Skill作成 | 0-1 | [general-purpose] |
| 2 | `gws-drive-guide` Skill作成 | 0-1 | [general-purpose] |
| 3 | `gws-calendar-guide` Skill作成 | 0-1 | [general-purpose] |
| 4 | `gws-slides-guide` Skill作成 | 0-1 | [general-purpose] |
| 5 | `gws-docs-guide` Skill作成 | 0-1 | [general-purpose] |
| 6 | `gws-setup` スコープ拡張 | 0-1 | [general-purpose] |
| 99-1 | コードレビュー | 1-6 | [einja-review-code] |
| 99-G | コミット承認ゲート | 99-1 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

- **タスク1〜6**: すべて独立。6並列で実行可能
- **99系**: 順次実行

## リスク・不明点

- GWS CLI の各サービスのスコープURLが正確かどうか → GWS CLI 公式ドキュメントで確認済み
- 作業場所が `einja-skills` リポジトリのため、このリポジトリからのコミットは不要（einja-skillsリポジトリで作業）

## 検証・動作確認方法

- 各SKILL.mdのフォーマットが `gws-sheets-guide` と一致しているか目視確認
- `gws-setup` のスコープが全サービスをカバーしているか確認
- `<!-- @references -->` セクションに正しいURLが含まれているか確認
