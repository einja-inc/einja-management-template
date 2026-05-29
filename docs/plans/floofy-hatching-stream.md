# admin-ui 同期の実用化（既存機構の検証 + Skill配布 + 最小CLI拡張）

## Context

`packages/admin-ui` はテンプレート（このリポジトリ）と子レポ（@einja-inc/create-app で生成）で共有されているが drift が発生している。調査の結果、同期機構は **既に存在** することが判明:

- テンプレ側 `packages/create-app/scripts/template-update.ts` (prebuild) が `packages/admin-ui/` を `templates/default/packages/admin-ui/` にコピーし npm 配布
- 子レポ側 `npx @einja-inc/create-app sync` に `packages` カテゴリ + `packagesDetail` で admin-ui 単独選択可、3-way merge / backup / rollback 完備
- ファイル: `packages/create-app/src/commands/sync.ts`, `packages/create-app/src/generators/sync.ts`

ユーザーの真の症状は「機構の不存在」ではなく **「機構の認知・利用不足」**。admin-ui の子レポ側改変は「ほぼ無い／不明」なので overwrite 寄りの sync で安全。

**目標**: (1) 機構の end-to-end 動作を実機検証して信頼を確立、(2) `.claude/skills/einja-admin-ui-sync` を配布して認知・着手障壁を下げる、(3) Skill から完全非対話 sync を可能にする最小 CLI 拡張。

---

## 現状

### 同期パイプライン（既存）

```
[テンプレ repo]                          [npm registry]                [子レポ]
packages/admin-ui/                                                      packages/admin-ui/
        ↓ template-update.ts (prebuild)                                      ↑ create-app sync
packages/create-app/templates/default/   →  @einja-inc/create-app    →
  packages/admin-ui/  (transform済み)        files: ["dist","templates"]
```

### sync.ts の制約（修正対象）

`packages/create-app/src/commands/sync.ts:177-184` で `options.categories` 指定時に `packagesDetail` を強制 undefined にしているため、**Skill から非対話で admin-ui だけ sync する手段が無い**:

```typescript
if (options.categories) {
  categories = options.categories as SyncCategory[];
  appsDetail = undefined;
  packagesDetail = undefined;  // ← これが問題
  conflictStrategy = "merge";
```

### 不確実なポイント

- `templates/default/packages/admin-ui/` が現在 HEAD では実体なし（prebuild 走行物・gitignore状況未確認）→ L1 検証で裏付け
- `template-update.ts` の `transformContent` が admin-ui 内の `@repo/*` import を `{{packageName}}/*` に変換するが、子レポ展開時の placeholder 復元が `detectProjectConfig` 経由で正しく動くか未検証

---

## 変更内容

### L1: 動作検証（コード変更なし）

実機検証を3段階で実施し、現状の壊れ方を計測。

| Step | コマンド/操作 | 期待結果 |
|------|-------------|--------|
| L1a | `pnpm --filter @einja-inc/create-app template:update --dry-run` を root から実行 | コピー予定ファイルに `packages/admin-ui/**` が含まれる |
| L1b | 実走後 `diff -r packages/admin-ui/ packages/create-app/templates/default/packages/admin-ui/` | 差は `@repo/*` → `{{packageName}}/*` 変換と `package.json` / `tsconfig.json` placeholder のみ |
| L1c | 一時 worktree or 既存子レポで `npx @einja-inc/create-app@latest sync --dry-run` を対話実行 → packages → admin-ui のみ選択 | dry-run リストに admin-ui ファイルが列挙される |

### L2: Skill 配布（メイン成果物）

新規 Skill: `.claude/skills/einja-admin-ui-sync/SKILL.md`

