---
name: einja-update-docs-by-issue-specs
description: "Issue仕様書をfeature仕様書とsteering仕様書に反映。ARGUMENTS: Issue仕様書ディレクトリパス（複数可、カンマ区切り）"
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Issue仕様書からドキュメント反映コマンド

## あなたの役割

Issue仕様書（`docs/specs/issues/` 配下）から設計情報を抽出し、以下の2つの階層に反映する専門エージェントです：

1. **Feature仕様書**（`docs/specs/features/<feature-name>/`）- 機能レベルの設計
2. **Steering仕様書**（`docs/einja/steering/`）- プロジェクト全体の設計

Issue仕様書の内容を構造化して抽出し、適切な階層のドキュメントにインテリジェントにマージします。

## このSKILLの位置づけ（スキーマSSoT）

本SKILLは「Issue仕様 → 確定仕様Docs反映」のルール正本（Single Source of Truth）であり、新アーキテクチャの**スキーマ契約を一元定義**する：

- **生成側**: `docs-impact-generator` が `einja-issue-spec-create` の **Phase 1** で（親が対話可能なタイミングに）並列に「Docs反映計画」`docs-impact.md` を生成する。
- **消費側**: `docs-updater` が `einja-task-exec` の **Phase 99** で `docs-impact.md` を**決定論的に**消費し、確定仕様Docsへ反映する（無人で動作）。

後続タスク **B（docs-impact-generator 新設）/ C（docs-updater 修正）/ E（Phase 99 再設計）** は、本SKILLが定義する `docs-impact.md` スキーマと決定論ロジックを**参照のみ**する。スキーマの変更は本SKILLでのみ行うこと。

> 反映先の確定仕様Docs（実在するもののみ）:
> - Steering 3点: `docs/einja/steering/architecture.md` / `docs/einja/steering/db-schema-design.md` / `docs/einja/steering/product.md`
> - Feature仕様: `docs/specs/features/<feature>/requirements.md` / `docs/specs/features/<feature>/design.md`
> - §5 文言伝播先: `docs/einja/steering/development/api-development.md` §5 バリデーション戦略（参照リンクのみ。文言の正本は requirements.md §6.2）

## 実行フロー

### 1. Issue仕様書の検証と読み込み

**入力形式**:
```
/update-docs-by-issue-specs <issue-spec-dir-path> [<issue-spec-dir-path2> ...]
```

**処理**:
- 指定されたディレクトリパスを解析（カンマ区切り対応）
- 各ディレクトリに以下のファイルが存在するか確認：
  - `requirements.md`（必須）
  - `design.md`（必須）
  - `tasks.md`（オプション）
- ファイルが存在しない場合はエラーを表示して終了
- 各ファイルを読み込み、構造化された情報を抽出

## docs-impact.md スキーマ定義（生成側/消費側の共有SSoT）

`docs-impact.md` は `docs-impact-generator`（生成）と `docs-updater`（消費）の**契約**である。本セクションがその正本スキーマを定義する。スキーマを変更する場合は必ず本SKILLを更新し、B/C/E はここを参照する。

### 配置

- `{spec_dir}/docs-impact.md`（`requirements.md` / `design.md` と同階層）
- `{spec_dir}` は `docs/specs/issues/{カテゴリ}/issue{N}-{機能名}/`（例 `docs/specs/issues/auth/issue123-magic-link-login`）の Issue 仕様ディレクトリ

### 形式

**YAML フロントマター（機械可読、`docs-updater` が決定論的に消費）＋ Markdown 本文（人間レビュー用）**の2層構成。

### フロントマター スキーマ

| フィールド | 型 | 説明 |
|-----------|----|------|
| `schema_version` | int | 固定値 `1`。スキーマ進化時にインクリメント |
| `issue` | int/string | Issue 番号（例: `123`） |
| `spec_dir` | string | 仕様ディレクトリパス |
| `generated_phase` | string | 固定値 `spec-create-phase1`（生成タイミングの記録） |
| `targets` | array | 反映対象の配列（下表の要素フィールドを持つ） |
| `unresolved` | array[string] | Phase 99 が本文生成前に必ず確認すべき残課題（文字列のリスト） |

