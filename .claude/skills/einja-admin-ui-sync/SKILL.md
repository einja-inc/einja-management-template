---
name: einja-admin-ui-sync
description: "Syncs `packages/admin-ui` from the template repository to the current child project, with safety checks (template-repo detection, git status check, dry-run preview, conflict summary, backup). Use when admin-ui drift is suspected, when picking up upstream component updates, or when triggered by phrases like \"admin-ui を sync\", \"admin-ui 同期\", \"shadcn コンポーネント同期\". Do NOT use for: docs/einja sync (use `npx @einja-inc/dev-cli sync`), full template sync (use `npx @einja-inc/create-app sync` interactive), apps/* sync (use `npx @einja-inc/create-app sync --categories apps`)."
user-invocable: true
allowed-tools: Bash, AskUserQuestion, Read
---

<!-- 参考: packages/create-app の `sync --categories packages --packages-detail admin-ui --yes` 非対話モード（@einja-inc/create-app） -->
<!-- ベース: .claude/skills/einja-task-commit/SKILL.md, .claude/skills/einja-conflict-resolver/SKILL.md -->

# einja-admin-ui-sync Skill: admin-ui 同期エンジン

## 役割

子プロジェクトの `packages/admin-ui` を、テンプレート（`@einja-inc/create-app`）の最新内容へ非対話で sync します。安全装置として、テンプレ repo 自己実行ブロック、git status チェック、dry-run プレビュー、初回判定、結果サマリを実装します。

## Sandbox 注意事項

**すべての `git` / `npx` コマンドは `dangerouslyDisableSandbox: true` で実行すること。**
sandbox 環境では npm cache 書き込みや git index 更新がブロックされるため、Bash tool 呼び出し時に必ずこのフラグを設定する。

## 前提

- 本 Skill は **`@einja-inc/create-app` v0.x（`sync --packages-detail` 対応版以降）が npm publish された後** にのみ有効。古いバージョンでは `--packages-detail` フラグ未対応で失敗する
- 失敗時は `EINJA_CREATE_APP_VERSION=@latest` で再試行、または `npm view @einja-inc/create-app version` で対応バージョンを確認すること

---

## 実行手順（8 ステップ）

### Step 1: テンプレ repo 自己実行ブロック

子プロジェクト用 Skill のため、テンプレ repo（`einja-management-template`）内で実行されたらブロックする。

#### 検出ロジック

```bash
TEMPLATE_DETECTED=false

# 検出1: packages/create-app/ が存在
if [ -d packages/create-app ]; then
  TEMPLATE_DETECTED=true
  echo "DETECTED: packages/create-app/ exists"
fi

# 検出2: package.json の name が einja-management-template
# jq があれば優先、無ければ node にフォールバック（jq 未導入環境でも動作させる）
if command -v jq &>/dev/null; then
  PKG_NAME=$(cat package.json 2>/dev/null | jq -r .name 2>/dev/null)
else
  PKG_NAME=$(node -e "try { console.log(require(process.cwd() + '/package.json').name || '') } catch { console.log('') }" 2>/dev/null)
fi

if [ "$PKG_NAME" = "einja-management-template" ]; then
  TEMPLATE_DETECTED=true
  echo "DETECTED: package.json name == einja-management-template"
fi

echo "TEMPLATE_DETECTED=$TEMPLATE_DETECTED"
```

#### ブロック時の AskUserQuestion

`TEMPLATE_DETECTED=true` の場合、以下を提示してデフォルト中断:

```yaml
AskUserQuestion:
  question: |
    テンプレートリポジトリ自体で admin-ui sync を実行しようとしています。
    本 Skill は子プロジェクトでの sync 用です。原本（packages/admin-ui）を sync 経由で上書きすると差分管理が破綻する恐れがあります。

    検出された理由:
    - {検出条件1 / 検出条件2}
  header: "テンプレ repo 検出"
  options:
    - label: "中断する（推奨）"
      description: "Skill を終了する。Note: テンプレ repo では packages/admin-ui を直接編集すること。sync は子プロジェクト側で行う"
    - label: "強制続行（非推奨）"
      description: "検出を無視して以降のステップに進む。Note: 原本ファイルが上書きされる可能性あり。バックアップを取って自己責任で実行"
    - label: "その他（自由入力）"
      description: "上記以外の対応を伝える"
```

「中断」を選択 → 即座に終了。「強制続行」を選択 → Step 2 へ進む。

---

### Step 2: git status クリーン確認

未コミット変更があると sync 結果が混ざってレビュー困難になるため確認する。

```bash
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" -gt 0 ]; then
  echo "DIRTY=$DIRTY files"
  git status --short
fi
```

