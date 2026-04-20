# ID 命名規約と正規表現（Epic Specs）

Epic Specs で使用する各種 ID の命名規約と正規表現。`_einja-epic-contract-validator` の構造検証で使用し、各 JSON Schema にも同じ pattern を埋め込んでいる。

schema: **1.0**

## ID 一覧

| 種別 | 例 | 正規表現 | スコープ | 一意性 | 備考 |
|-----|-----|---------|---------|-------|------|
| Epic ID | `EPIC-1` | `^EPIC-\d+$` | グローバル | Epic 単位で一意 | GitHub Issue 番号と必ずしも一致しない（Epic の論理 ID）。`1` はゼロ埋めしない。 |
| Feature ID | `F-01` | `^F-\d+$` | Epic 内 | Epic 内で一意 | ゼロ埋め 2 桁を推奨（ソート順のため）が、regex は `\d+` で幅を制限しない。 |
| Story ID | `S-01` | `^S-\d+$` | Epic 内 | Epic 内で一意 | Feature 配下の Story。ゼロ埋め推奨。 |
| AC ID | `AC-01` | `^AC-\d+$` | Epic 内 | Epic 内で一意、かつ **ちょうど 1 Issue に所有される** | ownerIssueSlug で所有 Issue を一意指定。未割当・重複割当はどちらも validator FAILURE。 |
| Transition ID | `TR-01` | `^TR-\d+$` | Epic 内 | Epic 内で一意 | screen-transitions.drawio と同期する画面遷移 ID。 |
| Issue slug | `profile-view-edit` | `^[a-z0-9-]+$` | Epic 内 | Epic 内で一意 | 小文字英数とハイフン。Pencil フレーム命名、ディレクトリ名、ブランチ命名と一貫。 |
| UI Frame ID | `profile-view` | `^[a-z0-9-]+$`（`minLength: 1`） | Epic 内 | Epic 内で一意 | Pencil ui-design.pen のフレーム命名と一致。Issue slug と衝突しても構わない（名前空間別）。 |
| Question ID | `Q-a1b2c3d4e5f6` | `^Q-[a-f0-9]{12}$` | Epic 内 | Epic 内で一意 | `Q-` + sha256(sourceSkill + '\|' + 正規化 question) の先頭 12 文字（16進）。 |
| Question Fingerprint | `a1b2c3...（64 hex）` | `^[a-f0-9]{64}$` | グローバル | 同一内容の質問で一致 | sha256(sourceSkill + '\|' + 正規化 question) の 64 文字。重複排除キー。 |
| Epic Branch | `epic/user-profile-settings` | `^epic/[a-z0-9-]+$` | リポジトリ全体 | 一意 | `epic/{slug}` 形式。 |
| Issue Branch | `issue/101` | `^issue/\d+$` | リポジトリ全体 | 一意 | `issue/{GitHub Issue 番号}` 形式。既存 branch-strategy.md と整合。 |
| scope.md Path | `docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md` | `^docs/specs/epics/[a-z0-9-]+/issues/[a-z0-9-]+/scope\.md$` | リポジトリ全体 | 一意 | epic-manifest.json の issues[].scopePath で参照。 |
| Idempotency Key | `EPIC-1:profile-view-edit:issue-spec` | `^EPIC-\d+:([a-z0-9-]+\|null):(issue-spec\|issue-spec-pr\|tracker\|epic-pr\|milestone)$` | グローバル | 一意 | `{epicId}:{issueSlug\|null}:{kind}`。operationLog[].idempotencyKey。 |

## Question ID / Fingerprint 正規化ルール

fingerprint（sha256 64 文字）と questionId（先頭 12 文字）を計算するための、question 本文の正規化ルール:

1. 前後の空白（スペース・タブ・改行）を除去
2. 連続する空白を単一スペースに圧縮
3. 行末の記号（`。` / `.` / `?` / `？` / `!` / `！`）を除去
4. すべて小文字化（日本語は影響しない）
5. `{sourceSkill} + '|' + {正規化済み question}` を sha256 ハッシュ化
6. fingerprint は 64 文字の hex、questionId は fingerprint の先頭 12 文字に `Q-` プレフィックスを付与

このルールにより、表現揺れ（句読点・全角半角・前後空白）が同一とみなされ、重複質問が統合される。

## 永続マーカー内の ID 参照

永続マーカー `<!-- einja:epic-id={epicId} issue-slug={issueSlug|null} kind={kind} schema=1.0 -->` 内で使用:

- `{epicId}`: Epic ID（例: `EPIC-1`）
- `{issueSlug|null}`: Issue slug または文字列 `null`（NULL 値ではなくリテラル `null`）
- `{kind}`: `issue-spec` / `issue-spec-pr` / `tracker` / `epic-pr` / `milestone`
- `schema=1.0`: マーカーフォーマットのバージョン（固定）

詳細は [persistent-marker-spec.md](./persistent-marker-spec.md) を参照。

## ID 採番ガイドライン

- **Feature / Story / AC / Transition**: Epic 企画時に連番で採番。後から追加する場合は末尾に追加（欠番を埋めない）。
- **Issue slug**: 機能名をケバブケース（kebab-case）で。例: `profile-view-edit`、`profile-avatar-upload`。短すぎず（3 文字以上）、長すぎず（40 文字以下）を推奨。
- **UI Frame ID**: 画面の用途が伝わる名前。例: `dashboard`、`profile-view`、`avatar-upload-modal`。Pencil の実フレーム名と一致させる。
- **Epic ID**: 既存の `docs/specs/epics/` ディレクトリを走査して最大番号 +1 を採番。

## 一意性・整合性検証（validator の責務）

以下は JSON Schema の `pattern` だけでは表現できないため、`_einja-epic-contract-validator` で検証する:

- 全 ID の一意性（各スコープ内）
- `ownerIssueSlug` / `issueSlug` の manifest `issues[].slug` 参照整合
- `dependsOn` の参照整合と循環なし（DAG）
- 各 AC がちょうど 1 Issue に所有されること（`acceptanceCriteria[].ownerIssueSlug` と `issues[].acIds` の双方向整合）
- 各 Feature が 1 つ以上の Issue に割り当てられること
- `uiFrames[].id` / `transitions[].id` への参照整合（`uiFrameIds` / `transitionIds` / `transitions.from` / `transitions.to`）
- `scope.md` frontmatter と manifest の当該 Issue エントリの一致
- `schemaVersion` の major 一致
