# Plan Review: `/sync` コマンド

## ✅ 総合評価: **実装可能（重要な修正が必要）**

提案されたPlanは基本的に実行可能ですが、**カテゴリ重複問題**という重大な見落としがあります。

---

## 1. 実現可能性: ⚠️ 一部修正が必要

### 1.1 CLI検出ロジック: ✅ 問題なし

```bash
npx @einja/dev-cli --version 2>/dev/null
npx create-einja-app --version 2>/dev/null
```

この方法で両CLIの存在を確認できます。

### 1.2 dry-runの実行: ✅ オプション構文は正しい

| CLI | dry-run | yes | json | categories |
|-----|---------|-----|------|-----------|
| dev-cli | `-d, --dry-run` ✅ | `-y, --yes` ✅ | `-j, --json` ✅ | `-o, --only <categories>` ✅ |
| create-einja-app | `--dry-run` ✅ | なし ⚠️ | なし ⚠️ | `--categories <categories>` ✅ |

**注意**: create-einja-appには `--yes` オプションがないため、dry-run後の実行確認プロンプトは表示されない（`--categories`指定時は対話なしで即実行される）

### 1.3 カテゴリ指定時の対話プロンプトスキップ: ✅ 正しい

create-einja-appの実装（sync.ts:168-184行目）:

```typescript
if (options.categories) {
  // --categories指定時: 対話なし
  categories = options.categories as SyncCategory[];
  logger.info(`指定されたカテゴリ: ${categories.join(", ")}`);
}
```

**結論**: ✅ `--categories` 指定時は対話プロンプトがスキップされる（Planの想定どおり）

---

## 2. ユーザー体験: ✅ 概ね良好

### 2.1 フロー全体

```
CLI検出 → カテゴリ選択 → dry-run → 実行確認 → sync → コンフリクト解消 → 完了
```

このフローは直感的で使いやすい。

### 2.2 改善提案: カテゴリ選択UIの強化

**現状のPlan**:
> multiSelect=true で複数選択

**推奨する具体的なUI（2段階選択）**:

**第1段階: 簡易/詳細選択**

```yaml
AskUserQuestion:
  question: "同期方法を選択してください"
  header: "テンプレート同期"
  options:
    - label: "📦 推奨セット（両CLIのデフォルト）"
      description: "dev-cli全カテゴリ + create-einja-app推奨カテゴリ"
    - label: "⚙️ カスタム選択"
      description: "個別にカテゴリを選択する"
```

**第2段階（カスタム選択時のみ）**:

```yaml
AskUserQuestion:
  question: "同期するカテゴリを選択してください（複数選択可）"
  header: "カテゴリ選択"
  multiSelect: true
  options:
    # dev-cli カテゴリ
    - label: "📝 commands (dev-cli)"
      description: "Claude Codeコマンド (.claude/commands/)"
      default: true
    - label: "🤖 agents (dev-cli)"
      description: "Claude Codeエージェント (.claude/agents/)"
      default: true
    - label: "🎯 skills (dev-cli)"
      description: "Claude Codeスキル (.claude/skills/)"
      default: true
    - label: "🪝 hooks (dev-cli)"
      description: "Claude Codeフック (.claude/hooks/)"
      default: true
    - label: "📄 docs - Claude関連 (dev-cli)"
      description: "docs/einja/ 配下のドキュメント"
      default: true
    - label: "🔧 env (dev-cli)"
      description: ".envrc ファイル"
      default: true
    - label: "⚙️ tools (dev-cli)"
      description: ".vscode/settings.json ファイル"
      default: true

    # create-einja-app カテゴリ
    - label: "🌍 env (create-einja-app)"
      description: ".env.example, .node-version, .volta/ 等"
      default: true
    - label: "🛠️ tools (create-einja-app)"
      description: "biome.json, .prettierrc, .editorconfig, .vscode/ 等"
      default: true
    - label: "📄 docs - プロジェクト全体 (create-einja-app)"
      description: "README.md, docs/ 全体"
      default: true
    - label: "🔐 git (create-einja-app)"
      description: ".gitignore, .gitattributes"
      default: true
    - label: "🪝 git-hooks (create-einja-app)"
      description: ".husky/ フック"
      default: true
    - label: "🐙 github (create-einja-app)"
      description: ".github/workflows/, .github/actions/"
      default: true
    - label: "🐳 docker (create-einja-app)"
      description: "Dockerfile*, docker-compose.yml"
      default: true
    - label: "📦 monorepo (create-einja-app)"
      description: "turbo.json, pnpm-workspace.yaml"
      default: true
    - label: "📋 root-config (create-einja-app)"
      description: "package.json, tsconfig.json"
      default: true
    - label: "📜 scripts (create-einja-app)"
      description: "scripts/**"
      default: true
    - label: "🚫 apps (create-einja-app)"
      description: "apps/** （通常は非推奨）"
      default: false
    - label: "🚫 packages (create-einja-app)"
      description: "packages/** （通常は非推奨）"
      default: false
```