**Skill 仕様**:
- **name**: `einja-admin-ui-sync`
- **配置先**: `.claude/skills/einja-admin-ui-sync/`（`einja-` プレフィックスで `copy-presets.mjs` の動的スキャンに自動載る）
- **分類**: タスク型 / `user-invocable: true` / `context: fork` は付けない（AskUserQuestion と Bash 多用するため）
- **description**: 「Syncs `packages/admin-ui` from the template repository to the current child project, with safety checks (git status, dry-run preview, conflict summary). Use when admin-ui drift is suspected or when picking up upstream component updates. Do NOT use for: docs/einja sync (→ `npx @einja-inc/dev-cli sync`), full template sync (→ `npx @einja-inc/create-app sync` 対話モード).」
- **ワークフロー**:
  1. **テンプレ repo 検出 → ブロック**: 以下のいずれかに該当する場合はテンプレ repo とみなし、AskUserQuestionで強制続行の脱出口を提示しつつデフォルト中断:
     - `packages/create-app/` ディレクトリが存在
     - `package.json.name === "einja-management-template"`
     - （name はリネーム可能なので `packages/create-app/` の有無を主シグナルとする）
  2. **git status クリーン確認**: dirty なら警告して中断オプション
  3. **`.einja-sync.json` 存在チェック**（初回判定）
     - 存在しない → 初回 sync 経路（後述）
     - 存在する → 既存メタ経路（後述）
  4. **dry-run 実行**:
     - 既定: `npx @einja-inc/create-app@latest sync --categories packages --packages-detail admin-ui --dry-run --yes`
     - 環境変数 `EINJA_CREATE_APP_VERSION` が設定されていればそれを使用（検証用に `@local` や `file:.../packages/create-app` を渡せるようにする）
  5. **差分サマリ提示**: dry-run 出力を整形してユーザーに表示
  6. **承認**: AskUserQuestion で「実行 / dry-run のみで終了 / 取消」
  7. **本 sync**（2系統）:
     - **初回経路（.einja-sync.json 不在）**: backup ON のまま `--categories packages --packages-detail admin-ui --yes`（3-way merge の base 不在で全 conflict 化する可能性があるが、conflict は merge marker としてファイルに残り backup から復元可能。AskUserQuestion で「初回なので全上書き許容」を選んだ場合は将来の `--overwrite` モードを使うことを案内 / 当面は merge marker 確認を推奨）
     - **既存メタあり**: 通常 merge `--categories packages --packages-detail admin-ui --yes`
  8. **結果報告**: 成功数 / コンフリクト数 / backup パスを表示。コンフリクトあれば手動レビュー指示

### L3: 最小 CLI 拡張

**変更ファイル**: `packages/create-app/src/commands/sync.ts`

`sync.ts:177-184` の修正:

```typescript
if (options.categories) {
  categories = options.categories as SyncCategory[];
  appsDetail = options.appsDetail;        // 既存 CLI option がそのまま渡るように
  packagesDetail = options.packagesDetail; // ← undefined 強制をやめる
  conflictStrategy = "merge";
```

`SyncOptions` 型（`packages/create-app/src/types/index.ts`）に `appsDetail?: string[]` / `packagesDetail?: string[]` を追加。

`bin` 定義（`packages/create-app/src/cli.ts` 等）で `--apps-detail <list>` / `--packages-detail <list>` オプションを追加。カンマ区切りパース。

---

## タスク概要

### Phase 0: 事前準備

- **タスク0-0**: TaskCreate で実装タスクを一括登録 [TaskCreate]
- **タスク0-1**: Plan ファイルを `docs/plans/floofy-hatching-stream.md` に配置 [Bash]
- **タスク0-2**: worktree `admin-ui-sync-enable` を作成・セットアップ [`_einja-worktree-guide`]
- **タスク0-3**: Skill 雛形作成は L2 タスク内で実施するため不要（einja-skill-plan-guide ワークフローAは本Planで完結）

### Phase 1: L1 動作検証（並列可能、結果次第で後続調整）

