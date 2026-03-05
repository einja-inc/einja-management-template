---
description: ".claude/commands配下のコマンドを.cursor/rules用に自動変換（Cursor 2.2+対応）"
---

# Cursor ルール同期ツール（v2）

## あなたの役割

あなたは Claude Code のカスタムコマンドを **Cursor 2.2+ 互換のルール形式**に自動変換する専門家です。

`.claude/commands/` 配下の全コマンドファイルをスキャンし、Cursor の**新しいルール形式**（`.cursor/rules/{rule-name}/RULE.md`）に変換します。

> **⚠️ 重要：Cursor のルール形式変更について**
>
> Cursor 2.2 以降、コマンド/ルールの構成が変更されました：
> - ❌ `.cursor/commands/*.md` → **廃止**（レガシー）
> - ❌ `.cursor/rules/*.mdc` → **非推奨**（既存は動作するが新規作成は非推奨）
> - ✅ `.cursor/rules/{rule-name}/RULE.md` → **推奨形式**

## 処理フロー

### 1. ソースファイルのスキャン

**実行手順**:
```bash
# .claude/commands 配下の全 .md ファイルを再帰的に検索
Glob: .claude/commands/**/*.md
```

各ファイルを Read で読み込み、変換対象として処理します。

**除外対象**:
以下のファイルは変換対象から除外します：
- `sync-cursor-commands.md`（このファイル自体。Claude Code専用機能のため）
- `sync-cursor-rules.md`（同上）

### 2. 変換処理

各ファイルに対して以下の変換を実行します：

#### 2.1 サブエージェント参照の検出と変換

**検出パターン**:
以下のようなサブエージェント参照を検出します：
- 「Task ツールで {subagent_name} を呼び出す」
- 「{subagent_name} サブエージェントを使用」
- 「Task({subagent_type}: {subagent_name})」

**サブエージェントファイルパスの特定**:
`.claude/agents/` 配下を再帰的に検索し、`{サブエージェント名}.md` に一致するファイルを使用

例：
- `task-executer` → `.claude/agents/task/task-executer.md`
- `requirements-generator` → `.claude/agents/issue-specs/requirements-generator.md`

**変換テンプレート**:

変換前（Claude Code 形式）の記述を、以下のテンプレートで置き換えます：

```markdown
{subagent_name} の処理を実行：

**📖 サブエージェントプロンプトの読み込み**
- `.claude/agents/` 配下から `{subagent_name}.md` を検索して Read ツールで読み込む
- YAML フロントマター（`---` で囲まれた部分）を除外
- 本文のプロンプト内容を取得

**🔨 プロンプトに従った処理の実行**
- 取得したプロンプト内容に記載された手順・指示に従って処理を実行
- プロンプト内の「自動探索・実行プロセス」セクションの手順を順次実行
- プロンプト内の「出力形式」セクションを確認

**📋 完了報告**
- サブエージェント定義ファイルの「出力形式」セクションに記載された形式で報告を出力
- 報告内容は構造化マークダウン（絵文字付き見出し使用）
```

#### 2.2 RULE.md フォーマットへの変換

**Cursor の新ルール形式**:

各コマンドを以下のフォルダ構造に変換します：

```
.cursor/rules/
  {command-name}/
    RULE.md
```

**RULE.md のフロントマター形式**:

```markdown
---
description: "{元のdescriptionを使用}"
globs: 
alwaysApply: false
---
```

- `description`: 元のコマンドの description をそのまま使用
- `globs`: 空のまま（手動呼び出し用 = `@{command-name}` で呼び出し）
- `alwaysApply: false`: 手動呼び出し専用（Apply Manually タイプ）

**注意**: `allowed-tools` は Cursor では使用しないため削除

#### 2.3 Cursor 用の注意書きを追加

ルール本文の冒頭（フロントマター直後）に以下のセクションを追加：

```markdown
> **⚠️ Cursor での実行について**
>
> このルールは `.claude/agents/` 配下のサブエージェント定義ファイルを参照します。
> サブエージェント呼び出し箇所では、該当する `.md` ファイルを Read で読み込み、
> そのプロンプト内容に従って処理を実行してください。
>
> **サブエージェント実行の手順**:
> 1. サブエージェント `.md` ファイルを Read で読み込む
> 2. YAML フロントマターを除外し、本文プロンプトを取得
> 3. プロンプトの指示に従って処理を実行
> 4. プロンプト内の「出力形式」に従った報告を生成
>
> **使い方**: チャットで `@{rule-name}` を入力して呼び出してください

[既存のコマンド内容]
```

### 3. ファイルの出力

変換後のファイルを `.cursor/rules/{command-name}/RULE.md` に Write します：

```bash
# 例（フォルダ形式）
.claude/skills/einja-task-exec/SKILL.md → .cursor/rules/task-exec/RULE.md
.claude/skills/einja-issue-spec-create/SKILL.md → .cursor/rules/spec-create/RULE.md
.claude/commands/einja/start-dev.md → .cursor/rules/start-dev/RULE.md
```

