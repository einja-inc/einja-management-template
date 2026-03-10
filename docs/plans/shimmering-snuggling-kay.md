# NPMパッケージのプライベート化・GitHub Packages移行

## Context

`@einja/dev-cli` と `create-einja-app` の2パッケージが npmjs.com にパブリック公開されている。社内メンバー限定にするため、GitHub Packages（npm.pkg.github.com）にプライベート移行する。GitHub Packages はスコープが org 名と一致する必要があるため、`@einja` → `@einja-inc` へのスコープ変更も同時に行う。

### 変更サマリ

| 項目 | Before | After |
|------|--------|-------|
| CLI パッケージ名 | `@einja/dev-cli` | `@einja-inc/dev-cli` |
| create パッケージ名 | `create-einja-app` | `@einja-inc/create-app` |
| ディレクトリ | `packages/create-einja-app/` | `packages/create-app/` |
| レジストリ | `registry.npmjs.org` | `npm.pkg.github.com` |
| アクセス | public | restricted |
| ライセンス | MIT | UNLICENSED |
| タグプレフィックス | `cli-v*` / `create-einja-app-v*` | `cli-v*` / `create-app-v*` |
| CI認証 | `secrets.NPM_TOKEN` | `secrets.GITHUB_TOKEN` |
| 利用コマンド | `npx create-einja-app` | `npx @einja-inc/create-app` or `npm create @einja-inc/app` |

---

## TODO

### Phase 0: 前提確認

- [ ] GitHub org (`einja-inc`) で GitHub Packages が有効であることを確認
- [ ] リポジトリの Actions settings で `packages: write` 権限が付与可能か確認
- [ ] `cli-v*` タグプレフィックスは変更せず維持する方針を確認済み

### Phase 1: ディレクトリリネーム・パッケージ設定変更

> Phase 1-5 は1つのPR内でまとめて実施。コミットは Phase ごとに分割する。

#### 1-1. ディレクトリリネーム
- `packages/create-einja-app/` → `packages/create-app/`
- `pnpm-workspace.yaml` は `packages/*` グロブのため変更不要
- `turbo.json` にパッケージ名直接参照なし（変更不要）

#### 1-2. package.json 変更

**packages/cli/package.json:**
```diff
- "name": "@einja/dev-cli",
+ "name": "@einja-inc/dev-cli",
  "publishConfig": {
-   "access": "public"
+   "access": "restricted",
+   "registry": "https://npm.pkg.github.com"
  },
- "license": "MIT"
+ "license": "UNLICENSED"
```

**packages/create-app/package.json:**
```diff
- "name": "create-einja-app",
+ "name": "@einja-inc/create-app",
  "bin": {
-   "create-einja-app": "./dist/cli.js"
+   "create-einja-app": "./dist/cli.js"
  },
  "publishConfig": {
-   "access": "public"
+   "access": "restricted",
+   "registry": "https://npm.pkg.github.com"
  },
  "repository": {
-   "directory": "packages/create-einja-app"
+   "directory": "packages/create-app"
  },
- "license": "MIT"
+ "license": "UNLICENSED"
```

> **bin名 `create-einja-app` は維持**: `create-app` は汎用すぎてグローバルインストール時に他パッケージと衝突するリスクがある。スコープ付きパッケージでは bin名は npx 実行に影響しない（`npx @einja-inc/create-app` で呼ばれる）。

#### 1-3. .npmrc 作成（ルート・新規）
```ini
@einja-inc:registry=https://npm.pkg.github.com
```

#### 1-4. .changeset/config.json
```diff
- "ignore": ["@einja/dev-cli", "create-einja-app"]
+ "ignore": ["@einja-inc/dev-cli", "@einja-inc/create-app"]
```

#### 1-5. pnpm install 実行
- `pnpm install` で lockfile を再生成（Phase 2 以降のビルド検証に必要）

### Phase 2: ソースコード・テストの参照更新

> **重要**: `@einja/dev-cli` だけでなく `@einja/cli`（旧パッケージ名）のハードコード参照も存在する。3パターンの grep が必要:
> - `@einja/dev-cli` → `@einja-inc/dev-cli`
> - `@einja/cli` → `@einja-inc/dev-cli`（旧名の修正も兼ねる）
> - `create-einja-app` → `@einja-inc/create-app`

