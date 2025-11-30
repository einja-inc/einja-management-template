# 現状分析

## 📁 `.claude`ディレクトリの詳細構造

### ディレクトリツリー

```
.claude/
├── agents/                                 # サブエージェント定義
│   ├── frontend-architect.md              # フロントエンドアーキテクチャ設計
│   ├── design-engineer.md                  # デザインシステム連携
│   ├── frontend-coder.md                   # フロントエンド実装
│   ├── specs/                              # 仕様書生成エージェント
│   │   ├── spec-requirements-generator.md  # 要件定義生成
│   │   ├── spec-design-generator.md        # 設計書生成
│   │   ├── spec-tasks-generator.md         # タスク分解
│   │   └── spec-qa-generator.md            # QAテスト計画生成
│   └── task/                               # タスク実行エージェント
│       ├── task-starter.md                 # タスク選定
│       ├── task-executer.md                # タスク実装
│       ├── task-reviewer.md                # コードレビュー
│       ├── task-qa.md                      # 品質保証
│       ├── task-finisher.md                # 完了処理
│       └── task-modification-analyzer.md   # 修正分析
├── commands/                               # スラッシュコマンド定義
│   ├── frontend-implement.md               # フロントエンド実装オーケストレーター
│   ├── spec-create.md                      # 仕様書作成ワークフロー
│   ├── task-exec.md                        # タスク実行パイプライン
│   ├── task-vibe-kanban-loop.md            # Vibe Kanban連携ループ
│   ├── start-dev.md                        # 開発環境起動
│   ├── sync-cursor-commands.md             # Cursorコマンド同期
│   └── update-docs-by-task-specs.md        # 仕様書ドキュメント更新
└── settings.json                           # MCP設定
```

### ファイル数・サイズ

| カテゴリ | ファイル数 | 概算サイズ |
|---------|-----------|----------|
| **エージェント** | 13ファイル | ~150KB |
| **コマンド** | 7ファイル | ~80KB |
| **設定** | 1ファイル | ~5KB |
| **合計** | 21ファイル | ~235KB |

---

## 🔍 各エージェント・コマンドの詳細分析

### 1. フロントエンド開発エージェント（プロジェクト特化）

#### `frontend-architect.md`

**役割**: フロントエンドアーキテクチャ設計・技術選定

**依存関係**:
- ✅ Next.js 15 (App Router)
- ✅ React 19
- ✅ TanStack Query (状態管理)
- ✅ Panda CSS (スタイリング)
- ✅ shadcn/ui (UIコンポーネント)
- ✅ Turborepo (モノレポ)

**主要機能**:
- コンポーネント構造設計
- 状態管理戦略決定
- データフローアーキテクチャ
- パフォーマンス最適化方針

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い

**再利用可能性**: ❌ Next.js/React専用、他の技術スタックには適用不可

---

#### `design-engineer.md`

**役割**: Figmaデザインシステム連携、Panda CSSスタイリング

**依存関係**:
- ✅ Figma MCP (デザイン読み込み)
- ✅ Panda CSS (スタイリング)
- ✅ デザイントークン体系

**主要機能**:
- Figmaからデザイントークン抽出
- Panda CSSレシピ生成
- レスポンシブデザイン実装
- コンポーネント仕様抽出

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い

**再利用可能性**: ❌ Panda CSS専用、Tailwind CSS/Emotion/Styled-componentsには適用不可

---

#### `frontend-coder.md`

**役割**: フロントエンド実装、テスト、品質保証

**依存関係**:
- ✅ Next.js 15 (App Router、Server Components)
- ✅ React 19 (Hooks、Suspense)
- ✅ TypeScript (strict mode)
- ✅ Panda CSS
- ✅ NextAuth v5 (認証)
- ✅ React Hook Form (フォーム)
- ✅ Vitest (テスト)
- ✅ React Testing Library

**主要機能**:
- コンポーネント実装
- Server Components/Client Components使い分け
- 認証・認可実装
- フォーム実装
- テスト実装

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い

**再利用可能性**: ❌ Next.js/React専用、完全な書き換えが必要

---

### 2. 仕様書生成エージェント（汎用的）

#### `spec-requirements-generator.md`

**役割**: ATDD形式の要件定義書生成

**依存関係**:
- なし（技術スタック非依存）

**主要機能**:
- ユーザーストーリー作成
- 受け入れ基準（Acceptance Criteria）定義
- 非機能要件整理

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的、すべてのプロジェクトタイプで使用可能

---

#### `spec-design-generator.md`

