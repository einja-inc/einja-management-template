# NPMリリース後の反映遅延修正

## Context

NPMリリース後、利用者が`npx create-einja-app`や`npx @einja/dev-cli`を実行しても古いバージョンが使われ続ける問題。根本原因は**npxのキャッシュ仕様**（npm 7以降、`@latest`未指定だとキャッシュ内の古いバージョンを無期限に使い続ける）。

## 修正箇所

### 1. npx呼び出しに`@latest`追加 + エラーメッセージ更新

**`packages/create-einja-app/src/generators/post-setup.ts`**

| 行 | Before | After |
|----|--------|-------|
| 119 | `execa("npx", ["@einja/dev-cli", ...])` | `execa("npx", ["--yes", "@einja/dev-cli@latest", ...])` |
| 123 | `'npx @einja/dev-cli init'` | `'npx --yes @einja/dev-cli@latest init'` |

**`package.json`（ルート・scriptsセクション）**

| キー | Before | After |
|------|--------|-------|
| `einja:sync` | `npx --yes @einja/dev-cli sync` | `npx --yes @einja/dev-cli@latest sync` |
| `task:loop` | `npx @einja/dev-cli task:loop` | `npx --yes @einja/dev-cli@latest task:loop` |

### 2. テスト期待値の更新

**`packages/create-einja-app/tests/unit/generators/post-setup.test.ts`（134行目）**
- `["@einja/dev-cli", ...]` → `["--yes", "@einja/dev-cli@latest", ...]` に更新

**`packages/create-einja-app/tests/integration/create.test.ts`（21行目）**
- `args?.[0] === "@einja/dev-cli"` → `args?.[1] === "@einja/dev-cli@latest"` に更新（`--yes`が先頭に入るため）

### 3. release-cli.ymlにtest/typecheck/lint追加

**`.github/workflows/release-cli.yml`** - Buildステップ後に追加:
```yaml
- name: Run tests
  run: pnpm --filter @einja/dev-cli test

- name: Type check
  run: pnpm --filter @einja/dev-cli typecheck

- name: Lint
  run: pnpm --filter @einja/dev-cli lint
```
参考: `.github/workflows/release-create-einja-app.yml` に同等のステップあり

### 4. パッケージ名の誤記修正

**`packages/cli/RELEASING.md`（50, 53行目）**
- `@einja/cli` → `@einja/dev-cli`

**`.claude/skills/einja-npm-release/SKILL.md`（25, 28, 137, 232行目）**
- `@einja/cli` → `@einja/dev-cli` に統一

### 5. フォローアップ（別リポジトリ）

**`docs/einja/cli/preset.yaml`（127-128行目）** - 管理対象ディレクトリ（読み取り専用）
- `npx @einja/dev-cli sync` → `npx --yes @einja/dev-cli@latest sync` 等
- **CLIソース側（eenchowリポジトリ）で修正し、`einja sync`で反映する必要あり**
- 本PR完了後にCLI側Issueとして起票

## Skill-first評価

- npxコマンドの引数修正 + CI設定追加 + 誤記修正という**1回限りの修正**
- 再現パターンではないためSkill化不要

## 検証方法

1. `pnpm prepush` でlint/typecheck/testが通ることを確認
2. `grep -r "@einja/dev-cli@latest" packages/create-einja-app/src/` で`@latest`が含まれることを確認
3. `grep "@einja/cli[^/]" .claude/skills/einja-npm-release/SKILL.md packages/cli/RELEASING.md` で旧名が残っていないことを確認
4. `release-cli.yml` にtest/typecheck/lintステップが存在することを確認
5. `git diff --stat` で意図しない変更がないことを確認