#### 2-1. create-app ソースコード
| ファイル | 変更内容 |
|---------|---------|
| `packages/create-app/src/cli.ts` | `.name("create-einja-app")` → `.name("create-app")` |
| `packages/create-app/src/commands/sync.ts` | L404, L417: `npx create-einja-app sync --rollback` → `npx @einja-inc/create-app sync --rollback` |
| `packages/create-app/src/generators/post-setup.ts` | `@einja/dev-cli@latest` → `@einja-inc/dev-cli@latest` |
| `packages/create-app/src/prompts/project.ts` | L63: `@einja/dev-cli を自動セットアップしますか？` → `@einja-inc/dev-cli` に更新 |
| `packages/create-app/.templateignore` | `packages/create-einja-app/` → `packages/create-app/` |

#### 2-2. cli ソースコード（個別ファイル明示）
| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/cli.ts` | L18-25: 旧パッケージ名警告を更新。`@einja/claude-cli` + `@einja/dev-cli` 両方を検出し `@einja-inc/dev-cli` への移行を案内 |
| `packages/cli/src/lib/preset-update/cli-repo-detector.ts` | L73: `@einja/cli` → `@einja-inc/dev-cli`（既存バグの修正を兼ねる） |
| `packages/cli/src/lib/sync/diff-engine.ts` | L52: `>>>>>>> TEMPLATE (from @einja/cli)` → `>>>>>>> TEMPLATE (from @einja-inc/dev-cli)` |
| `packages/cli/src/` 内その他 | `@einja/dev-cli` → `@einja-inc/dev-cli` の全参照（grep で網羅確認） |

#### 2-3. テストファイル
| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/lib/preset-update/cli-repo-detector.test.ts` | L91, L117, L141: `@einja/cli` → `@einja-inc/dev-cli` |
| `packages/cli/src/lib/sync/diff-engine.test.ts` | コンフリクトマーカー文字列 `@einja/cli` → `@einja-inc/dev-cli` |
| `packages/cli/src/lib/sync/integration.test.ts` | 同上 |
| `packages/cli/src/lib/sync/conflict-reporter.test.ts` | 同上 |
| `packages/cli/src/commands/sync.test.ts` | パッケージ名参照更新 |
| `packages/create-app/tests/` 配下 | コメント・文字列参照を更新 |

#### 2-4. ルート package.json のスクリプト
- `einja:sync` / `task:loop` 等のスクリプト内 `@einja/dev-cli@latest` → `@einja-inc/dev-cli@latest`

#### 2-5. テンプレートファイル（scaffold 生成物）

> **重要**: `packages/create-app/templates/default/` はscaffoldで新規プロジェクト生成時に使われる。presets（ビルド自動コピー）とは別管理で直接編集が必要。

| ファイル | 変更内容 |
|---------|---------|
| `packages/create-app/templates/default/package.json` | L48, L50: `@einja/dev-cli@latest` → `@einja-inc/dev-cli@latest` |
| `packages/create-app/templates/default/.changeset/config.json` | L10: ignore リスト更新 |
| `packages/create-app/templates/default/.github/workflows/release-create-einja-app.yml` | ファイル名含む全面更新（パッケージ名、レジストリ、認証） |
| `packages/create-app/templates/default/CLAUDE.md` | パッケージ名参照更新（ビルド自動生成の場合は不要だが要確認） |
| `packages/create-app/templates/default/AGENTS.md` | パッケージ名参照更新 |

### Phase 3: GitHub Actions ワークフロー変更

#### 3-1. release-cli.yml
```diff
  permissions:
    contents: read
-   id-token: write
+   packages: write

  - uses: actions/setup-node@...
    with:
-     registry-url: 'https://registry.npmjs.org'
+     registry-url: 'https://npm.pkg.github.com'
+     scope: '@einja-inc'

- - run: pnpm --filter @einja/dev-cli build
+ - run: pnpm --filter @einja-inc/dev-cli build
  # (test, typecheck, lint も同様)

    TAG_VERSION="${TAG_VERSION#cli-v}"  # タグプレフィックス維持

- - run: pnpm --filter @einja/dev-cli publish --no-git-checks --access public --provenance
+ - run: pnpm --filter @einja-inc/dev-cli publish --no-git-checks
    env:
-     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+     NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 3-2. release-create-einja-app.yml → release-create-app.yml（ファイル名変更）
```diff
- name: Release create-einja-app
+ name: Release create-app
  on:
    push:
      tags:
-       - 'create-einja-app-v*'
+       - 'create-app-v*'

  permissions:
    contents: read
-   id-token: write
+   packages: write

  - uses: actions/setup-node@...
    with:
-     registry-url: 'https://registry.npmjs.org'
+     registry-url: 'https://npm.pkg.github.com'
+     scope: '@einja-inc'