**役割**: 技術設計書生成

**依存関係**:
- ⚠️ プロジェクトのコードベースを参照（技術スタックを推論）
- requirements.md (入力)

**主要機能**:
- アーキテクチャ設計
- データモデル設計
- API設計
- 技術スタック選定

**技術スタック依存度**: ⭐⭐ 低い（参照するだけ、固定されていない）

**再利用可能性**: ✅ ほぼ汎用的、技術スタック参照部分を抽象化すれば完全に汎用化可能

---

#### `spec-tasks-generator.md`

**役割**: 要件・設計からタスク分解、GitHub Issue更新

**依存関係**:
- GitHub API (Issue更新)
- design.md (入力)

**主要機能**:
- タスク分解（フェーズ・グループ化）
- 依存関係解析
- 並列実行可能タスクの特定
- GitHub Issue本文更新

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

#### `spec-qa-generator.md`

**役割**: QAテスト計画生成

**依存関係**:
- Acceptance Criteria (受け入れ基準)
- テスト戦略ドキュメント参照

**主要機能**:
- テストケース生成
- Playwright MCP使用例提供
- フェーズごとのテストファイル生成

**技術スタック依存度**: ⭐⭐ 低い（テストツール選択は柔軟）

**再利用可能性**: ✅ ほぼ汎用的

---

### 3. タスク実行エージェント（汎用的）

#### `task-starter.md`

**役割**: GitHub Issueから実行可能なタスクグループを選定

**依存関係**:
- GitHub API (Issue読み込み)

**主要機能**:
- タスク依存関係解析
- 実行可能タスクの自動判定
- 着手中マーク付け

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

#### `task-executer.md`

**役割**: タスク実装実行

