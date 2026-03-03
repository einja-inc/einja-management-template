# プリセットファイルのハードコード値調査レポート

## 調査目的
`einja init` で配布されるプリセットファイル群（`packages/cli/presets/default/`）に、テンプレートリポジトリ（einja-management-template）固有のハードコードされた値が含まれていないかを調査する。

## 調査対象ファイル

### 1. scripts/ 配下のファイル

#### ✅ scripts/init.sh
**問題なし** - 汎用的なスクリプト
- package.jsonから動的にNode/pnpmバージョンを取得
- 環境依存の値なし

#### ✅ scripts/env.ts
**問題なし** - 汎用的な環境変数ウィザード
- ファイルパスは相対パス（`process.cwd()`ベース）
- 環境変数名は一般的な命名（DATABASE_URL, AUTH_SECRET, GITHUB_TOKEN等）

#### ✅ scripts/env-show.ts
**問題なし** - 汎用的な表示スクリプト
- 環境設定は共通定義（ENVIRONMENTS配列）を使用
- 固有の値なし

#### ✅ scripts/env-rotate-secrets.ts
**問題なし** - 汎用的な秘密鍵ローテーションスクリプト
- 共通ライブラリ（env-common.ts）を使用
- 固有の値なし

#### ✅ scripts/setup-dev.ts
**問題なし** - 汎用的なセットアップスクリプト
- `process.cwd()`で現在ディレクトリを基準
- ポート番号等は環境変数や設定ファイルから動的取得（推測）

#### ⚠️ scripts/worktree/dev.ts
**潜在的な問題あり**
- **L14**: `import type { AppConfig, WorktreeConfig } from "../../packages/config/src/worktree-config.js";`
  - **問題**: テンプレートリポジトリ固有のパッケージパス構造に依存
  - **影響**: 他プロジェクトがこの構造を持たない場合、import失敗でエラー
- **L101**: `config = loadWorktreeConfig();`
  - **問題**: worktree.config.jsonの存在を前提としている
  - **影響**: 設定ファイル未作成時のエラーハンドリングが不明確

#### ✅ scripts/lib/env-common.ts
**問題なし** - 汎用的な共通ライブラリ
- 環境設定定義は標準的（local, develop, preview, production, ci）
- 固有の値なし

---

### 2. .envrc
**問題なし** - 汎用的なdirenv設定
- 相対パスのみ（`.env`, `.env.personal`）
- git worktree対応の汎用ロジック

---

### 3. .mcp.json
**問題なし** - 汎用的なMCP設定
- MCPサーバー設定は汎用的
- `${GITHUB_TOKEN}` は環境変数参照（動的）

---

### 4. CLAUDE.md.template
**問題なし** - テンプレート化済み
- `@einja:excluded:start` ~ `@einja:excluded:end` で囲まれた部分は配布時に除外される
- 変数プレースホルダーは未検出（要確認: テンプレート変換処理の詳細）

---

### 5. preset.yaml
**問題なし** - プリセット定義
- 変数定義セクション（`variables:`）でユーザーカスタマイズ可能
- `PROJECT_NAME`, `INSTALL_COMMAND` 等のプレースホルダーを提供

---

### 6. .claude/settings.json
**問題なし** - 汎用的なClaude設定
- パーミッション設定は汎用的
- フック定義のパスは `$CLAUDE_PROJECT_DIR` を使用（動的）

---

## 追加調査結果

### grep検索結果

#### 1. テンプレートリポジトリ名の検出
```bash
grep -r "einja-management-template" packages/cli/presets/default/
```
**検出箇所**:
- `docs/einja/steering/README.md`:
  ```
  詳細な仕様は [CLIのマーカー仕様書](https://github.com/einja-inc/einja-management-template/blob/main/packages/cli/docs/MARKER_SPECIFICATION.md) を参照してください。
  ```
  - **問題**: ハードコードされたGitHubリポジトリURL
  - **影響**: 外部リンクが切れる（他プロジェクトには無関係なリンク）
  - **重要度**: 🟡 中（ドキュメントの参照リンクのみ）

#### 2. ハードコードされたポート番号の検出
```bash
grep -r "localhost:300[0-9]" packages/cli/presets/default/
```
**検出箇所** (多数):

| ファイル | 行内容 | 重要度 |
|---------|--------|--------|
| `.claude/agents/einja/specs/spec-qa-generator.md` | `http://localhost:3000/auth/login` | 🟡 中 |
| `docs/einja/instructions/environment-setup.md` | `NEXTAUTH_URL="http://localhost:3000"` | 🔴 高 |
| `docs/einja/example/specs/issues/issue999-example-task/qa-tests/README.md` | `http://localhost:3000` (複数箇所) | 🟢 低（例示） |
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | `http://localhost:3000` (複数箇所) | 🟡 中 |
| `docs/einja/steering/development/testing-strategy.md` | `baseURL: 'http://localhost:3000'` | 🟡 中 |

**問題点**:
- テンプレート固有のポート番号（3000）がハードコード
- 実際のプロジェクトは異なるポート（例: 3001, 8080等）を使用する可能性
- Worktree環境では動的ポート割り当てが必要