`DIRTY > 0` の場合、以下を提示してデフォルト中断:

```yaml
AskUserQuestion:
  question: |
    作業ツリーに未コミット変更が {DIRTY} 件あります。
    sync 実行で差分が混ざるとレビューが困難になります。

    {git status --short 出力}
  header: "git status dirty"
  options:
    - label: "中断する（推奨）"
      description: "Skill を終了し、先に既存変更をコミット or stash する。Note: 一番安全だが手動操作が必要"
    - label: "stash して続行"
      description: "git stash で退避してから sync を実行し、終了後に手動で stash pop する。Note: stash pop 時にコンフリクトする可能性あり"
    - label: "dirty のまま続行（非推奨）"
      description: "未コミット変更を残したまま sync を実行する。Note: 差分が混ざるためレビュー負荷が高い"
    - label: "その他（自由入力）"
      description: "上記以外の対応を伝える"
```

「stash して続行」を選んだ場合は `git stash push -m "pre-admin-ui-sync"` を実行し、Step 8 完了時に「stash pop してください」と案内する（自動 pop はコンフリクト時の中断ロジックが煩雑になるため、敢えて手動）。

---

### Step 3: 初回判定（`.einja-sync.json` 存在チェック）

merge 戦略を切り替えるため、3-way merge の base メタが存在するかを判定する。

```bash
if [ -f .einja-sync.json ]; then
  SYNC_MODE="existing"
  echo "SYNC_MODE=existing (.einja-sync.json found)"
else
  SYNC_MODE="initial"
  echo "SYNC_MODE=initial (first-time sync)"
fi
```

- `SYNC_MODE=initial` → 初回経路（Step 7a）
- `SYNC_MODE=existing` → 既存メタ経路（Step 7b）

内部状態として保持する（後続ステップで参照）。

---

### Step 4: `@einja-inc/create-app` バージョン解決

環境変数 `EINJA_CREATE_APP_VERSION` でバージョン固定 / ローカルビルド指定が可能。未設定なら `latest`。

**セキュリティ**: 環境変数は直接シェル展開されるため、コマンドインジェクションを防ぐ目的で `latest` または semver のみを許可する。

```bash
VERSION="${EINJA_CREATE_APP_VERSION:-latest}"

# semver または 'latest' のみ許可（コマンドインジェクション防止）
if ! [[ "$VERSION" =~ ^(latest|[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?)$ ]]; then
  echo "Invalid EINJA_CREATE_APP_VERSION: $VERSION" >&2
  echo "  Allowed: 'latest' or semver (e.g. '1.2.3', '1.2.3-beta.1')" >&2
  exit 1
fi

CREATE_APP_PKG="@einja-inc/create-app@${VERSION}"
echo "Using: $CREATE_APP_PKG"
```

#### 利用例

| 環境変数値 | 解決後 | 用途 |
|----------|--------|------|
| 未設定 | `@einja-inc/create-app@latest` | 通常運用 |
| `0.3.31` | `@einja-inc/create-app@0.3.31` | バージョン固定 |
| `latest` | `@einja-inc/create-app@latest` | 明示的に最新 |
| `1.2.3-beta.1` | `@einja-inc/create-app@1.2.3-beta.1` | プレリリース指定 |
| `file:./packages/create-app` | エラー（許可されない） | ローカルテストは `npm link` を使うこと |

ローカルパッケージで動かしたい場合は、本 Skill 経由ではなく事前にユーザーが `npm link` した上で `npx create-app sync ...` 形式を直接利用する（本 Skill では未自動化）。

---

### Step 5: dry-run 実行

実際の書き込み前に変更プレビューを取得する。

```bash
DRY_RUN_OUTPUT=$(npx -y "$CREATE_APP_PKG" sync \
  --categories packages \
  --packages-detail admin-ui \
  --dry-run \
  --yes 2>&1)

echo "$DRY_RUN_OUTPUT"
```

- `-y` は npx 側の install 確認をスキップ（パッケージ自体の `--yes` と別物）
- `--yes` は create-app の非対話モード
- 出力は丸ごとキャプチャしてユーザーに表示

失敗時（exit code != 0）:
- `--packages-detail` 未対応バージョンの可能性 → 「`EINJA_CREATE_APP_VERSION` を `latest` 等で再指定してください」と案内
- ネットワーク失敗 → `npm view @einja-inc/create-app version` で疎通確認を案内

---

### Step 6: 差分サマリ提示

dry-run 出力から「同期対象: N 個のファイル」「同期プレビュー: ...」を抽出して整形提示する。