-   PKG_VERSION=$(node -p "require('./packages/create-einja-app/package.json').version")
+   PKG_VERSION=$(node -p "require('./packages/create-app/package.json').version")
-   TAG_VERSION="${TAG_VERSION#create-einja-app-v}"
+   TAG_VERSION="${TAG_VERSION#create-app-v}"

- - run: pnpm -F create-einja-app publish --no-git-checks --access public --provenance
+ - run: pnpm -F @einja-inc/create-app publish --no-git-checks
    env:
-     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+     NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 3-3. changeset-status.yml
- パッケージ名の直接参照なし → 変更不要

### Phase 4: ドキュメント・Skill・設定の更新

#### 4-1. README・ドキュメント
| ファイル | 変更内容 |
|---------|---------|
| `README.md`（ルート） | パッケージ名、npx コマンド例、バッジURL等を全面更新 |
| `packages/cli/README.md` | `@einja/dev-cli` → `@einja-inc/dev-cli`、コマンド例更新 |
| `packages/create-app/README.md` | パッケージ名、コマンド例を全面更新 |
| `packages/cli/RELEASING.md` | GitHub Packages 向けに書き換え |
| `packages/create-app/RELEASING.md` | 同上 |
| `packages/create-app/docs/BUILD.md` | パッケージ名・パス参照更新 |

#### 4-2. CLAUDE.md / AGENTS.md
- `create-einja-app` → `@einja-inc/create-app` の参照更新
- `@einja/dev-cli` → `@einja-inc/dev-cli` の参照更新

#### 4-3. .claude Skills・Rules
| ファイル | 変更内容 |
|---------|---------|
| `.claude/skills/npm-release/SKILL.md` | パッケージ定義テーブル全面書き換え（名前、パス、フィルタ、タグ、レジストリ） |
| `.claude/skills/cli-package-specs/SKILL.md` | パッケージ名・パス参照多数更新 |
| `.claude/skills/einja-sync/SKILL.md` | npx コマンド名・パッケージ名参照更新 + コンフリクトマーカー形式 `@einja/cli` → `@einja-inc/dev-cli` |
| `.claude/skills/einja-infra-maintenance/SKILL.md` | ワークフロー名参照更新 |
| `.claude/rules/cli-package-specs.md` | path-specific ルールのパスパターン更新 |

#### 4-4. docs/einja（このリポジトリが原本・編集可）
| ファイル | 変更内容 |
|---------|---------|
| `docs/einja/instructions/setup-flow.md` | コマンド例・フロー図のパッケージ名更新 |
| `docs/einja/steering/infrastructure/deployment.md` | ワークフロー名・タグプレフィックス更新 |
| `docs/einja/steering/README.md` | `@einja/dev-cli` 参照更新 |
| `docs/einja/steering/development/coding-standards.md` | `packages/create-einja-app` パス参照更新 |
| `docs/einja/cli/preset.yaml` | L127-128: `@einja/dev-cli@latest` → `@einja-inc/dev-cli@latest`（下流の einja init に直接影響） |

#### 4-5. スクリプト
| ファイル | 変更内容 |
|---------|---------|
| `scripts/_template-update.ts` | L226: `packages/create-einja-app` ハードコードパス → `packages/create-app` |
| `scripts/env-rotate-secrets.ts` | L300: コメント内 `create-einja-app` 参照更新 |
| `packages/cli/scripts/copy-presets.mjs` | L307: コメント内 `create-einja-app` 参照更新 |

#### 4-6. CLI 内部ドキュメント
| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/docs/PUBLISHING.md` | L7, L120: `@einja/cli` → `@einja-inc/dev-cli` |
| `packages/cli/docs/SYMLINK_ARCHITECTURE.md` | L44: `@einja/cli init` → `@einja-inc/dev-cli init` |

#### 4-7. その他の参照（コメントのみ）
| ファイル | 変更内容 |
|---------|---------|
| `packages/config/src/worktree-config.ts` | L5: コメント内 `create-einja-app` → `@einja-inc/create-app` |

### Phase 5: ビルド・テスト検証

```bash
# 1. ビルド（prebuild で copy-presets.mjs が走り presets/default/ も自動更新）
pnpm --filter @einja-inc/dev-cli build
pnpm --filter @einja-inc/create-app build

# 2. 全体テスト
pnpm prepush  # lint + typecheck + test

# 3. パッケージ内容確認
cd packages/cli && npm pack --dry-run
cd packages/create-app && npm pack --dry-run