#### 3. ハードコードされたリポジトリURLの検出
```bash
grep -r "github.com/einja-inc" packages/cli/presets/default/
```
**検出箇所**:
- `docs/einja/steering/README.md`: 同上（問題1と同じ）

#### 4. 開発者固有の絶対パスの検出
```bash
grep -r "/Users/kzp" packages/cli/presets/default/
```
**結果**: 検出なし ✅

---

## 修正が必要な箇所

### 🔴 高優先度1: docs/einja/instructions/environment-setup.md

#### 問題: ハードコードされたポート番号
```
NEXTAUTH_URL="http://localhost:3000"
```

**修正案**:
- 変数プレースホルダーに置き換え:
  ```
  NEXTAUTH_URL="http://localhost:${PORT:-3000}"
  ```
- またはドキュメント内で「ポート番号は環境に応じて変更してください」と注記

---

### 🔴 高優先度2: scripts/worktree/dev.ts

#### 問題1: packages/config へのハードコードされた依存
```typescript
import type { AppConfig, WorktreeConfig } from "../../packages/config/src/worktree-config.js";
```

**修正案**:
- オプション1（推奨）: 型定義をスクリプト内にインライン化
  ```typescript
  interface AppConfig {
    id: string;
    portRangeStart: number;
    rangeSize: number;
  }
  interface WorktreeConfig {
    apps: AppConfig[];
    postgres: { port: number; containerName: string };
  }
  ```
- オプション2: worktree.config.json から型を動的に推論
- オプション3: 設定ファイルのパスを環境変数で指定可能にする

#### 問題2: loadWorktreeConfig() の依存
```typescript
import { loadWorktreeConfig } from "../../packages/config/src/worktree-config-loader.js";
```

**修正案**:
- `loadWorktreeConfig()` の実装を `dev.ts` 内にインライン化
- または、設定ファイルが存在しない場合のデフォルト値を提供

---

### 🟡 中優先度: ドキュメント内のポート番号

#### 問題箇所
- `.claude/agents/einja/specs/spec-qa-generator.md`
- `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
- `docs/einja/steering/development/testing-strategy.md`

**修正案**:
- 例示部分は `http://localhost:${PORT}` のように変数表記に変更
- または「例: localhost:3000（実際のポートは環境に応じて変更）」と注記を追加

---

### 🟡 中優先度: docs/einja/steering/README.md

#### 問題: 外部リンク
```
https://github.com/einja-inc/einja-management-template/blob/main/packages/cli/docs/MARKER_SPECIFICATION.md
```

**修正案**:
- 相対パス参照に変更:
  ```
  [CLIのマーカー仕様書](../../../packages/cli/docs/MARKER_SPECIFICATION.md)
  ```
- または汎用的なドキュメントリンクに変更

---

## 推奨アクション

### 優先度1: 環境依存値の変数化
1. **docs/einja/instructions/environment-setup.md**
   - ポート番号を変数化（`${PORT:-3000}`）
   - 環境変数設定ガイドを追記

### 優先度2: スクリプトの依存解消
2. **scripts/worktree/dev.ts**
   - packages/config への依存を解消
   - worktree.config.json のスキーマ定義をスクリプト内に含める
   - 設定ファイル不在時のフォールバック処理を追加

### 優先度3: ドキュメントの汎用化
3. **ドキュメント全体**
   - 例示のポート番号に「環境依存」の注記を追加
   - 外部リンクを相対パス参照に変更
   - テンプレート変換処理（CLAUDE.md.template → CLAUDE.md）の詳細調査

### 優先度4: 検証・ドキュメント化
4. **追加タスク**
   - preset.yaml の変数置換ロジックの検証
   - プリセットファイルのカスタマイズガイド作成
   - einja init 時の変数入力プロンプトの設計

---

## 調査結果サマリー

### ✅ 問題なし（11ファイル）
- scripts/init.sh
- scripts/env.ts
- scripts/env-show.ts
- scripts/env-rotate-secrets.ts
- scripts/setup-dev.ts
- scripts/lib/env-common.ts
- .envrc
- .mcp.json
- CLAUDE.md.template
- preset.yaml
- .claude/settings.json

### ⚠️ 修正必要（5ファイル）

| ファイル | 問題 | 重要度 |
|---------|------|--------|
| scripts/worktree/dev.ts | packages/config への依存 | 🔴 高 |
| docs/einja/instructions/environment-setup.md | ポート番号ハードコード | 🔴 高 |
| docs/einja/steering/README.md | 外部リンク | 🟡 中 |
| .claude/agents/einja/specs/spec-qa-generator.md | ポート番号ハードコード | 🟡 中 |
| docs/einja/steering/acceptance-criteria-and-qa-guide.md | ポート番号ハードコード | 🟡 中 |
| docs/einja/steering/development/testing-strategy.md | ポート番号ハードコード | 🟡 中 |

### 🟢 例示のみ（修正推奨だが低優先度）
- docs/einja/example/specs/issues/issue999-example-task/qa-tests/README.md

---

## 次のステップ

1. **ユーザー確認**
   - この調査結果をユーザーに報告
   - 修正方針の承認を得る

2. **修正実施**
   - 承認後、優先度順に修正タスクを実行
   - コミット・プッシュ

3. **検証**
   - einja init で新規プロジェクト作成テスト
   - プリセット適用後の動作確認