**依存関係**:
- ⚠️ プロジェクト指示書（CLAUDE.md、docs/*.mdc）を参照
- requirements.md、design.md (入力)

**主要機能**:
- コード実装
- テスト実装
- コーディング規約遵守
- 修正記録保存

**技術スタック依存度**: ⭐⭐ 低い（参照するドキュメントに依存）

**再利用可能性**: ✅ 汎用的（プロジェクト指示書を適切に設定すれば）

**注意点**: プロジェクト固有のコーディング規約・ディレクトリ構造に依存するが、それらはCLAUDE.mdやdocs/*.mdcで定義されるため、エージェント自体は汎用的

---

#### `task-reviewer.md`

**役割**: 実装内容のコードレビュー

**依存関係**:
- requirements.md、design.md (レビュー基準)

**主要機能**:
- 要件・設計との整合性確認
- コード品質チェック
- 仮実装検出
- レビュー結果報告

**技術スタック依存度**: ⭐⭐ 低い

**再利用可能性**: ✅ ほぼ汎用的

---

#### `task-qa.md`

**役割**: 品質保証テスト実行

**依存関係**:
- ⚠️ テスト戦略ドキュメント参照
- Acceptance Criteria (受け入れ基準)

**主要機能**:
- 受け入れ基準に基づくテスト
- 自動テスト実行
- Playwright MCP使用（手動テスト）
- テスト結果報告

**技術スタック依存度**: ⭐⭐ 低い（テストツールは柔軟）

**再利用可能性**: ✅ ほぼ汎用的

---

#### `task-finisher.md`

**役割**: タスク完了処理、GitHub Issue更新

**依存関係**:
- GitHub API (Issue更新)

**主要機能**:
- タスクグループ完了マーク
- GitHub Issue状態更新
- 次タスクへの引き継ぎ

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

#### `task-modification-analyzer.md`

**役割**: タスク完了後の追加修正指示の分析

**依存関係**:
- requirements.md、design.md

**主要機能**:
- 修正内容の影響範囲分析
- ドキュメント修正の必要性判定
- 修正規模評価

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

### 4. コマンド（オーケストレーター）

#### `task-exec.md`

**役割**: タスク実行パイプライン全体を統括

**呼び出しエージェント**:
1. `task-starter.md`
2. `task-executer.md`
3. `task-reviewer.md`
4. `task-qa.md`
5. `task-finisher.md`

**品質保証ループ**: executer → reviewer → qa → (問題あれば再executer) → finisher

**技術スタック依存度**: ⭐ なし（呼び出すエージェントに依存）

**再利用可能性**: ✅ 完全に汎用的

---

#### `frontend-implement.md`

**役割**: フロントエンド実装パイプライン

**呼び出しエージェント**:
1. `frontend-architect.md`
2. `design-engineer.md`
3. `frontend-coder.md`

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い（Next.js/React専用）

**再利用可能性**: ❌ Next.js/React専用

---

#### `spec-create.md`

**役割**: 仕様書作成ワークフロー

**呼び出しエージェント**:
1. `spec-requirements-generator.md`
2. `spec-design-generator.md`
3. `spec-tasks-generator.md`

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

#### `task-vibe-kanban-loop.md`

**役割**: Vibe Kanban連携ループ

**依存関係**:
- Vibe Kanban MCP

**技術スタック依存度**: ⭐ なし（ツール依存のみ）

**再利用可能性**: ✅ 汎用的（Vibe Kanban使用プロジェクトで）

---

#### `start-dev.md`

**役割**: 開発環境起動

**依存関係**:
- ⚠️ プロジェクト固有の開発コマンド（pnpm dev、docker-compose upなど）

**技術スタック依存度**: ⭐⭐⭐ 中程度

**再利用可能性**: ⚠️ パッケージマネージャー、開発サーバーコマンドをパラメータ化すれば汎用化可能

---

#### `sync-cursor-commands.md`

**役割**: .claude/commandsを.cursor/commandsに同期

**技術スタック依存度**: ⭐ なし

**再利用可能性**: ✅ 完全に汎用的

---

#### `update-docs-by-task-specs.md`

**役割**: タスク仕様書をfeature/steering仕様書に反映

**依存関係**:
- ⚠️ ドキュメント構造（docs/specs/tasks/、docs/features/、docs/steering/）

**技術スタック依存度**: ⭐ なし（構造依存）

**再利用可能性**: ✅ ドキュメント構造を標準化すれば汎用的

---

## 📊 プロジェクト固有 vs 汎用要素の分類

### 完全汎用（✅ すぐに共有可能）

| カテゴリ | ファイル数 | 要素 |
|---------|-----------|------|
| **仕様書生成** | 4 | spec-requirements-generator, spec-design-generator, spec-tasks-generator, spec-qa-generator |
| **タスク管理** | 6 | task-starter, task-executer, task-reviewer, task-qa, task-finisher, task-modification-analyzer |
| **コマンド** | 3 | task-exec, spec-create, task-vibe-kanban-loop |
| **合計** | **13ファイル** | **~62%** |

### ほぼ汎用（⚠️ 軽微な調整で共有可能）

| カテゴリ | ファイル数 | 要素 | 調整内容 |
|---------|-----------|------|---------|
| **コマンド** | 2 | sync-cursor-commands, update-docs-by-task-specs | ドキュメント構造パラメータ化 |
| **合計** | **2ファイル** | **~10%** |

### プロジェクト固有（❌ 技術スタック依存）

| カテゴリ | ファイル数 | 要素 | 依存技術スタック |
|---------|-----------|------|----------------|
| **フロントエンド** | 3 | frontend-architect, design-engineer, frontend-coder | Next.js, React, Panda CSS |
| **コマンド** | 2 | frontend-implement, start-dev | Next.js/React、開発コマンド |
| **合計** | **5ファイル** | **~24%** |

### 設定ファイル（✅ 汎用）

| ファイル | 内容 | 汎用性 |
|---------|------|--------|
| `settings.json` | MCP設定 | ✅ 汎用的（組織のMCP設定に依存） |

---

## 🏗️ アプリケーションコードとの関係性

### アプリケーションコード構成

```
einja-management-template/
├── apps/
│   └── web/                     # Next.js管理画面アプリ
│       ├── src/
│       │   ├── app/             # App Router
│       │   ├── components/      # コンポーネント
│       │   └── lib/             # ユーティリティ
│       └── package.json
├── packages/
│   ├── config/                  # 共通設定
│   ├── types/                   # 型定義
│   ├── database/                # Prismaクライアント
│   ├── auth/                    # NextAuth設定
│   └── ui/                      # 共通UIコンポーネント
├── turbo.json                   # Turborepo設定
├── pnpm-workspace.yaml          # pnpm workspaces
└── package.json                 # ルート
```

### 問題点

1. **物理的混在**
   - Claude Code設定（`.claude/`、`docs/`、`CLAUDE.md`）とアプリケーションコード（`apps/`、`packages/`）が同一ルート階層
   - git submoduleで参照すると不要なアプリケーションコード（約90%）も含まれる

2. **概念的混在**
   - リポジトリの目的が不明確
   - 「管理画面テンプレート」なのか「Claude Code設定配布元」なのか？

3. **保守性の問題**
   - Claude Code設定だけを更新したい場合でも、アプリケーションコードが含まれる
   - アプリケーションコードの変更が、Claude Code設定の更新と混同される

---

## 📋 プロジェクト指示書の依存関係

### CLAUDE.md

**場所**: リポジトリルート

**内容**:
- プロジェクト構成（Turborepo、pnpm workspaces）
- 技術スタック（Next.js 15、React 19、Panda CSS）
- 開発環境セットアップ手順
- コマンド一覧
- インポートパス規約

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い

**問題**:
- Next.js/Turborepo前提の記述が多数
- 他の技術スタックには適用不可

---

### docs/coding-standards.mdc

**内容**:
- TypeScript規約（✅ 汎用的）
- React/Next.js規約（❌ 技術スタック固有）
- Panda CSS規約（❌ 技術スタック固有）
- 命名規則（✅ 汎用的）
- エラーハンドリング（✅ 汎用的）

**技術スタック依存度**: ⭐⭐⭐ 中程度

**改善案**: React/Panda CSS固有部分を分離可能

---

### docs/component-design.mdc

**内容**:
- Reactコンポーネント設計原則
- Next.js App Router前提のディレクトリ構造
- Panda CSSスタイリング規約

**技術スタック依存度**: ⭐⭐⭐⭐⭐ 非常に高い

**問題**: 完全にReact/Next.js特化、他の技術スタックには適用不可

---

### docs/github-workflow.mdc

**内容**:
- コミットルール
- ブランチ戦略
- コミットメッセージ規約

**技術スタック依存度**: ⭐ なし

**評価**: ✅ 完全に汎用的、すべてのプロジェクトで使用可能

---

### docs/testing.mdc

**内容**:
- Vitestテスト戦略（✅ ほぼ汎用的）
- React Testing Library（❌ React特化）
- Playwrightテスト（✅ 汎用的）

**技術スタック依存度**: ⭐⭐⭐ 中程度

**改善案**: React Testing Library部分を分離可能

---

### docs/code-review.mdc

**内容**:
- コードレビュー基本方針（✅ 汎用的）
- TypeScript型安全性チェック（✅ 汎用的）
- React/Next.js固有チェック（❌ 技術スタック固有）
- Panda CSSチェック（❌ 技術スタック固有）

**技術スタック依存度**: ⭐⭐ 低い

**改善案**: 技術スタック固有部分を分離可能

---

## 📈 技術スタック依存度マトリクス

| 要素 | 依存度 | Next.js | React | Panda CSS | Turborepo | 再利用可能性 |
|------|--------|---------|-------|-----------|-----------|------------|
| `frontend-architect.md` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | ✅ | ❌ 不可 |
| `design-engineer.md` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | - | ❌ 不可 |
| `frontend-coder.md` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | - | ❌ 不可 |
| `frontend-implement.md` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | - | ❌ 不可 |
| `spec-*` (4エージェント) | ⭐ | - | - | - | - | ✅ 完全可能 |
| `task-*` (6エージェント) | ⭐ | - | - | - | - | ✅ 完全可能 |
| `start-dev.md` | ⭐⭐⭐ | - | - | - | ⚠️ | ⚠️ パラメータ化で可能 |
| `CLAUDE.md` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | ✅ | ❌ テンプレート化必要 |
| `docs/component-design.mdc` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ | - | ❌ React専用 |
| `docs/github-workflow.mdc` | ⭐ | - | - | - | - | ✅ 完全可能 |

---

## 🎯 まとめ

### 共有可能な要素（62%）

- **タスク管理フロー**: task-exec、task-*エージェント
- **仕様書生成フロー**: spec-create、spec-*エージェント
- **ドキュメント**: github-workflow.mdc

これらは**即座に他のプロジェクトで使用可能**。

### 技術スタック固有の要素（24%）

- **フロントエンドエージェント**: frontend-architect、design-engineer、frontend-coder
- **フロントエンドコマンド**: frontend-implement
- **ドキュメント**: component-design.mdc

これらは**Next.js/React専用**で、他の技術スタックには適用不可。

### 主要な課題

1. **アプリケーションコードとの混在** → リポジトリ再構成で解決
2. **技術スタック固定** → 当面はNext.js/Reactのみに集中（将来的に拡張可能）
3. **配布・更新の仕組み不在** → インストール・更新スクリプトで解決
4. **検証環境の不在** → シンボリックリンクで解決

---

**次のドキュメント**: [共有戦略の評価](./02-sharing-strategies.md)
