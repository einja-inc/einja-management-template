---
name: _einja-ci-check
description: "CI確認・自動修正の共通インナーSkill。プッシュ/PR作成後にGitHub Actions CIを監視し、失敗時は自動修正を試みる。einja-task-commit、einja-create-prから参照される内部Skill。Do NOT use for: 直接呼び出し（参照元Skillから自動的に呼ばれる）"
---

# _einja-ci-check: CI確認・自動修正インナーSkill

## 役割

プッシュ/PR作成後にGitHub Actions CIの結果を監視し、失敗時は自動修正を試みる共通フロー。

## パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `prNumber` | いいえ | 自動検出 | PR番号。未指定時は現在ブランチから検出 |
| `maxRetries` | いいえ | 2 | 自動修正のリトライ上限 |
| `timeout` | いいえ | 300 | CI完了待機のタイムアウト（秒） |

## 処理フロー

### Phase 1: PR検出

```bash
# 現在ブランチのPR情報を取得
gh pr view --json number,url,headRefName 2>/dev/null
```

- `prNumber` パラメータ指定あり → そのPR番号を使用
- `prNumber` 未指定 → 上記コマンドで自動検出
- **PRなし or mainブランチ直プッシュ** → 以下を出力してスキップ終了:

```markdown
### CI確認: スキップ
PRが存在しないため、CI確認をスキップしました。
```

---

### Phase 2: CI待機

```bash
# CI完了を待機（タイムアウト付き）
timeout {timeout} gh pr checks {pr-number} --watch --fail-fast 2>/dev/null
```

**`--watch` が動作しない場合のフォールバック:**

TTY環境問題で `--watch` が失敗する場合、以下のポーリング方式にフォールバック:

```bash
# 最新プッシュのコミットSHAを取得
COMMIT_SHA=$(git rev-parse HEAD)

# 30秒間隔でポーリング（コミットSHAでフィルタ）
gh run list --branch {branch} --commit ${COMMIT_SHA} --limit 1 --json databaseId,status,conclusion
```

- `status: in_progress` / `status: queued` / `status: pending` → 30秒待機して再確認
- `status: completed` → Phase 3へ
- `status: cancelled` → キャンセル報告して終了
- タイムアウト到達 → タイムアウト報告して終了:

```markdown
### CI確認: タイムアウト

CI完了待機が{timeout}秒でタイムアウトしました。
手動で確認してください: {pr_url}
```

---

### Phase 3: 結果判定

```bash
# CI結果を確認
gh pr checks {pr-number} --json name,state,description
```

- **全チェック success** → 成功報告して終了:

```markdown
### CI確認: ✅ 成功

すべてのCIチェックが通過しました。
```

- **failure あり** → Phase 4へ

---

### Phase 4: 失敗時の自動修正フロー

#### 4.1 失敗ログの取得

```bash
# 最新プッシュのコミットSHAでフィルタして失敗ランを取得
COMMIT_SHA=$(git rev-parse HEAD)
gh run list --branch {branch} --commit ${COMMIT_SHA} --limit 1 --status failure --json databaseId

# 失敗ログを取得
gh run view {run_id} --log-failed
```

#### 4.2 エラーカテゴリ判定と自動修正

| エラーカテゴリ | パターン | 自動修正 | 対処 |
|--------------|---------|---------|------|
| lint/format | ESLint, Biome エラー | 可 | `pnpm lint --fix` / `pnpm format` |
| TypeScript型エラー | `TS\d{4}:` | 可 | サブエージェントに委託 |
| テスト失敗 | `FAIL`, `AssertionError` | 可 | サブエージェントに委託 |
| ビルドエラー | `Build failed`, `Module not found` | 可 | サブエージェントに委託 |
| 環境・権限エラー | `NEON_API_KEY`, `NPM_TOKEN`, `secrets.` | 不可 | ユーザーに報告して終了 |
| 依存解決エラー | `ERR_PNPM_`, `Could not resolve` | 可 | `pnpm install` 後サブエージェント委託 |
| 未分類エラー | 上記いずれにも該当しない | 不可 | ユーザーに報告して終了 |

#### 4.3 自動修正可能な場合

1. エラー内容に応じて修正を実行（lint → `pnpm lint --fix`、型/テスト/ビルド → サブエージェント委託）
2. **直接** `git add/commit/push` で修正をプッシュ（`einja-task-commit` の再帰呼び出しは**禁止**）
3. コミットメッセージ: `fix: CI修正 - {エラー概要}`

```bash
git add {修正ファイル}
pnpm prepush
git commit -m "$(cat <<'EOF'
fix: CI修正 - {エラー概要}
EOF
)"
git push
```

4. Phase 2に戻ってCI再確認（最大 `maxRetries` 回）

#### 4.4 自動修正不可 or リトライ上限到達

```markdown
### CI確認: ❌ 失敗

**エラーカテゴリ**: {カテゴリ}
**リトライ回数**: {current}/{maxRetries}

\`\`\`
{失敗ログ抜粋}
\`\`\`

{自動修正不可の場合: 環境・権限エラーのため手動対応が必要です。}
{リトライ上限の場合: 自動修正を{maxRetries}回試行しましたが解消できませんでした。手動で確認してください。}

PR: {pr_url}
```

---

## 注意事項

- **再帰呼び出し防止**: CI修正コミットは必ず直接 `git add/commit/push` を使う。`einja-task-commit` を再呼び出ししない
- **prepush実行**: CI修正コミット前に `pnpm prepush` を実行し、ローカルで品質チェックを通してからプッシュする
- **修正ファイルの明示**: `git add` は修正したファイルのみ指定する（`git add .` 禁止）
- **サブエージェントへのgit安全ルール**: 型エラー・テスト・ビルド修正をサブエージェントに委託する場合、CLAUDE.mdの「サブエージェントのgit操作安全ルール」を遵守させること
- **コミットSHAフィルタ**: フォールバックポーリング・失敗ラン取得時は必ず `--commit` オプションで最新プッシュのSHAを指定し、過去ランの誤検出を防ぐ

---

**最終更新**: 2026-03-13
