# Volta → mise 移行 + sync パーミッション修正

## Context
Voltaが廃止され、Node.jsバージョン管理をmiseに移行する。併せて、既に実施済みの`sync.ts`のパーミッション修正（`fs.writeFile`後にテンプレートのmodeを復元）もこのコミットに含める。

## 現状
- `package.json`の`volta`セクションでNode.js/pnpmバージョンを管理
- `.claude/hooks/einja/unset-volta-recursion.sh`でVolta固有の環境変数問題を回避
- `scripts/init.sh`、`scripts/setup-dev.ts`でvoltaインストール・設定を実行
- `create-app`パッケージの型・ジェネレーターがvoltaを前提にした実装

## 変更内容

### Phase 1: コア設定変更
| 対象 | 変更 |
|------|------|
| `mise.toml`（新規） | `[tools]\nnode = "22.16.0"\npnpm = "10.14.0"` |
| `package.json` | `volta`セクション削除 |
| `.claude/hooks/einja/unset-volta-recursion.sh` | ファイル削除 |
| `.claude/settings.json` 行144-153 | PreToolUse `^Bash` hook削除 |

### Phase 2: セットアップスクリプト
| 対象 | 変更 |
|------|------|
| `scripts/init.sh` | volta install → `curl https://mise.run \| sh` + `mise trust` + `mise install`（この順序）。package.jsonからのgrepバージョン抽出は不要に（mise.tomlから自動読み取り） |
| `scripts/setup-dev.ts` | `setupVolta()` → `setupMise()`。rcファイルに `eval "$(mise activate zsh)"` 追加。`VOLTA_HOME`/`VOLTA_FEATURE_PNPM`は削除 |

### Phase 3: create-appパッケージ
| 対象 | 変更 |
|------|------|
| `packages/create-app/src/types/index.ts` | `volta: boolean` → `mise: boolean`。`SyncCategory`型のenvコメント（`.volta` → `mise.toml`）も更新 |
| `packages/create-app/src/utils/package-json.ts` | `volta?`型定義を削除 |
| `packages/create-app/src/prompts/project.ts` | `volta: true` → `mise: true` |
| `packages/create-app/src/prompts/sync.ts` | `.volta` → `mise.toml`（description + patterns両方） |
| `packages/create-app/src/commands/create.ts` | `volta: true` → `mise: true` |
| `packages/create-app/src/generators/post-setup.ts` | `~/.volta/bin` → `~/.local/share/mise/shims`。コメント「Volta/Node.js/pnpm」→「mise/Node.js/pnpm」更新 |
| `packages/create-app/src/generators/sync.ts` | `.volta` → `mise.toml` |

※ `template.ts`本体にはvolta参照なし（テストのみ）。変更不要を確認済み。

### Phase 4: CLIパッケージ
| 対象 | 変更 |
|------|------|
| `packages/cli/src/lib/sync/metadata-manager.ts` | ①デフォルトのproject-privateから`volta`削除（行192）。②`load()`にマイグレーションロジック追加（行37付近、既存の`seed→project-private`マイグレーションの直後）: `.einja-sync.json`の`jsonPaths["project-private"]["package.json"]`配列から`"volta"`を除去。これにより次回syncの3方向マージで下流`package.json`のvoltaセクションが自動削除される |
| `packages/cli/src/commands/sync.ts` | **既存修正（実装済み）**: writeFile後のchmod追加。新規コード変更なし、動作確認のみ |

マイグレーションロジック（metadata-manager.ts `load()`内、行37付近に追加）:
```typescript
// マイグレーション: project-private から volta を除去（Volta→mise移行）
if (data.jsonPaths?.["project-private"]?.["package.json"]) {
  const pkgFields = data.jsonPaths["project-private"]["package.json"];
  if (Array.isArray(pkgFields)) {
    const idx = pkgFields.indexOf("volta");
    if (idx !== -1) {
      pkgFields.splice(idx, 1);
      // ハッシュ無効化で再sync強制（ハッシュが最新でも3方向マージを実行させる）
      if (data.files?.["package.json"]) {
        data.files["package.json"].hash = "";
      }
    }
  }
}
```

### Phase 5: テンプレートホワイトリスト
| 対象 | 変更 |
|------|------|
| `packages/create-app/scripts/template-update.ts` 行60-72 | `fileMappings`に`"mise.toml"`追加 |
| `packages/cli/scripts/copy-presets.mjs` 行92-135 | `fileMappings`に`mise.toml`のマッピング追加（`required: true`） |

### Phase 6: テスト
| 対象 | 変更 |
|------|------|
| `packages/create-app/tests/unit/prompts/project.test.ts` | `volta` → `mise` |
| `packages/create-app/tests/unit/generators/template.test.ts` | `volta: true/false` → `mise: true/false` |
| `packages/create-app/tests/unit/generators/post-setup.test.ts` | `volta: false` → `mise: false` |