- **タスク1-0**: `packages/create-app/scripts/template-update.ts` を Read し、`packages/admin-ui` がコピー対象に含まれる根拠（dirMappings の `{ src: "packages" }` エントリで `cli` と `create-app` のみ exclude → admin-ui は対象）を明示的に確認・ログ記録 [Read]
- **タスク1-1**: L1a `pnpm --filter @einja-inc/create-app template:update --dry-run` 実行 → ログ確認 [Bash]
- **タスク1-2**: L1b 実走 → 差分計測 → レポート出力 [Bash]
- **タスク1-3**: L1c 子レポ／一時worktreeでの dry-run 実機検証 → 挙動ログ取得 [Bash]
- **タスク1-4**: `create-app sync` の内部呼び出し元を grep し、`--categories` 経由以外の呼び出し（dev-cli からの内部呼び出し等）が無いことを確認（L3副作用範囲の事前計測）。コマンド: `grep -rn "syncCommand\|create-app.*sync\|categories" packages/create-app/src packages/cli/src --include="*.ts"` [Bash]

→ タスク1-0で template-update.ts が想定どおりでなければ template-update.ts 修正タスクをPhase 2に先行追加。タスク1-4で意図せぬ内部呼び出しが見つかった場合はタスク2-2の実装方針を「optional propagation」に変更。深刻なブロッカーが見つかったら計画見直し。

### Phase 2: L3 CLI 最小拡張（L2より先行）

- **タスク2-1**: `SyncOptions` 型に `appsDetail` / `packagesDetail` 追加 [backend-implementer]
- **タスク2-2**: `sync.ts:177-184` の `appsDetail = undefined` / `packagesDetail = undefined` を削除し options から引き継ぐ（タスク1-4の結果次第で `options.appsDetail ?? undefined` の optional propagation 形にする） [backend-implementer]
- **タスク2-3**: `cli.ts`（または commander 定義箇所）に `--apps-detail` / `--packages-detail` フラグ追加。カンマ区切り → `string[]` パース [backend-implementer]
- **タスク2-4**: 既存テスト `packages/create-app/src/commands/sync.test.ts` が壊れていないことを確認、新フラグの最小テスト追加 [backend-implementer]

### Phase 3: L2 Skill 作成

- **タスク3-1**: `.claude/skills/einja-admin-ui-sync/SKILL.md` を作成 [frontend-implementer or 直接編集]
  - frontmatter (name, description, user-invocable: true)
  - ワークフロー 7 ステップを記述
  - 「子レポ検出」「git check」「dry-run」「承認」「本sync」「報告」のフロー
  - references/ は本Skill不要（ロジック小）
- **タスク3-2**: テンプレ repo で Skill を実機トリガー → 子レポ／worktree で挙動確認 [Bash]

### Phase 4: 配布検証

- **タスク4-1**: `pnpm --filter @einja-inc/dev-cli build` 実行後、`ls -la packages/cli/presets/default/.claude/skills/einja-admin-ui-sync/SKILL.md` でファイルの実在を明示的に確認（単に build 成功だけでなくファイル所在まで） [Bash]
- **タスク4-2**: `.claude/rules/template-whitelist.md` 更新不要であることを確認（`einja-` プレフィックスは既に handled） [Read]

### Phase 5: 完了検証（99系）

- **タスク99-1**: 観点別並列コードレビュー [`einja-review-code`]
- **タスク99-2**: 動作確認（Skill end-to-end 実行 + L3 オプションの CLI 単体テスト） [Bash]
- **タスク99-G**: コミット承認ゲート [AskUserQuestion]
- **タスク99-3**: コミット・プッシュ [`einja-task-commit`]

---

## 並列実行計画

| グループ | タスク | 依存 |
|---------|--------|------|
| G0 (並列) | 1-0, 1-4 | なし（事前 Read / grep） |
| G1 (並列) | 1-1, 1-2, 1-3 | G0 完了後（前提確認後） |
| G2 (並列) | 2-1, 2-3 | G1 完了後（L1検証結果反映のため） |
| G3 | 2-2 | 2-1, 1-4 |
| G4 | 2-4 | 2-2, 2-3 |
| G5 | 3-1 | G2-G4 完了後（L3 オプション前提のため） |
| G6 | 3-2 | 3-1 + L3 のローカルビルド／linkが済んでいること |
| G7 (並列) | 4-1, 4-2 | 3-1 完了後 |
| G8 | 99系 | 全実装完了後、順次 |

