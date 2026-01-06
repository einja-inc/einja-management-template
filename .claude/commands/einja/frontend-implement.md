---
description: "フロントエンド実装を自動化するコマンド。architect → design-engineer → frontend-coderの順でサブエージェントを呼び出し、設計からスタイリング、実装まで一貫した開発を行います。ARGUMENTS: 機能名または要件（必須）、Figma URL（オプション）"
allowed-tools: Task, Read, Write, Edit, MultiEdit, Bash, Grep, Glob, mcp__figma_dev_mode__*
---

# フロントエンド実装自動化コマンド

## あなたの役割

あなたは**フロントエンド開発のオーケストレーター**です。以下の3つの専門エージェントを連携させ、設計からスタイリング、実装まで一貫したフロントエンド開発プロセスを管理します：

1. **architect** 🏗️ - コンポーネントアーキテクチャ設計
2. **design-engineer** 🎨 - Figmaデザインシステム連携とスタイリング
3. **frontend-coder** 💻 - 実装とテスト

## 実行フロー

### フェーズ1: アーキテクチャ設計 🏗️

**architect**エージェントを呼び出し：
- コンポーネント構造の設計（Atomic Design、Feature-based構成）
- 状態管理アーキテクチャ（TanStack Query、Form State、UI State）
- データフロー設計（Server/Client境界、Props Drilling回避）
- パフォーマンス戦略（コード分割、レンダリング最適化）
- 型アーキテクチャ（共有型、コンポーネント型、API型）
- **成果物**: Architecture Decision Record (ADR)

**プロンプト例**:
```
機能名: {$ARGUMENTS}

以下を設計してください：
1. コンポーネント構造（ディレクトリ構成、責務分離）
2. 状態管理戦略（Query Keys、Form State、UI State）
3. データフロー設計（Props、Context、Server State）
4. パフォーマンス最適化（Code Splitting、Memoization）
5. 型定義設計（共有型、Props型、State型）

ADR形式で出力してください。
```

**完了条件**: ADRドキュメントの生成完了

---

### フェーズ2: デザインシステム連携とスタイリング 🎨

**design-engineer**エージェントを呼び出し：
- Figma MCPでデザイン分析（Figma URLが提供された場合）
- デザイントークンの抽出と変換
- Panda CSS レシピの生成
- コンポーネントバリアントの定義
- レスポンシブデザインの実装戦略
- **成果物**: Panda CSS設定ファイル、レシピファイル、トークン定義

**プロンプト例（Figma URLあり）**:
```
機能名: {$ARGUMENTS}
Figma URL: {FIGMA_URL}

以下を実行してください：
1. Figma MCPでデザインファイルを分析
2. カラー、タイポグラフィ、スペーシングをPanda CSSトークンに変換
3. コンポーネントバリアントをPanda CSSレシピとして生成
4. レスポンシブブレークポイントを定義

以下のファイルを生成：
- panda.config.ts への追加設定
- recipes/{component-name}.ts
- tokens/{design-tokens}.ts
```

**プロンプト例（Figma URLなし）**:
```
機能名: {$ARGUMENTS}

Architectの設計に基づき、以下を実行してください：
1. 既存のデザイントークンを活用
2. 必要に応じて新しいレシピを生成
3. 一貫したスタイリング戦略を提案

以下のファイルを生成：
- recipes/{component-name}.ts（必要に応じて）
- スタイリングガイドライン
```

**完了条件**: Panda CSS設定・レシピファイルの生成完了

---

### フェーズ3: 実装とテスト 💻

**frontend-coder**エージェントを呼び出し：
- Architectの設計に基づくコンポーネント実装
- Design-Engineerのスタイリングを適用
- TanStack QueryによるServer State管理
- React Hook Form + Zodによるフォームバリデーション
- Vitestによる単体テスト
- **成果物**: 実装ファイル、テストファイル

**プロンプト例**:
```
機能名: {$ARGUMENTS}

以下のアーティファクトを基に実装してください：
1. Architectの設計（ADR）
2. Design-Engineerのスタイリング（Panda CSSレシピ）

実装内容：
- コンポーネント実装（TypeScript strict mode）
- TanStack Query統合（Query Keys、Mutations）
- フォームバリデーション（React Hook Form + Zod）
- Vitestテスト（正常系・異常系）

実装規約：
- any型の使用禁止
- Props型定義必須
- エラーハンドリング実装必須
- アクセシビリティ考慮必須
```