### Phase 7: ドキュメント・Skill
| 対象 | 変更 |
|------|------|
| `.claude/skills/einja-infra-maintenance/references/category-1-local-setup.md` | `volta install` → `mise install` |
| `.claude/skills/cli-package-specs/SKILL.md` | volta参照をmiseに。envカテゴリ `.volta` → `mise.toml` |
| `docs/einja/instructions/setup-flow.md` | Volta → mise（mermaid図・表含む）。envカテゴリのパターン `.volta` → `mise.toml`。project-privateフィールドリストから`volta`削除 |
| `docs/einja/instructions/local-server-environment-and-worktree.md` | voltaコマンド → miseコマンド |
| `docs/einja/instructions/deployment-setup.md` | Volta行 → mise行 |
| `README.md` | Voltaトラブルシュート → mise移行手順に書き換え。既存ユーザー向けに旧Volta設定（`VOLTA_HOME`等）のrcファイルからの手動削除手順を追記 |
| `packages/create-app/README.md` | volta参照更新 |

## タスク概要

| ID | タスク | 使用Skill/サブエージェント | 依存 |
|----|--------|---------------------------|------|
| 0-1 | Planファイル配置 | - | - |
| 1-1 | Phase 1: コア設定変更 [general-purpose] | サブエージェント | - |
| 1-2 | Phase 2: セットアップスクリプト書き換え [general-purpose] | サブエージェント | 1-1 |
| 2-1 | Phase 3+5: create-app型・ジェネレーター・ホワイトリスト [general-purpose] | サブエージェント | 1-1 |
| 2-2 | Phase 4: CLIパッケージ（metadata-manager + sync.ts確認） [general-purpose] | サブエージェント | 1-1 |
| 3-1 | Phase 6: テスト更新 [general-purpose] | サブエージェント | 2-1 |
| 3-2 | Phase 7: ドキュメント・Skill更新 [general-purpose] | サブエージェント | 1-1（Phase 1-3の変更内容を参照） |
| 99-1 | 観点別並列コードレビュー [einja-review-code] | Skill | 全実装タスク |
| 99-2 | 動作確認: typecheck + test + build + volta残留grep [Bash] | - | 99-1 |
| 99-G | コミット承認ゲート [AskUserQuestion] | - | 99-2 |
| 99-3 | コミット・プッシュ [einja-task-commit] | Skill | 99-G |

## 並列実行計画

```
1-1（コア設定）
├── 1-2（セットアップスクリプト）
├── 2-1（create-app + ホワイトリスト）─→ 3-1（テスト）
├── 2-2（CLI）
└── 3-2（ドキュメント）
```

- **並列G1**: 1-1
- **並列G2**: 1-2, 2-1, 2-2, 3-2（1-1完了後、4タスク並列）
- **並列G3**: 3-1（2-1完了後）
- **検証**: 99系は順次実行

## リスク・不明点

| リスク | 対応 |
|--------|------|
| CI（GitHub Actions）への影響 | `.node-version`を残すため`actions/setup-node`は動作継続 |
| 既存の下流リポジトリがvolta設定を持っている | metadata-managerのマイグレーションで`.einja-sync.json`から`volta`をproject-private除去→次回syncの3方向マージでpackage.jsonのvoltaセクション自動削除。mise.tomlも同時配布 |
| miseのshimsパスがOS/インストール方法で異なる可能性 | `~/.local/share/mise/shims`はmacOS/Linux共通。Homebrew/curl両方で同パス |
| 既存ユーザーのrcファイルにVoltaのPATH設定が残る | README.mdに旧設定の手動削除手順（`VOLTA_HOME`, `VOLTA_FEATURE_PNPM`の行削除）を追記 |
| 既存下流の`.einja-sync.json`にvoltaエントリが残る | `load()`のマイグレーションロジックで自動除去。次回sync実行時に反映 |
| hookファイル（`unset-volta-recursion.sh`）が下流に残る | syncの孤児検出で警告表示。`einja sync --clean`で自動削除。README移行手順にも記載 |
| 下流でvoltaバージョンをカスタマイズしていた場合 | 3方向マージでconflictとして報告される（base≠local）。手動解決が必要だが正しい動作 |

## 検証・動作確認方法

1. `pnpm typecheck` - 型チェック通過
2. `pnpm test` - 全テスト通過
3. `cd packages/create-app && pnpm build` + `cd packages/cli && pnpm build` - ビルド通過
4. volta残留grep（除外: node_modules, .turbo, presets/default, templates/default, docs/plans, docs/specs, docs/qa-tests, .claude-mem, modifications）