**`targets[]` の要素フィールド**:

| フィールド | 型 | 説明 |
|-----------|----|------|
| `id` | string | 一意ID（`T1`, `T2`, ...）。トレーサビリティマーカーで参照される |
| `file` | string | 反映先ファイルパス（**実在する確定仕様Docsのみ**）。許容: Steering 3点 `docs/einja/steering/{architecture,db-schema-design,product}.md` / Feature 仕様 `docs/specs/features/<feature>/{requirements,design}.md` / §5 文言伝播先 `docs/einja/steering/development/api-development.md`（§5 バリデーション戦略。文言の正本は requirements.md §6.2） |
| `section` | string | 反映先セクション名（既存セクション名 or 「（新規）」） |
| `action` | enum | `append`（既存セクション末尾へ追記）/ `merge`（差分マージ）/ `new-section`（新規セクション作成） |
| `source_section` | string | 反映本文の出所（例「design.md §Architecture」「requirements.md §6.2」）。Phase 99 が本文生成時に Read する確定仕様の場所 |
| `status` | enum | `confirmed`（即反映可）/ `tentative`（要件確定後に突合要） |
| `rationale` | string | 反映理由（1行） |

### 本文（Markdown）

1. **反映サマリ表**: `ID / 反映先(file) / セクション / アクション / 状態(status) / 根拠(rationale)` の表
2. **「反映先未確定の項目」節**: `unresolved` の各項目を人間がレビューできる形で列挙

### トレーサビリティ

反映先ファイルに、対象 `id` を含むマーカーを埋め込む（既存 5.3 のラベル方式を踏襲）：

```markdown
<!-- Issue: #N (日付) source: T1 -->
```

- `#N` は Issue 番号、`T1` は当該反映を生んだ `targets[].id`
- これにより「どの反映が docs-impact.md のどの target 由来か」を逆引きできる
- 重複反映チェック（5.1）と差分マージ（5.x）はこのマーカーを基準に行う

### YAML サンプル

```markdown
---
schema_version: 1
issue: 123
spec_dir: docs/specs/issues/auth/issue123-magic-link-login
generated_phase: spec-create-phase1
targets:
  - id: T1
    file: docs/einja/steering/db-schema-design.md
    section: 認証テーブル
    action: new-section
    source_section: "design.md §Data Model"
    status: confirmed
    rationale: "magic_link_token テーブルを新規追加するため"
  - id: T2
    file: docs/specs/features/login/design.md
    section: API仕様
    action: append
    source_section: "design.md §API Endpoints"
    status: confirmed
    rationale: "POST /auth/magic-link エンドポイントを login feature へ反映"
  - id: T3
    file: docs/specs/features/login/requirements.md
    section: "受け入れ基準"
    action: merge
    source_section: "requirements.md §6.2"
    status: tentative
    rationale: "magic-link 有効期限の文言は要件確定後に §6.2 と突合が必要"
unresolved:
  - "magic-link の有効期限（10分/15分）が requirements.md で未確定。確定後に T3 の文言を突合すること"
---

## 反映サマリ

| ID | 反映先 | セクション | アクション | 状態 | 根拠 |
|----|--------|-----------|-----------|------|------|
| T1 | steering/db-schema-design.md | 認証テーブル | new-section | confirmed | magic_link_token テーブル新規追加 |
| T2 | features/login/design.md | API仕様 | append | confirmed | POST /auth/magic-link を反映 |
| T3 | features/login/requirements.md | 受け入れ基準 | merge | tentative | 有効期限文言を §6.2 と突合要 |

## 反映先未確定の項目

- magic-link の有効期限（10分/15分）が requirements.md で未確定。確定後に T3 の文言を突合すること。
```

### 2. 機能（Feature）の判定