# 4. 残存参照チェック（3パターン）
grep -r "@einja/dev-cli" --include="*.ts" --include="*.md" --include="*.yml" --include="*.json" --include="*.yaml" . \
  | grep -v node_modules | grep -v docs/plans/ | grep -v docs/specs/ | grep -v pnpm-lock.yaml
grep -r "@einja/cli" --include="*.ts" --include="*.md" --include="*.yml" --include="*.json" --include="*.yaml" . \
  | grep -v node_modules | grep -v docs/plans/ | grep -v docs/specs/ | grep -v pnpm-lock.yaml | grep -v "@einja/cli-"
grep -r "create-einja-app" --include="*.ts" --include="*.md" --include="*.yml" --include="*.json" --include="*.yaml" . \
  | grep -v node_modules | grep -v docs/plans/ | grep -v docs/specs/ | grep -v pnpm-lock.yaml

# 5. presets 内容の旧名残存チェック
grep -r "@einja/" packages/cli/presets/ | grep -v node_modules
grep -r "create-einja-app" packages/cli/presets/ | grep -v node_modules
```

### Phase 6: リリース・npmjs.com 後処理（PR マージ後）

#### 6-1. GitHub Packages へ初回 publish
```bash
git tag cli-v0.2.0  # バージョンアップ
git tag create-app-v0.4.0
git push origin --tags
# GitHub Actions が自動 publish
```

#### 6-2. 動作確認
```bash
npm info @einja-inc/dev-cli --registry=https://npm.pkg.github.com
npx @einja-inc/dev-cli --version
npm create @einja-inc/app -- my-test
```

#### 6-3. npmjs.com の旧パッケージ deprecate
```bash
npm deprecate "@einja/dev-cli" \
  "Moved to @einja-inc/dev-cli on GitHub Packages. See https://github.com/einja-inc/einja-management-template" \
  --registry=https://registry.npmjs.org

npm deprecate "create-einja-app" \
  "Moved to @einja-inc/create-app on GitHub Packages. See https://github.com/einja-inc/einja-management-template" \
  --registry=https://registry.npmjs.org
```

#### 6-4. npmjs.com パッケージ削除（deprecate から1-2週間後）
```bash
npm unpublish "@einja/dev-cli" --force --registry=https://registry.npmjs.org
npm unpublish "create-einja-app" --force --registry=https://registry.npmjs.org
```
> 72時間ルール / 300 DL/週超過の場合は unpublish 不可。その場合は deprecate のまま維持。

#### 6-5. GitHub Secrets 整理
- `NPM_TOKEN` シークレットを削除

---

## 利用者向け移行ガイド（社内メンバー配布用）

### 必要な設定

1. **GitHub PAT 作成**: Settings > Developer settings > Personal access tokens (classic) > `read:packages` スコープ
2. **環境変数設定**（`~/.zshrc` 等）:
   ```bash
   export GITHUB_PACKAGES_TOKEN=ghp_xxxxxxxxxxxx
   ```
3. **プロジェクト .npmrc に追加**:
   ```ini
   @einja-inc:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
   ```
4. **コマンド変更**:
   - `npx create-einja-app` → `npx @einja-inc/create-app` or `npm create @einja-inc/app`
   - `npx @einja/dev-cli` → `npx @einja-inc/dev-cli`

### 既存プロジェクトの移行

既存プロジェクト（create-einja-app で生成済み）は以下の手動更新が必要:
1. `.npmrc` に `@einja-inc:registry` 設定を追加
2. `package.json` の scripts 内 `@einja/dev-cli@latest` → `@einja-inc/dev-cli@latest`
3. `npx create-einja-app sync` → `npx @einja-inc/create-app sync`

> 将来的に `einja sync` で自動マイグレーションを提供することも検討。

---

## 注意事項

- GitHub Packages は npm provenance（`--provenance`）非対応 → フラグ削除必須
- `GITHUB_TOKEN` は同一リポジトリの Actions で自動提供（PAT不要）
- 利用者側は `.npmrc` + GitHub PAT（`read:packages`）が必要
- `docs/plans/`、`docs/specs/` 内の旧パッケージ名参照は履歴として変更不要
- presets 配下は直接編集禁止（ビルド時に原本から自動コピー）
- bin名 `create-einja-app` は汎用名衝突回避のため維持
- `@einja/cli`（dev-cli でない旧名）がソースコード内にハードコードされている箇所あり → 移行と同時に修正

## ロールバック

- **リリース前**: git revert で全変更を巻き戻し。npmjs.com の既存パッケージは無影響
- **deprecate 後**: `npm deprecate "@einja/dev-cli@*" ""` で deprecate 解除可能