---

## 3. エッジケース: 🔴 重大な見落としあり

### 3.1 片方のCLIのみインストール済みの場合: ✅ OK

Planの記述どおり、検出されたCLIのみ使用すればよい。

### 3.2 カテゴリ重複問題: 🔴 **重大な問題**

**実装調査結果**:

| カテゴリ | dev-cli | create-einja-app | 管理対象ファイル | 重複 |
|---------|---------|------------------|-----------------|------|
| commands | ✅ | ❌ | `.claude/commands/` | ❌ |
| agents | ✅ | ❌ | `.claude/agents/` | ❌ |
| skills | ✅ | ❌ | `.claude/skills/` | ❌ |
| hooks | ✅ | ❌ | `.claude/hooks/` | ❌ |
| **env** | ✅ `.envrc` | ✅ `.env*`, `.node-version`, `.volta/` | **異なるファイル** | ✅ |
| **tools** | ✅ `.vscode/settings.json` | ✅ `biome.json`, `.prettierrc`, `.editorconfig`, `.vscode/` | **部分的に重複** | ⚠️ |
| **docs** | ✅ `docs/einja/` | ✅ `README.md`, `docs/` | **異なる範囲** | ✅ |

**重複カテゴリの詳細**:

#### a) env: ファイルが異なる → 問題なし

- dev-cli: `.envrc` のみ
- create-einja-app: `.env.example`, `.env.local.example`, `.node-version`, `.nvmrc`, `.volta/`

**結論**: ファイル重複なし。両方実行しても問題ない。

#### b) tools: .vscode/settings.json が重複 → 🔴 **コンフリクトの可能性**

- dev-cli: `.vscode/settings.json`
- create-einja-app: `biome.json`, `.prettierrc`, `.editorconfig`, `.vscode/`（settings.jsonを含む）

**問題**: 両方実行すると `.vscode/settings.json` が2回同期され、後者が上書きする可能性がある。

**対策**:
1. ユーザーにツールチップで警告表示
2. 両方選択された場合、dev-cliのtools実行後にcreate-einja-appのtoolsをスキップ（または統合マージ）

#### c) docs: 範囲が異なる → 問題なし

- dev-cli: `docs/einja/` 配下のみ
- create-einja-app: `README.md`, `docs/` 全体

**結論**: 範囲が異なるため、両方実行しても問題ない（create-einja-appが上位集合）。

---

### 3.3 コンフリクト発生時のフロー: ⚠️ 詳細化が必要

**Planの記述**:
> コンフリクトがあれば `einja-conflict-resolver` Skill の手順に従って解消

**問題点**:

1. **conflict-resolver Skillは1ファイルずつユーザー確認を行う**（SKILL.md Step 2参照）
2. sync操作でのコンフリクトは**gitコンフリクトではない**（マージマーカーが挿入されたファイル）
3. conflict-resolverはgitコンフリクト専用（rebase/merge/cherry-pick）

**推奨フロー**:

```markdown
### Step 5-A: コンフリクト検出

1. dev-cliのJSON出力をパース:
   ```json
   {
     "status": "partial_success",
     "summary": { "conflicts": 3 }
   }
   ```

2. create-einja-appの出力から検出:
   ```
   ⚠️ コンフリクト: 3ファイル
   ```

### Step 5-B: コンフリクト解消（簡易版）

**オプション1: 自動マージ再試行**

コンフリクトファイルを読み取り、マージマーカー（`<<<<<<<`, `=======`, `>>>>>>>`）を検出。
各セクションの内容をユーザーに提示し、AskUserQuestionで解消方針を確認。

**オプション2: conflict-resolverへ委譲（非推奨）**

gitにコミット後、`git reset --soft HEAD^`で擬似的にコンフリクト状態を作り、
conflict-resolverで解消。ただし、これは不自然なフローのため非推奨。

**推奨**: オプション1の簡易版を実装
```

---

## 4. create-einja-app syncの非対話実行: ✅ 確認済み

**仕様確認結果**（commands/sync.ts:168-184行目）:

```typescript
if (options.categories) {
  // --categories指定時: 対話なし
  categories = options.categories as SyncCategory[];
  logger.info(`指定されたカテゴリ: ${categories.join(", ")}`);
}
```

**結論**: ✅ `--categories` 指定時は対話プロンプトをスキップする（Planの想定どおり）

---

## 5. 見落とし・追加検討事項

### 5.1 エラーハンドリング: ⚠️ 不足

**追加すべき項目**:

- npxコマンド失敗時の処理（タイムアウト、権限エラー等）
- 両CLIのバージョン不一致警告（古いバージョンの場合）
- バックアップファイルの管理（両CLIが別々にバックアップを作成するため、復元時の競合）

### 5.2 実行順序: ⚠️ 明示が必要

**推奨順序**:

1. dev-cli sync（Claude Code関連ファイル）
2. create-einja-app sync（プロジェクト全体）

**理由**: dev-cliが先にClaude Code環境を整備し、create-einja-appがプロジェクト全体を同期する方が自然な流れ。

### 5.3 結果サマリーの統合: ⚠️ 不足

**Planには結果サマリー表示があるが、詳細が不足**:

```markdown
### Step 6: 結果サマリー表示

| CLI | カテゴリ | 成功 | スキップ | コンフリクト | 合計 |
|-----|---------|------|---------|-------------|------|
| dev-cli | commands, agents, skills | 15 | 2 | 0 | 17 |
| create-einja-app | env, tools, git | 8 | 1 | 1 | 10 |
| **合計** | | **23** | **3** | **1** | **27** |

**コンフリクトファイル**:
- `.vscode/settings.json` (tools重複)

**次のステップ**:
コンフリクトを解消してください: [解消手順へのリンク]
```

### 5.4 ビルド時のコピー: ✅ 確認済み

Planに記載のとおり、`.claude/commands/einja/sync.md` は既存の `copy-presets.mjs` で自動的に `presets/default/.claude/commands/einja/sync.md` へコピーされる。

**確認方法**:

```bash
# ビルド実行
pnpm build

# コピー確認
ls presets/default/.claude/commands/einja/sync.md
```

---

## 最終推奨事項

### 必須修正

1. **カテゴリ選択UIの詳細化**: dev-cli/create-einja-app でカテゴリ名が重複する場合、UI上で明示的に区別する
2. **tools重複警告の実装**: 両方のtoolsカテゴリが選択された場合、`.vscode/settings.json` 重複を警告
3. **コンフリクト解消フローの詳細化**: sync専用の簡易的なコンフリクト解消ロジックを記述（conflict-resolver Skillは不適切）

### 推奨改善

1. 実行順序の明示（dev-cli → create-einja-app）
2. エラーハンドリングの追加
3. 結果サマリーの統合表示

### オプション

1. 両CLIのバージョンチェック
2. バックアップ管理の統合

---

## Plan修正案のサマリー

| 項目 | 現状 | 推奨 |
|-----|------|------|
| カテゴリ選択UI | 簡易版 | 2段階選択（簡易/詳細） |
| カテゴリ重複対応 | 未対応 | UI上で区別 + 警告表示 |
| コンフリクト解消 | conflict-resolver委譲 | sync専用の簡易ロジック |
| 実行順序 | 未定義 | dev-cli → create-einja-app |
| 結果サマリー | 基本版 | 統合表示 + コンフリクト詳細 |

---

**最終結論**: このPlanは**実装可能**ですが、カテゴリ重複問題への対応とコンフリクト解消フローの詳細化が必須です。