> **※ Feature 判定は Phase 1 で前倒し実施（docs-impact.md に記録済み）。**
> 反映先 Feature の判定は `einja-issue-spec-create` の **Phase 1**（親が対話可能なタイミング）で `docs-impact-generator` が実施し、結果は `docs-impact.md` の `targets[].file`（`docs/specs/features/<feature>/...`）として確定済みである。
> Phase 99 の `docs-updater` は `targets` を**読むだけ**で Feature 判定をやり直さない。`targets` に無い新たな判断が生じた場合のみ、握りつぶさず PENDING_QUESTIONS で親へ返す（後述「docs-impact.md 消費の決定論ロジック」参照）。

**Feature 命名規則**:
- ケバブケースのドメイン名詞を用いる（例: `login`, `signup`, `post-management`）
- **Issue 由来のプレフィックス（例: `issue-123-...`）は禁止**。Feature は Issue 横断の概念であり、複数 Issue が同一 Feature に反映され得る

旧仕様（Phase 99 内で AskUserQuestion により Feature を対話的に判定する方式）は廃止。Feature の候補提示・新規作成判断は Phase 1 の生成側（親が対話可能）で完結させる。

### 3. Feature仕様書への反映【Issue → Feature】

機能が指定された場合、`docs/specs/features/<feature-name>/`に反映します。

#### 3.1 機能ディレクトリの作成確認

**機能specディレクトリが存在しない場合**:
- ユーザーに確認：「機能spec『{feature-name}』を新規作成しますか？」
- ※Phase 99（無人・決定論ルート）では Feature は `docs-impact.md` の `targets` で確定済み。この確認に到達した場合（フォールバック等）は AskUserQuestion を発火せず PENDING_QUESTIONS で親へエスカレーションする。
- 承認されたら以下を作成：
  ```
  docs/specs/features/<feature-name>/
  ├── requirements.md
  ├── design.md
  └── tasks.md
  ```

#### 3.2 requirements.md への反映

**対象**: `docs/specs/features/<feature-name>/requirements.md`

**Issue specから抽出する情報**（`requirements.md`から）:
- **ビジネス価値**（ビジネス価値セクション）
- **ユーザーストーリー**（ユーザーストーリーセクション）
- **受け入れ基準**（各ストーリーの受け入れ基準）
- **成功指標**（成功指標セクション）
- **非機能要件**（非機能要件セクション）

**反映形式**:
```markdown
## Issue: {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### ビジネス価値
{抽出した内容}

### ユーザーストーリー
{抽出した内容}

### 受け入れ基準
{抽出した内容}

---
```

**マージロジック**:
- 既存内容の最後に追記（セクションが存在する場合）
- セクションが存在しない場合は新規作成
- 同じIssueからの重複反映を防止（Issue名+日付でチェック）

#### 3.3 design.md への反映

**対象**: `docs/specs/features/<feature-name>/design.md`

**Issue specから抽出する情報**（`design.md`から）:
- **API仕様**（APIエンドポイントセクション）
- **コンポーネント設計**（コンポーネントとインターフェースセクション）
- **シーケンス図**（シーケンス図セクション）
- **テスト設計**（テスト設計セクション）
- **実装上の注意点**（実装上の注意点セクション）

**反映形式**:
```markdown
## Issue: {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### API仕様
{抽出した内容}

### コンポーネント設計
{抽出した内容}

---
```

#### 3.4 tasks.md への反映

**対象**: `docs/specs/features/<feature-name>/tasks.md`

**Issue specから抽出する情報**（`tasks.md`から）:
- タスク一覧（Phase別）
- 依存関係情報
- 完了基準

**反映形式**:
```markdown
## Issue: {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### 実装タスク
{抽出したタスクリスト}

---
```

### 4. Steering仕様書への反映【Issue → Steering】

すべてのIssue specは、Steering仕様書にも反映されます。

#### 4.1 architecture.md への反映

**対象**: `docs/einja/steering/architecture.md`

**Issue specから抽出する情報**（`design.md`から）:
- **システム構成図**（Mermaid図を含む）
- **データフロー図**
- **技術スタック表**
- **パッケージ構造と依存関係**
- **デプロイメント戦略**
- **アーキテクチャパターン**（Clean Architecture、Repository Patternなど）
- **開発ワークフロー**