**ディレクトリ作成**:
出力前に対象ディレクトリが存在しない場合は作成してください。

### 4. レガシーファイルのクリーンアップ（オプション）

古い形式のファイルが存在する場合、削除を提案します：

```bash
# 削除対象（ユーザーに確認後）
.cursor/commands/*.md  # 旧コマンド形式
```

### 5. 変更サマリーの表示

処理完了後、以下の形式で報告を出力してください：

```markdown
## 🎉 Cursor ルール同期完了（v2 形式）

### 処理サマリー
- **変換元ディレクトリ**: `.claude/commands/`
- **変換先ディレクトリ**: `.cursor/rules/` （フォルダ形式）
- **処理ファイル数**: N個

### 変換済みルール一覧
| ルール名 | 出力先 | サブエージェント参照 |
|---------|--------|-------------------|
| spec-create | `.cursor/rules/spec-create/RULE.md` | 3箇所変換 |
| task-exec | `.cursor/rules/task-exec/RULE.md` | 4箇所変換 |
| start-dev | `.cursor/rules/start-dev/RULE.md` | なし |

### 除外されたファイル
- ⏭️ sync-cursor-commands.md（Claude Code専用機能のため除外）

### 使い方
Cursor で以下のルールが利用可能になりました：
- チャットで `@spec-create` と入力して呼び出し
- チャットで `@task-exec` と入力して呼び出し
- チャットで `@start-dev` と入力して呼び出し

### レガシーファイル
以下の古い形式のファイルが検出されました（削除推奨）：
- `.cursor/commands/einja-task-exec.md`
- `.cursor/commands/einja-issue-spec-create.md`
```


## 変換時の注意事項

### 保持すべき内容
- YAML フロントマター（description）
- コマンドの基本的なロジックと手順
- ユーザー向けの説明文
- 実行例とサンプルコード

### 変更すべき内容
- `Task` ツール呼び出し → サブエージェントファイル読み込み形式
- サブエージェント参照の説明
- Cursor 固有の注意書き追加
- フロントマター形式（`alwaysApply`, `globs` を追加）

### 削除すべき内容
- Claude Code 固有のツール説明（Task ツールの使い方など）
- `allowed-tools` ヘッダー（Cursor では使用しない）
- サブエージェント実行の内部実装詳細


## 使用例

```bash
# コマンド実行（Claude Code から）
/sync-cursor-commands

# 実行結果
✅ 4個のルールを .cursor/rules/ に変換しました

変換結果:
├── .cursor/rules/spec-create/RULE.md (3箇所のサブエージェント参照を変換)
├── .cursor/rules/task-exec/RULE.md (4箇所のサブエージェント参照を変換)
├── .cursor/rules/start-dev/RULE.md (変換不要)
└── .cursor/rules/update-docs-by-issue-specs/RULE.md (変換不要)
```

## エラー処理

以下のエラーに適切に対処してください：

1. **ソースファイルが存在しない**
   - `.claude/commands/` ディレクトリが空の場合
   - エラーメッセージを表示して終了

2. **サブエージェントファイルが見つからない**
   - 参照されているサブエージェントファイルが存在しない場合
   - 警告を表示し、該当箇所をスキップ

3. **書き込み権限エラー**
   - `.cursor/rules/` ディレクトリが書き込み不可の場合
   - エラーメッセージを表示して終了

## Cursor ルールのベストプラクティス

以下は Cursor 公式ドキュメントから抽出したベストプラクティスです：

### ルール設計の原則
- ✅ **500行以内**に収める
- ✅ 大きなルールは**複数の組み合わせ可能なルール**に分割
- ✅ **具体的な例や参照ファイル**を提示する
- ✅ **曖昧な指示を避け**、社内ドキュメントのように明確に記述
- ✅ 同じプロンプトを繰り返す場合は**ルールとして再利用**

### ルールタイプの選択
| タイプ | 用途 | 設定 |
|--------|------|------|
| Always Apply | 全チャットに適用 | `alwaysApply: true`, `globs:` なし |
| Apply Intelligently | 自動判断で適用 | `alwaysApply: false`, `description` 必須 |
| Apply to Specific Files | 特定ファイルに適用 | `globs: ["**/*.ts"]` |
| Apply Manually | 手動呼び出し専用 | `alwaysApply: false`, `globs:` 空 |

### コマンドからの変換推奨設定
- **Apply Manually**（手動呼び出し）を使用
- `@{rule-name}` でチャットから呼び出し

## 拡張性

### 新しいサブエージェントの追加

将来的に新しいサブエージェントが追加された場合：

1. `.claude/agents/` 配下に新しいサブエージェントファイルを配置
2. 必要に応じてサブディレクトリで整理
3. このツールは自動的にファイルを検索して変換（設定変更不要）

### カスタマイズ

プロジェクト固有のニーズに応じて、以下をカスタマイズ可能：

- 変換テンプレートの形式
- 注意書きの内容
- エラーハンドリングの詳細度
- ルールタイプ（`alwaysApply` / `globs`）の設定

<!-- @einja:project-private:start id="sync-cursor-commands-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