**最大並列数**: G0 で 2 並列、G1 で 3 並列、G2 で 2 並列、G7 で 2 並列。

---

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| L1で `templates/default/packages/admin-ui/` の生成自体が壊れている | L3/L2が無意味化 | L1検証で発覚 → 計画見直し、template-update.ts の修正を別タスクとして追加 |
| 3-way merge の base 不在で初回 sync が全 conflict 化 | Skill UX劣化 | Skill 初回起動時に `.einja-sync.json` 存在チェック → 無ければ overwrite 戦略を AskUserQuestion で推奨 |
| 子レポ側で `@einja-inc/create-app@latest` を `npx` で取る = 最新版だが、`SyncMetadata` schema 後方互換切れ | sync 失敗 | L1c で旧 schema の子レポでも動くか確認 |
| `template-update.ts` の `transformContent` が admin-ui の `@repo/*` import 以外も変換してしまう副作用 | placeholder 残留 | L1b の diff で確認 |
| テンプレ repo 自身で Skill を誤実行 | 自己上書き危険 | Skill 冒頭で `package.json.name === "einja-management-template"` を弾く |
| `copy-presets.mjs` の prebuild が手動依存で、template-update も走らせないと npm publish 物が古い | drift の根源 | 別 Issue: npm-release Skill or CI で template:update --dry-run の差分0チェックを追加（本Plan外） |
| L3 CLI 変更による既存 `sync.test.ts` のテスト失敗 | リグレッション | タスク2-4 でテスト確認・追加 |
| **L3 のリリース順序制約**: L3 (`--packages-detail`) は npm publish するまで `@latest` には載らない。L2 Skill のワークフローは `@latest` を叩く設計なので、L3 publish 前に Skill を配布すると Skill が機能しない | Skill 機能不全 | (a) Skill のコマンドを `EINJA_CREATE_APP_VERSION` 環境変数で切替可能にし、検証中は `@local` や `file:.../packages/create-app` を使う、(b) MVP リリース順序を「L3 publish → L2 Skill 配布」と明示、(c) Skill 内に「対応版が公開されていない場合は対話モードへフォールバック」のガード追加を将来課題として記録 |
| `create-app sync` 呼び出し元の意図せぬ伝播（タスク1-4で発覚し得る） | 既存利用者の挙動変化 | タスク2-2 を `options.packagesDetail ?? undefined` の optional propagation で実装し、CLI option 経由以外の呼び出しでは従来挙動を維持 |

---

## 検証・動作確認方法

### L1 検証（実装着手前）

1. `pnpm --filter @einja-inc/create-app template:update --dry-run` のログに `packages/admin-ui/` が現れることを確認
2. 実走後 `diff -r packages/admin-ui/ packages/create-app/templates/default/packages/admin-ui/` で transform済み差分のみであることを確認
3. 一時worktreeまたは既存子レポで `npx @einja-inc/create-app@latest sync --dry-run` 対話実行 → admin-ui ファイルが列挙されること

### L3 CLI 単体テスト

```bash
# admin-ui のみ sync を非対話で要求
npx @einja-inc/create-app@local sync --categories packages --packages-detail admin-ui --dry-run --yes
# → admin-ui の差分のみ出力、他 packages は対象外
```

### L2 Skill end-to-end

1. テンプレ repo を `pnpm --filter @einja-inc/dev-cli build` でビルド → `presets/default/.claude/skills/einja-admin-ui-sync/` が生成されることを `ls` で確認
2. 一時 worktree で `npx @einja-inc/dev-cli@local init --force` を実行し Skill が配布されることを確認
3. Skill トリガー: 「admin-ui を sync して」「admin-ui 同期」等で Skill が起動することを確認
4. Skill ワークフロー完走: 子レポ検出 → git check → dry-run → 承認 → 本sync → 報告まで通る
5. テンプレ repo 自身で Skill 起動 → 拒否されることを確認

### 完了判定

- 99-1: `einja-review-code` で MAJOR 0件
- 99-2: L1〜L3すべての検証が pass
- prepush（`einja-task-commit` 内）通過