**反映形式**:
```markdown
## {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### システム構成
{抽出した構成図とMermaid}

### 技術スタック
{抽出した技術スタック表}

### アーキテクチャパターン
{抽出したパターン説明}

---
```

**マージロジック**:
- ファイルが空またはTODOのみの場合、目次構造を作成してから追記
- 既存の同名セクションがある場合、Issueごとのサブセクションとして追記
- Mermaid図は`<!-- Issue: {Issue名} -->`コメントでラベル付け

#### 4.2 db-schema-design.md への反映

**対象**: `docs/einja/steering/db-schema-design.md`

**Issue specから抽出する情報**（`design.md`から）:
- **ERD図**（Entity-Relationship Diagram）
- **Prismaスキーマ定義**
- **リポジトリパターン実装**
- **データアクセス層設計**
- **インデックス戦略**
- **マイグレーション戦略**

**反映形式**:
```markdown
## {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### データベーススキーマ
{抽出したスキーマ定義}

### ERD
{抽出したERD図}

### リポジトリパターン
{抽出したリポジトリ設計}

---
```

#### 4.3 product.md への反映

**対象**: `docs/einja/steering/product.md`

**Issue specから抽出する情報**:
- **ビジネス価値と目標**（`requirements.md`から）
- **ユーザーストーリー概要**（`requirements.md`から）
- **主要API仕様**（`design.md`から）
- **成功指標とKPI**（`requirements.md`から）
- **タイムラインとフェーズ**（`requirements.md`から）

**反映形式**:
```markdown
## {Issue名} ({日付})

**反映日時**: {現在日時}
**ソース**: {Issue specパス}

### ビジネス価値
{抽出した内容}

### 主要機能
{抽出したユーザーストーリー概要}

### 成功指標
{抽出したKPI}

---
```

#### 4.4 §6.2 エラーメッセージ文言の SSoT 方針

エラーメッセージ文言の**正本（Single Source of Truth）は各 Issue の `requirements.md` §6.2「フィールド別ルール表」**である。文言を反映する際は二重管理を避けるため、以下を厳守する：

- **Feature 仕様 `requirements.md` §6 へ反映する場合**: 文言を直書きで複製せず、「正本: 各 Issue requirements §6.2」と注記する。
- **`docs/einja/steering/development/api-development.md` §5 へ反映する場合**: **参照リンクのみ**を記載し、文言を転記しない（`api-development.md` は文言の複製先にしない）。
- 文言の更新が必要になった場合は `requirements.md` §6.2 を更新し、参照側は追従不要とする。

`docs-impact.md` の `targets` で `file: docs/einja/steering/development/api-development.md` を指す場合、その `action` は参照リンクの追記（`append` / `new-section`）に限定し、`source_section` には文言正本（例「requirements.md §6.2」）を記録すること。

### 5. インテリジェントマージの詳細ロジック

#### 5.1 重複チェック【決定論】

各ファイルで、当該 Issue のトレーサビリティマーカーを検索：
```markdown
<!-- Issue: #N (日付) source: T... -->
```

**決定論ルール（AskUserQuestion を使わない）**:
- 同一 `<!-- Issue: #N -->` マーカーが既に存在する場合 → **差分マージ（既存を削除せず追記）を既定動作に固定**する。
- **上書きはしない**（非破壊原則）。既存セクションの内容を削除・置換しない。
- 反映済みで内容差分が無い場合は冪等にスキップ（同一内容の重複追記をしない）。

これにより Phase 99 の `docs-updater` は無人で決定論的に動作する。

#### 5.2 セクション構造の維持

**空ファイルまたはTODOのみの場合**:
1. 標準的な目次構造を作成
2. 各セクションにIssueの内容を追記

**既存内容がある場合**:
1. 既存のセクション構造を解析
2. 対応するセクションを見つけて追記
3. セクションが存在しない場合、適切な位置に新規作成

**目次構造例（architecture.md）**:
```markdown
# システムアーキテクチャ

## 概要

## システム構成

### Issue: Monorepo Setup (20251104)
...

## 技術スタック

### Issue: Monorepo Setup (20251104)
...

## デプロイメント戦略

### Issue: Monorepo Setup (20251104)
...
```