```bash
# 例: 同期対象ファイル数の抽出（出力フォーマットは create-app 側に依存）
FILE_COUNT=$(echo "$DRY_RUN_OUTPUT" | grep -oE "同期対象: [0-9]+ 個" | grep -oE "[0-9]+" | head -1)
echo "FILE_COUNT=$FILE_COUNT"
```

抽出失敗時は dry-run 出力をそのまま表示する。

#### AskUserQuestion

```yaml
AskUserQuestion:
  question: |
    dry-run 結果:
    - 同期モード: {SYNC_MODE}（initial = 初回 / existing = 既存メタあり）
    - 対象ファイル数: {FILE_COUNT}
    - 使用パッケージ: {CREATE_APP_PKG}

    {dry-run 出力の主要部分}

    本 sync を実行しますか?
  header: "sync 実行可否"
  options:
    - label: "実行する（推奨）"
      description: "上記差分でファイルを書き込む。Note: dry-run で安全性確認済みのため、続行が一般的。バックアップは create-app 側で自動取得される（既定 ON）"
    - label: "dry-run のみで終了"
      description: "今回は実行せず Skill 終了。Note: 差分内容を別途確認したい場合に有用"
    - label: "取消"
      description: "Skill を中断する。Note: 中断後は git status / stash 復元等は自動では行わない"
    - label: "その他（自由入力）"
      description: "上記以外の対応を伝える"
```

「実行する」 → Step 7。「dry-run のみ」「取消」 → 終了（Step 2 で stash した場合は復元案内）。

---

### Step 7: 本 sync 実行（2 系統）

`SYNC_MODE` で分岐する。

#### 7a: 初回経路（`SYNC_MODE=initial`）

3-way merge の base スナップショットがなく、ローカル改変があれば conflict marker（`<<<<<<<` `=======` `>>>>>>>`）として残る可能性がある旨を予告する。

```yaml
AskUserQuestion:
  question: |
    初回 sync です（.einja-sync.json なし）。

    3-way merge の base スナップショットが存在しないため、`packages/admin-ui` 配下にローカル改変があった場合、
    変更が conflict marker としてファイル内に残る可能性があります。
    backup は既定 ON のため、create-app 側のバックアップディレクトリに元ファイルが保存されます。

    続行しますか?
  header: "初回 sync 予告"
  options:
    - label: "続行する（推奨）"
      description: "初回 sync を実行。Note: 初回 sync は backup ON で安全。conflict marker が残ったら Step 8 で報告する"
    - label: "中断"
      description: "Skill を終了する。Note: 既存改変を保護したい場合"
    - label: "その他（自由入力）"
      description: "上記以外の対応を伝える"
```

「続行する」を選んだら本実行へ:

```bash
SYNC_OUTPUT=$(npx -y "$CREATE_APP_PKG" sync \
  --categories packages \
  --packages-detail admin-ui \
  --yes 2>&1)

SYNC_EXIT=$?
echo "$SYNC_OUTPUT"
echo "EXIT=$SYNC_EXIT"
```

#### 7b: 既存メタあり経路（`SYNC_MODE=existing`）

通常の 3-way merge で同一コマンドを実行する（予告 AskUserQuestion 不要、Step 6 で承認済み）:

```bash
SYNC_OUTPUT=$(npx -y "$CREATE_APP_PKG" sync \
  --categories packages \
  --packages-detail admin-ui \
  --yes 2>&1)

SYNC_EXIT=$?
echo "$SYNC_OUTPUT"
echo "EXIT=$SYNC_EXIT"
```

---

### Step 8: 結果報告

sync 出力から成功数 / コンフリクト数 / backup パスを抽出し、整形して報告する。

```bash
# 抽出例（出力フォーマットは create-app 側に依存）
SUCCESS_N=$(echo "$SYNC_OUTPUT" | grep -oE "成功: [0-9]+" | grep -oE "[0-9]+" | head -1)
CONFLICT_N=$(echo "$SYNC_OUTPUT" | grep -oE "コンフリクト: [0-9]+" | grep -oE "[0-9]+" | head -1)
BACKUP_PATH=$(echo "$SYNC_OUTPUT" | grep -oE "backup: \S+" | head -1)

# conflict marker が残っているファイルを検出
CONFLICT_FILES=$(grep -l '<<<<<<<' -r packages/admin-ui 2>/dev/null || true)
```

#### 成功時の出力

```markdown
## admin-ui sync 完了

### サマリ
- **モード**: {SYNC_MODE}
- **使用パッケージ**: {CREATE_APP_PKG}
- **成功**: {SUCCESS_N} ファイル
- **コンフリクト**: {CONFLICT_N} ファイル
- **バックアップ**: {BACKUP_PATH}

### 次のステップ
- `git status` / `git diff packages/admin-ui` で結果確認
- 問題なければコミット（einja-task-commit Skill 利用可）
```

