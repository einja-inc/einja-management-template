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

### Phase 0: 実装戦略の確認（Phase 1前）

フロントエンド実装を開始する前に、以下の戦略を確認します。

#### 0.1 コンポーネント構成

```yaml
AskUserQuestion:
  question: "コンポーネント構成をどのように設計しますか？"
  header: "構成選択"
  options:
    - label: "既存パターンに従う（推奨）"
      description: |
        推奨理由: プロジェクトの一貫性を維持し、チーム全体の開発効率を向上させます。
        メリット: 既存コンポーネントとの整合性が高く、チーム内での理解が容易。学習コストが最小限。
        デメリット: 新しいパターンが必要な場合は柔軟に対応できない可能性があります。
    - label: "Atomic Design"
      description: |
        atoms/molecules/organisms/templates/pagesの階層構造で設計します。
        メリット: 再利用性が非常に高く、大規模UIシステムに向いている。デザインシステムとの親和性が高い。
        デメリット: 学習コストが高く、過度な抽象化によりコードの追跡が困難になるリスクがあります。
    - label: "Feature-based構成"
      description: |
        機能単位でファイルをまとめる構成です。
        メリット: 機能の独立性が高く、コードの関連性が分かりやすい。機能削除時の影響範囲が明確。
        デメリット: 共通コンポーネントの管理が複雑になり、重複コードが発生しやすくなります。
```

#### 0.2 Figmaデザイン参照

```yaml
AskUserQuestion:
  question: "Figmaデザイン参照は利用できますか？"
  header: "Figma連携"
  options:
    - label: "既存デザインシステムで対応（推奨）"
      description: |
        推奨理由: 既存のトークンとレシピを活用し、実装速度と一貫性を両立します。
        メリット: 既存のトークンとレシピを再利用でき、実装が迅速。既存コンポーネントとのスタイル統一が容易。
        デメリット: 新しいデザインパターンに対応できない場合があり、デザイントークンの手動追加が必要になります。
    - label: "Figma URLを提供する"
      description: |
        design-engineerエージェントがFigma MCPでデザイントークンを自動抽出します。
        メリット: デザインとコードの一貫性が非常に高く、デザイナーとの連携が容易。トークン抽出が自動化される。
        デメリット: Figma MCPの設定が必要。デザイン変更の同期に手間がかかり、初期セットアップコストが高い。
    - label: "デザイン仕様書を参照"
      description: |
        別途提供されたデザイン仕様書（PDF、Markdown等）に従って実装します。
        メリット: デザイナーの意図を詳細に理解でき、仕様書が実装の根拠となる。
        デメリット: 仕様書の解釈にばらつきが出る可能性があり、手動でトークン定義が必要になります。
```

#### 0.3 状態管理の複雑さ

```yaml
AskUserQuestion:
  question: "状態管理の複雑さはどの程度ですか？"
  header: "状態管理"
  options:
    - label: "中程度（Server State + UI State）（推奨）"
      description: |
        推奨理由: TanStack Queryでサーバー状態を管理し、モダンな状態管理パターンを実現します。
        メリット: サーバー状態とUIステートが明確に分離され、キャッシュ管理が自動化される。リアルタイムデータ同期が容易。
        デメリット: TanStack Queryの学習が必要になり、初期セットアップに時間がかかります。
    - label: "シンプル（UI Stateのみ）"
      description: |
        useState、useReducerで状態管理を行います。
        メリット: シンプルで理解しやすく、学習コストが低い。Reactの標準機能のみで実装可能。
        デメリット: サーバーとの同期やキャッシュ管理が手動になり、大規模アプリでは保守が困難になります。
    - label: "複雑（複数の状態層の連携）"
      description: |
        グローバル状態管理（Zustand、Jotai等）の追加を検討します。
        メリット: 複雑な状態の共有が容易になり、コンポーネント間のデータ受け渡しが簡潔になる。
        デメリット: 状態管理ライブラリの追加が必要。過度な使用は保守性を下げ、デバッグが困難になります。
```

---

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
pnpm --filter @repo/web panda codegen
```

### 型エラー
```bash
pnpm typecheck
```

---