#### 5.3 Mermaid図の扱い

**図の識別**:
- 各Mermaid図の直前にコメントを追加：
  ```markdown
  <!-- Issue: {Issue名} ({日付}) -->
  ```mermaid
  ...
  ```
  ```

**複数Issueの図の統合**:
- 同種の図（例: システム構成図）が複数ある場合、並列配置
- 重複や矛盾がある場合、ユーザーに確認して統合提案（※Phase 99（無人）では AskUserQuestion 不可のため、統合せず PENDING_QUESTIONS で親へ報告する）

### 6. docs-impact.md 消費の決定論ロジック（Phase 99 / docs-updater）

Phase 99 の `docs-updater` は**無人で**動作するため、対話（AskUserQuestion）に依存しない。`docs-impact.md` の `targets` / `unresolved` を以下の決定論アルゴリズムで処理する。

> **包括オーバーライド注記**: 本SKILL §3〜§5 に残る「ユーザーに確認」系の記述は、Phase 99（無人決定論ルート）では AskUserQuestion を**発火せず PENDING_QUESTIONS 化に読み替える**。記述自体は対話可能なルート（Phase 1 等）向けに残すが、Phase 99 で到達した場合は本セクションの決定論ロジックが優先する。

#### 6.1 処理順（アーリーリターン禁止）

1. `docs-impact.md` を Read し、フロントマターをパース（`schema_version` を検証）。期待値（現在 `1`）と異なる場合は PENDING_QUESTIONS で親へ報告し処理を中断する。
2. **`targets` を全件処理し切る**。途中で `unresolved` や突合失敗が出ても、その target だけ保留して**残りの target の反映を続行**する（部分反映を最大化する）。
3. 全件処理後、残った `unresolved` と突合失敗（後述 6.3）を**1本の PENDING_QUESTIONS にまとめて**親へ返す。**握りつぶし・スキップの黙殺は禁止**。

#### 6.2 各 target の反映

- `status: confirmed` → `source_section` が指す確定仕様（`requirements.md` / `design.md` の該当セクション）を Read し、`file` の `section` へ `action`（`append` / `merge` / `new-section`）で反映。トレーサビリティマーカー（5.x の `<!-- Issue: #N (日付) source: T... -->`）を埋め込む。
- 重複は 5.1 の決定論ルール（差分マージ・非破壊）に従う。

#### 6.3 tentative 突合アルゴリズム

`status: tentative` の target は、要件確定後の突合が必要：

1. `source_section` が指す `requirements.md` / `design.md` の**確定セクションを Read** する。
2. target の `section` / `action` と、確定セクションの内容が**矛盾しないか判定**する。
3. **矛盾なし** → confirmed と同様に反映する。
4. **矛盾あり** → 当該 target を反映せず **PENDING_QUESTIONS 化**する（スキップして握りつぶさない。何が矛盾したかを明記）。

#### 6.4 source_section の事後ズレ

`docs-impact-generator` は Phase 1 で `requirements.md` 等と**並列起動**されるため、生成時点の `source_section` は**仮置き**であり得る。

- `requirements.md` 確定後に `docs-impact.md` の `source_section` / `status` を更新する責務は、`einja-issue-spec-create` の **Phase 1c の親（オーケストレーター）**にある。
- `docs-updater`（Phase 99）は更新済みの `docs-impact.md` を受け取る前提で動作する。突合時に明確なズレを検出したら 6.3 に従い PENDING_QUESTIONS 化する。

#### 6.5 docs-impact.md 不在時のフォールバック

旧 Issue 等で `docs-impact.md` が存在しない場合：

- 反映先を **Steering 3点（`architecture.md` / `db-schema-design.md` / `product.md`）のみ**に固定して反映する（Feature 仕様への自動反映は行わない）。
- Feature 判定など判断が必須な点は、推測せず **PENDING_QUESTIONS で親へエスカレーション**する。

#### 6.6 最終承認

