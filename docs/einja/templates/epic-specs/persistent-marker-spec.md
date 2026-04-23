# 永続マーカー仕様（Epic Specs）

Epic 関連 GitHub リソースの冪等化と再発見のために、本文（または Description）冒頭に HTML コメント形式の永続マーカーを埋め込む。タイトルのリネーム・本文の書き換えに耐え、GitHub Search API 経由で再検索可能にすることが目的。

schema: **1.0**

## マーカー形式

```
<!-- einja:epic-id={epicId} issue-slug={issueSlug|null} kind={kind} schema=1.0 -->
```

### フィールド

| フィールド | 型 | パターン | 説明 |
|----------|----|---------|------|
| `epic-id` | string | `^EPIC-\d+$` | Epic の論理 ID。例: `EPIC-1`。 |
| `issue-slug` | string or `null` | `^[a-z0-9-]+$` or `null` | Issue 単位リソースでは slug、Epic 全体リソースでは文字列 `null`（NULL 値ではなく、マーカー文字列として `null` と書く）。 |
| `kind` | enum | 下表参照 | リソース種別。 |
| `schema` | string | `^1\.0$` | マーカーフォーマットのバージョン。v1 系は `1.0` 固定。 |

### kind enum

| kind 値 | 対象リソース | 埋込位置 | issue-slug |
|--------|------------|---------|-----------|
| `issue-spec` | 各 Issue の GitHub Issue | Issue 本文冒頭 | Issue の slug（必須） |
| `issue-spec-pr` | Issue Spec PR（`issue/{N}` → `epic/{slug}`） | PR 本文冒頭 | Issue の slug（必須） |
| `tracker` | Epic Tracker Issue | Issue 本文冒頭 | `null` |
| `epic-pr` | Epic PR（`epic/{slug}` → IssueBranchBase） | PR 本文冒頭 | `null` |
| `milestone` | GitHub Milestone | Description 冒頭 | `null` |

## 埋込例

### Issue Spec（Issue 単位）

```
<!-- einja:epic-id=EPIC-1 issue-slug=profile-view-edit kind=issue-spec schema=1.0 -->

## Epic コンテキスト
...
```

### Tracker Issue（Epic 全体）

```
<!-- einja:epic-id=EPIC-1 issue-slug=null kind=tracker schema=1.0 -->

# Epic: ユーザープロフィール設定機能

## Issues
- [ ] #101 プロフィール表示・編集画面の実装
- [ ] #102 アバター画像アップロード機能の実装
```

### Milestone

Milestone Description 冒頭に配置:

```
<!-- einja:epic-id=EPIC-1 issue-slug=null kind=milestone schema=1.0 -->
Epic: ユーザープロフィール設定機能。関連 Issue は Epic Tracker #100 を参照。
```

## GitHub での検索方法

リソース種別ごとに検索方式が異なる。**Issue/PR は Search API 利用可、Milestone は REST List + クライアント照合必須**。

### Issue / PR 検索（`issue-spec` / `issue-spec-pr` / `tracker` / `epic-pr`）

GitHub Search API を `in:body` で使用。

```
q=repo:{owner}/{repo} "einja:epic-id={epicId}" in:body
```

Issue / PR を跨ぐ検索になるため、必要に応じて `type:issue` / `type:pr` を追加して絞り込む。さらに kind を含めて精度を上げる場合:

```
q=repo:{owner}/{repo} "einja:epic-id={epicId}" "kind=issue-spec" in:body type:issue
```

Search API のスニペット結果から本文全体を取得するには、ヒットした番号ごとに `GET /repos/{owner}/{repo}/issues/{number}` を呼び出してマーカー完全一致を再確認すること（部分一致のみで判定しない）。

### Milestone 検索（`milestone`）

**GitHub Search API は Milestone を body 検索対象にできない**（仕様制約）。以下の手順を使用:

1. `GET /repos/{owner}/{repo}/milestones?state=all&per_page=100` をページング取得（`Link` ヘッダの `rel="next"` を追跡）。
2. 各 Milestone の `description` を取得。
3. クライアント側で `einja:epic-id={epicId}` 部分文字列を検索。
4. マッチした Milestone の description から完全なマーカー文字列を抽出し、`kind=milestone` を確認。
5. 一致すれば `milestoneId` として reuse、なければ create。

クローズ済み Milestone も対象（`state=all` を必ず指定）。

## 再照合手順（冪等再利用）

`operationLog` をスキップ根拠としてそのまま信頼せず、以下の順で再照合してから reuse/create 判定する:

1. **operationLog に success + remoteId あり** → 該当リソースを GET
   - Issue/PR: `GET /repos/{owner}/{repo}/issues/{number}`
   - Milestone: `GET /repos/{owner}/{repo}/milestones/{id}`
2. **GET 成功 + マーカー完全一致** → update / reuse
3. **GET 404 or マーカー不一致** → マーカー検索にフォールバック（上記「Issue/PR 検索」または「Milestone 検索」）
4. **検索で発見** → `operationLog` エントリの `remoteId` を補正し、`updatedAt` を更新、reuse
5. **発見できない** → create（新規 `operationLog` エントリ追加）
6. **status=failed エントリはスキップ禁止** → `error.retryable=true` なら再試行、`false` なら PENDING_QUESTIONS に昇格

## マーカー保持のルール

- Issue / PR 本文の更新（create-or-update）時は、**必ずマーカー行を維持**すること。既存本文を丸ごと書き換える場合も、マーカーは冒頭に残す。
- ユーザーが手動で本文を編集してもマーカーが消えないよう、Epic スキーマの更新時にマーカーを再挿入する（存在確認 → なければ先頭追加）。
- マーカーの `schema` バージョンが 1.0 以外の場合、`_einja-epic-contract-validator` は警告ではなく FAILURE を返す（major 不一致は非互換）。