**完了条件**: 実装・テスト完了、型エラーなし

---

## 入力パラメータ

### 必須
- **機能名または要件** (`$ARGUMENTS`の1つ目)
  - 例: "ユーザープロフィール編集画面"
  - 例: "商品検索フィルター機能"
  - 例: "認証フォーム（ログイン・サインアップ）"

### オプション
- **Figma URL** (`$ARGUMENTS`の2つ目)
  - 例: "https://www.figma.com/file/..."
  - 提供された場合: Design-EngineerがFigma MCPで分析
  - 提供されない場合: 既存デザインシステムを活用

## 実行例

```bash
# 基本的な使用方法
frontend-implement "ユーザープロフィール編集画面"

# Figma URLを含む場合
frontend-implement "商品検索フィルター機能" "https://www.figma.com/file/abc123..."

# 複雑な機能の場合
frontend-implement "認証フロー（ログイン・サインアップ・パスワードリセット）"
```

## エージェント間の連携

### Architect → Design-Engineer
- Architectが設計したコンポーネント構造をDesign-Engineerに引き継ぐ
- 状態管理戦略をスタイリングに反映（例: Loadingステート、Errorステート）

### Design-Engineer → Frontend-Coder
- Design-Engineerが生成したPanda CSSレシピをFrontend-Coderが使用
- デザイントークンを型定義に反映

### フィードバックループ
- Frontend-Coderが実装中に問題発見 → Architectに設計見直しを要求
- スタイリングが不足 → Design-Engineerに追加レシピ生成を要求

## 成果物

### 1. Architecture Decision Record (ADR)
- ファイル名: `docs/adr/{YYYYMMDD}-{feature-name}.md`
- 内容: コンポーネント設計、状態管理、データフロー、型定義

### 2. Panda CSS設定・レシピ
- ファイル: `panda.config.ts`（追加設定）
- ファイル: `src/styled-system/recipes/{component-name}.ts`
- ファイル: `src/styled-system/tokens/{design-tokens}.ts`（必要に応じて）

### 3. 実装ファイル
- コンポーネント: `src/components/{category}/{ComponentName}/index.tsx`
- テスト: `src/components/{category}/{ComponentName}/ComponentName.test.tsx`
- 型定義: `src/components/{category}/{ComponentName}/types.ts`（必要に応じて）

### 4. ページ固有コンポーネント（co-location）
- ページコンポーネント: `src/app/{page}/_components/{ComponentName}/index.tsx`
- テスト: `src/app/{page}/_components/{ComponentName}/ComponentName.test.tsx`

## 品質保証

### 各フェーズでの確認事項

**Architectフェーズ**:
- [ ] コンポーネント構造が単一責任の原則に従っているか
- [ ] 状態管理が適切に分離されているか（Server/UI/Form）
- [ ] パフォーマンス最適化が考慮されているか

**Design-Engineerフェーズ**:
- [ ] Figmaデザインと一致しているか（URLありの場合）
- [ ] デザイントークンが適切に抽出されているか
- [ ] レシピがバリアントを正しく表現しているか

**Frontend-Coderフェーズ**:
- [ ] any型を使用していないか
- [ ] Props型定義が完全か
- [ ] テストが正常系・異常系をカバーしているか
- [ ] アクセシビリティが考慮されているか

## 注意事項

### モノレポ構造への対応
- 共有UIコンポーネント → `packages/ui/`
- アプリ固有コンポーネント → `apps/web/src/components/`
- ページ固有コンポーネント → `apps/web/src/app/{page}/_components/`

### 技術スタック
- Next.js 15 (App Router)
- React 19
- TypeScript (strict mode)
- Panda CSS
- TanStack Query
- React Hook Form + Zod
- Vitest + React Testing Library

### 禁止事項
- any型の使用
- インラインスタイルの使用（Panda CSSを使用）
- グローバル状態の濫用（適切な状態分離を行う）

## トラブルシューティング

### Figma MCP接続エラー
- Figma URLの形式確認
- Figma Dev ModeのアクセストークンWARN確認

### Panda CSS生成エラー
```bash
pnpm --filter @einja/web panda codegen
```

### 型エラー
```bash
pnpm typecheck
```

---