- 反映内容の承認は `einja-issue-spec-create` の **Phase 1e（docs-impact.md 承認）で前倒し済み**。
- Phase 99 では反映後、`einja-task-commit` で**自動コミット**する。
- **Phase 99 内での最終確認の AskUserQuestion は廃止**する。

### 7. エラーハンドリング

**Issue specが見つからない場合**:
```
エラー: Issue仕様書が見つかりません
パス: {指定パス}
確認事項:
- パスが正しいか確認してください
- requirements.md と design.md が存在するか確認してください
```

**requirements.md/design.md がない場合**:
```
警告: {ファイル名}が見つかりません
Issue: {Issue名}
対応: このIssueの反映をスキップして続行しますか？
```

**機能spec作成時の競合**:
```
警告: 機能spec『{feature-name}』は既に存在しますが、内容が空です
対応: 既存ファイルを上書きして反映しますか？
```

## 重要な原則

### 情報の忠実性
- Issue specの内容を改変せず、忠実に抽出して反映する
- 要約や意訳は最小限にし、原文をできるだけ保持する
- コードブロック、図表は完全な形で転記する

### トレーサビリティ
- すべての反映内容に「ソース」情報を記録する
- Issue名と日付を明記し、後から追跡可能にする
- 変更履歴が明確にわかるようにする

### 非破壊的マージ
- 既存の内容を削除しない（ユーザー確認がある場合を除く）。※Phase 99（無人）では上書きせず非破壊追記のみとし、削除が必要な状況は PENDING_QUESTIONS で親へエスカレーションする
- 追記を基本とし、上書きは最小限にする
- 重複チェックを徹底し、不要な反復を避ける

### 決定論的な処理（Phase 99 は無人）
- Phase 99 の `docs-updater` は対話せず、`docs-impact.md` の `targets` / `unresolved` を決定論的に消費する
- 機能の判定・新規作成・反映承認は **Phase 1（生成側、親が対話可能）**で前倒し済み
- `targets` に無い判断・tentative の突合矛盾・docs-impact.md 不在時の判断必須点は、握りつぶさず **PENDING_QUESTIONS で親へエスカレーション**する（`.claude/skills/_einja-subagent-question-protocol/SKILL.md` 準拠）

### 段階的な実行
- 1つのIssue specずつ処理する
- 各ステップの結果を明確に表示する
- エラーが発生しても他のIssue specの処理を継続する

## 出力フォーマット

処理完了後、以下の形式でレポートを表示：

```markdown
# Issue仕様書反映完了

## 処理したIssue
1. ✅ Monorepo Setup (20251104)
   - Feature: なし（Steeringのみ）
   - 反映先: architecture.md, db-schema-design.md, product.md

2. ✅ Login Authentication (20251105)
   - Feature: login
   - 反映先: features/login/*, steering/*

## 反映サマリー

### Feature仕様書
- **features/login/requirements.md**: 3セクション追加（412行）
- **features/login/design.md**: 5セクション追加（823行）
- **features/login/tasks.md**: 1セクション追加（156行）

### Steering仕様書
- **steering/architecture.md**: 7セクション追加（1,245行）
- **steering/db-schema-design.md**: 4セクション追加（567行）
- **steering/product.md**: 3セクション追加（334行）

## 次のステップ
- 反映された内容を確認してください
- 必要に応じて手動で調整してください
- 変更をコミットする場合は、明確なコミットメッセージを記述してください
```

## 使用例

### 例1: 単一Issueの反映
```
/update-docs-by-issue-specs docs/specs/issues/monorepo/issue12-monorepo-turborepo-nextjs-setup
```

### 例2: 複数Issueの反映
```
/update-docs-by-issue-specs docs/specs/issues/issue1,docs/specs/issues/issue2,docs/specs/issues/issue3
```

### 例3: スペース区切り
```
/update-docs-by-issue-specs docs/specs/issues/monorepo/issue12-monorepo-turborepo-nextjs-setup docs/specs/issues/auth/issue34-login-feature
```

<!-- @einja:project-private:start id="update-docs-by-issue-specs-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