#### コンフリクト検出時の AskUserQuestion

`CONFLICT_FILES` が空でない場合:

```yaml
AskUserQuestion:
  question: |
    sync 完了後、以下のファイルに conflict marker が残っています。
    マニュアルレビューが必要です。

    {CONFLICT_FILES}
  header: "conflict marker 残存"
  options:
    - label: "einja-conflict-resolver Skill を呼び出す（推奨）"
      description: "コンフリクト解消 Skill にバトンタッチして 1 ファイルずつ解消する。Note: 対話的にコンフリクト解消するのが堅実。各ファイルで AskUserQuestion されるため対話的"
    - label: "自分で手動修正する（Skill 終了）"
      description: "コミット保留のまま Skill 終了。ユーザーが直接 editor で解消する。Note: einja-task-commit は conflict 残存中は呼ばないこと"
    - label: "バックアップから復元してやり直す"
      description: "{BACKUP_PATH} から元ファイルをコピーして sync を取り消し。Note: 今回の sync 結果はすべて破棄される"
    - label: "その他（自由入力）"
      description: "上記以外の対応を伝える"
```

#### 失敗時の出力

```markdown
## admin-ui sync 失敗

### ステータス: FAILURE (exit={SYNC_EXIT})

\`\`\`
{SYNC_OUTPUT の末尾}
\`\`\`

### 推奨対応
- `--packages-detail` 未対応バージョン → `EINJA_CREATE_APP_VERSION=latest` で再実行
- ネットワーク失敗 → `npm view @einja-inc/create-app version` で疎通確認
- detectProjectConfig 失敗 → package.json の name フィールド設定を確認
```

Step 2 で stash した場合は「`git stash pop` で復元してください」と案内する。

---

## トリガーキーワード一覧

description の Use when... と一致させた呼び出しキーワード:

- `admin-ui を sync`
- `admin-ui sync`
- `admin-ui 同期`
- `shadcn コンポーネント同期`
- `admin-ui upstream pull`
- `admin-ui 更新取込`

ネガティブトリガー（Do NOT use for）:

- `docs/einja` の同期 → `npx @einja-inc/dev-cli sync`
- テンプレ全体同期 → `npx @einja-inc/create-app sync`（対話）
- `apps/*` の同期 → `npx @einja-inc/create-app sync --categories apps`

---

## トラブルシューティング

| 症状 | 原因候補 | 対応 |
|------|----------|------|
| `--packages-detail` で「unknown option」 | npm cache 上の古いバージョンを引いた | `npx -y @einja-inc/create-app@latest --version` で確認後、`EINJA_CREATE_APP_VERSION=latest` 再実行 |
| `detectProjectConfig` 失敗 | `package.json` の `name` フィールド未設定 / 壊れた JSON | package.json の name を有効値にして再実行 |
| conflict marker が大量に出る | 初回 sync で `packages/admin-ui` のローカル改変が多い | 改変が意図的なら手動 merge、不要なら backup から復元して overwrite 戦略を将来検討（現状未実装） |
| npx が古い tarball をキャッシュから引く | npm cache | `npm cache clean --force` 後に再実行（最終手段） |
| `git status` が dirty のまま終了 | sync 自体が成功して新規ファイルが増えた状態 | `git add packages/admin-ui` で取り込み、einja-task-commit Skill でコミット |
| `Invalid EINJA_CREATE_APP_VERSION` エラー | 環境変数が semver / `latest` 以外の値 | `latest` または `1.2.3` 形式に修正して再実行 |

---

## PENDING_QUESTIONS プロトコル

不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照して PENDING_QUESTIONS 形式で質問を返却し、作業を停止すること。

該当ケース例:

- dry-run 出力の差分件数が異常に多い（例: 100 ファイル超）
- `EINJA_CREATE_APP_VERSION` 指定値が解決できない
- Step 7 で予期せぬ exit code（128 等）
- backup パスが取得できず復元手段が不明

---

## 参考資料

- `packages/create-app/src/commands/sync.ts` — sync コマンドの実装（`--packages-detail`、`--yes`、`--dry-run`）
- `.claude/skills/einja-conflict-resolver/SKILL.md` — コンフリクト解消の手順
- `.claude/skills/einja-task-commit/SKILL.md` — sync 完了後のコミット
- `.claude/skills/_einja-subagent-question-protocol/SKILL.md` — 不明時の質問プロトコル

<!-- @einja:project-private:start id="einja-admin-ui-sync-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
