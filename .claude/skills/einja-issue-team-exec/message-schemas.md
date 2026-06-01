# 内部マーカー定義 / Issue 固有メッセージ拡張（Issue 実行固有）

> **汎用メッセージプレフィックス・broadcast ルール・共通スキーマは [`einja-team-exec/message-schemas.md`](../einja-team-exec/message-schemas.md) を参照。**
>
> このファイルは Issue 並列実行で扱う以下2種のみを定義する:
>
> 1. **内部マーカー**（`[review-failed]` / `[qa-failed]`）— Director 内部でサブエージェント出力をパースするための構造化トークン。**SendMessage では送出されない**
> 2. **Issue 固有拡張**（`[change-summary]` の追加フィールド `PR`）— 汎用 `[change-summary]` を継承しつつ Issue 実行で追加するフィールド

## 1. 内部マーカー定義（Director 内部・パース用）

| マーカー | スコープ | 用途 | 送信方式 |
|--------|---------|------|---------|
| `[review-failed]` | Director 内部 | task-reviewer 差し戻し対象タスクの特定 | — （SendMessage 不使用） |
| `[qa-failed]` | Director 内部 | task-qa 失敗対象タスクの特定 | — （SendMessage 不使用） |

これらは Director の内部ループ（レビューフェーズ / QAフェーズ）でサブエージェント出力を解析するための構造化トークン（パース用マーカー）であり、**チーム間メッセージング（SendMessage）には使用しない**。Lead へのエスカレーションが必要になった場合は、汎用の `[error]` プレフィックス（`einja-team-exec/message-schemas.md` 参照）に包んで送信する。

### [review-failed]

task-reviewer が MAJOR 判定を出した場合に、Director が「どのサブタスクを再実行すべきか」を特定するための内部マーカー。

**フォーマット**:

```
[review-failed] TaskID: {X.Y.Z}, Reason: {差し戻し理由}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `TaskID` | 必須 | 再実行対象のサブタスク ID（X.Y.Z 形式） |
| `Reason` | 必須 | 差し戻しの理由（reviewer 出力からの要約） |

**Director の動作**: 該当サブタスク（X.Y.Z）の状態は **Director ローカルファイル**（Director 管理の進捗ファイル）で管理し、`needs_rework` 等の内部ステートに更新した上で、ループの 4. 実装フェーズに戻る。最大2回まで。3回目で `[error]` として Lead にエスカレーション。

> **注意**: X.Y.Z（個別サブタスク）レベルの状態管理は共有 TaskList API（TaskUpdate 等）を使用せず、Director ローカルファイルで完結させる。共有 TaskList の `TaskUpdate` は X.Y（Story）/ X（Phase）レベルに限定し、status は `pending` / `in_progress` / `awaiting_review` / `completed` の4状態のみを使用する。

---

### [qa-failed]

task-qa が FAILURE(A: 実装ミス) を出した場合に、Director が「どのサブタスクを再実行すべきか」を特定するための内部マーカー。

**フォーマット**:

```
[qa-failed] TaskID: {X.Y.Z}, Reason: {失敗理由}, Category: {A|B|C|D}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `TaskID` | 必須 | 再実行対象のサブタスク ID |
| `Reason` | 必須 | 失敗理由（qa 出力からの要約） |
| `Category` | 必須 | A: 実装ミス / B: 要件齟齬 / C: 設計不備 / D: 環境問題 |

**Director の動作**:

| Category | 動作 |
|---------|------|
| A | 該当サブタスク（X.Y.Z）の状態を Director ローカルファイルで `needs_rework` に更新し、再実行（最大2回。3回目は Lead エスカレーション） |
| B / C / D | 即座に `[error]` で Lead にエスカレーション（Director 自身では解決不可） |

> **注意**: X.Y.Z レベルの再実行ステート管理は Director ローカルファイルで完結させ、共有 TaskList API（TaskUpdate 等）は使用しない。

---

## 2. Issue 固有拡張: `[change-summary]` の追加フィールド

汎用 `[change-summary]`（[`einja-team-exec/message-schemas.md` の [change-summary] セクション](../einja-team-exec/message-schemas.md#change-summary) で定義）を **継承** しつつ、Issue 並列実行では追加フィールド `PR` を伴って broadcast される。

- **送信者**: Director
- **受信者**: All（broadcast）
- **タイミング**: タスクのコミット・プッシュ完了後、PR 作成直後
- **継承**: 汎用 `[change-summary]` の全フィールド（`Task`, `タスク名`, `Changed files`, `Changed shared`, `New API`, `New types`, `DB changes`, `Note`）をそのまま使用

**Issue 固有の追加フィールド**:

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `PR` | 必須（Issue 実行時） | 作成された Pull Request 番号（`#{PR番号}` 形式）。Lead 側で PR Gate 処理に紐付ける |

**拡張フォーマット例**:

```
[change-summary] Task {X.Y}: {タスク名}
Changed files: {全変更ファイルパス（カンマ区切り）}
Changed shared: {共有ディレクトリ配下の変更ファイル or "なし"}
New API: {エンドポイント or "なし"}
New types: {型名 or "なし"}
DB changes: {テーブル/カラム or "なし"}
Note: {申し送り事項 or "なし"}
PR: #{PR番号}
```

> 汎用フィールドの詳細・各フィールドの意味は汎用スキーマ側を一次情報とする。本ファイルでは Issue 固有差分（`PR` フィールドの追加）のみを定義する。
