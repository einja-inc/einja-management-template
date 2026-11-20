# Sticky Comment 実装仕様

## 目的

同一PRで複数回レビューが実行された場合、Botコメントを**1件に集約**する（追加投稿ではなく差し替え）。
これにより、PR上のコメント欄が過去のレビュー履歴で埋め尽くされることを防ぎ、常に最新のレビュー結果のみが可視化される状態を維持する。

## マーカー

レビューコメント本文の**冒頭**に不可視HTMLコメントマーカーを埋め込む。

```markdown
<!-- einja-pr-review:v1 -->
## Claude PR Review
...
```

- **バージョニング**: `v1` はマーカーバージョン。仕様変更時に `v2` に切り替えて互換性を確保する
  （旧マーカーのコメントは検索対象外となるため、移行期は新規コメントとして投稿される）

## 実装フロー

### 1. リポジトリ・PR番号取得

```bash
# 呼び出し元から PR番号を受け取る想定
PR_NUMBER="${1:?PR number required}"

# リポジトリ情報を gh から取得
OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO=$(gh repo view --json name --jq '.name')
```

### 2. 既存コメント検索

```bash
# einja-pr-review:v1 マーカーで始まるコメントIDを取得（先頭1件）
EXISTING_COMMENT_ID=$(gh api "repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments" \
  --jq '.[] | select(.body | startswith("<!-- einja-pr-review:v1 -->")) | .id' \
  | head -1)
```

### 3. 投稿処理

```bash
if [ -n "${EXISTING_COMMENT_ID}" ]; then
  # 既存コメントを更新（PATCH）
  gh api -X PATCH "repos/${OWNER}/${REPO}/issues/comments/${EXISTING_COMMENT_ID}" \
    -f body="${NEW_BODY}" \
    || echo "⚠️  Failed to update existing sticky comment (id=${EXISTING_COMMENT_ID}). Skill continues." >&2
else
  # 新規投稿
  gh pr comment "${PR_NUMBER}" --body "${NEW_BODY}" \
    || echo "⚠️  Failed to post new sticky comment. Skill continues." >&2
fi
```

### 4. エラーハンドリング

- GitHub API の一時障害（レートリミット・ネットワークエラー等）が発生した場合、Skill全体は継続し、stderr にエラーメッセージのみ出力する
- レビュー結果自体はローカル出力にも残るため、投稿失敗が致命的な情報損失にはならない

## マルチユーザー並行実行の扱い【非サポート】

- 複数開発者が同一PRに対して並行して `/einja-pr-review` を実行した場合、`gh api PATCH` の **last-write-wins** により最後の書き込みが勝つ
- **投稿者属性は最初の実行者に固定される**（例: 開発者Aが最初に投稿、開発者Bが後から更新した場合 → 本文はBの内容だが、GitHub UI 上の投稿者名はAのまま残る → 混乱発生の可能性）
- 本Skillは**直列実行のみサポート**する（並行実行は非サポート）
- **将来の拡張余地**: マーカーに実行者情報を含める（例: `<!-- einja-pr-review:v1:user=xxx -->`）→ 実行者ごとに別コメント化。ただし今回は非サポートで運用開始する

## 誤爆リスクの想定

- 通常のユーザーコメントはHTMLコメントで始まらないため影響なし
- 別Botのコメント（例: Vercel Bot、GitHub Actions Bot）は異なるマーカーを使うため影響なし
- 稀に本Skillの説明・仕様ドキュメントを貼り付けたコメントがマッチする可能性はあるが、実運用上は許容範囲

## 現状実装で未対応の項目（将来的な改善候補）

- **`user.login` フィルタで自分の投稿だけを対象にする改修**: マルチユーザー環境で「別ユーザーが投稿した sticky コメント」を上書きしないようにする安全性向上
  - 実装例: `--jq '.[] | select(.user.login == env.GH_USER) | select(.body | startswith(...)) | .id'`
- **マーカーへの一意情報埋め込み**: リポジトリ名・実行者名・タイムスタンプ等を含めることで、複数コメントの並存や識別を可能にする
