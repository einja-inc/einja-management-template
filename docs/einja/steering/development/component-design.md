<!-- @einja:managed -->
# コンポーネント設計ガイドライン

## 概要

このドキュメントは、プロジェクトにおけるReactコンポーネントの設計原則と実装ガイドラインを提供します。

## 基本原則

### 1. 単一責任の原則
- 各コンポーネントは単一の機能・責任を持つ
- 複数の機能が必要な場合は、複数のコンポーネントに分割する

### 2. 再利用可能性
- プロジェクト全体で再利用可能なコンポーネントを作成する
- プロパティ（props）による柔軟なカスタマイズを可能にする

### 3. 型安全性
- TypeScriptの型定義を必須とする
- プロパティ、状態、イベントハンドラーは全て型定義する

### 4. Co-location（共存配置）
- 機能固有のコンポーネントは関連するページの近くに配置する
- `_components` ディレクトリを使用してページ固有のコンポーネントを管理する
- 複数のページで共有されるコンポーネントのみ `src/components/` に配置する

## クイックリファレンス

### ディレクトリ構造

```
src/
├── components/
│   ├── ui/                 # 基本的なUIコンポーネント
│   │   ├── Button/
│   │   ├── Input/
│   │   └── ...
│   └── shared/             # 共通コンポーネント（レイアウト含む）
│       ├── Header/
│       ├── Footer/
│       └── ...
└── app/
    ├── dashboard/
    │   ├── page.tsx
    │   └── _components/    # ページ固有のコンポーネント
    │       ├── DashboardChart/
    │       └── StatsCard/
    └── ...
```

### コンポーネント命名規則

- **ファイル名**: PascalCase（例: `Button.tsx`, `UserProfile.tsx`）
- **例外**: shadcn/uiコンポーネントはkebab-case（例: `button.tsx`）

### コンポーネントディレクトリ構造

```
ComponentName/
├── index.tsx           # コンポーネント本体
└── variants.ts        # cvaバリアント定義（必要に応じて）
```

### 基本的な型定義

```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}
```

## チェックリスト

新しいコンポーネントを作成する際の確認事項：

- [ ] 適切なディレクトリに配置されている
- [ ] TypeScript の型定義が完全
- [ ] Tailwind CSS でスタイリングされている
- [ ] プロパティのデフォルト値が設定されている
- [ ] アクセシビリティが考慮されている
- [ ] 単体テストが実装されている

## ディレクトリ構造

### プロジェクト全体のコンポーネント配置

```
src/
├── components/
│   ├── ui/                 # 基本的なUIコンポーネント
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Dialog/
│   │   └── ...
│   └── shared/             # 共通コンポーネント（レイアウト含む）
│       ├── Header/
│       ├── Footer/
│       ├── Sidebar/
│       ├── LoadingSpinner/
│       ├── ErrorBoundary/
│       └── ...
└── app/
    ├── dashboard/
    │   ├── page.tsx
    │   └── _components/    # ページ固有のコンポーネント (co-location)
    │       ├── DashboardChart/
    │       ├── StatsCard/
    │       └── ...
    ├── auth/
    │   ├── login/
    │   │   ├── page.tsx
    │   │   └── _components/
    │   │       ├── LoginForm/
    │   │       └── ...
    │   └── register/
    │       ├── page.tsx
    │       └── _components/
    │           ├── RegisterForm/
    │           └── ...
    └── ...
```

### コンポーネント配置のルール

#### `src/components/ui/`
- shadcn/uiなどの基本的なUIコンポーネント
- 複数ページで使用される汎用コンポーネント
- Button、Input、Dialog、Cardなど

#### `src/components/shared/`
- レイアウトコンポーネント（Header、Footer、Sidebar）
- 共通のユーティリティコンポーネント（LoadingSpinner、ErrorBoundary）
- 複数の機能領域で共有されるコンポーネント

#### `app/*/page/_components/`
- ページ固有のコンポーネント
- Co-locationパターンに従った配置
- 他のページでは使用しないコンポーネント

### コンポーネントディレクトリ構造

#### 基本構造

```
ComponentName/
├── index.tsx           # コンポーネント本体
└── styles.ts          # Panda CSS スタイル定義（必要に応じて）
```

#### 複雑なコンポーネントの場合

```
ComponentName/
├── index.tsx           # メインエクスポート
├── ComponentName.tsx   # コンポーネント本体
├── styles.ts           # Panda CSS スタイル定義
├── types.ts            # 型定義
├── hooks.ts            # カスタムフック
└── ComponentName.test.tsx  # テスト（co-location）
```

### 命名規則

#### ファイル名
- **PascalCase を使用**: `Button.tsx`, `UserProfile.tsx`
- **コンポーネント名とファイル名を一致させる**

#### 例外：shadcn/ui
- shadcn/uiで生成されたコンポーネントはkebab-caseファイル名
- 例: `button.tsx`, `input.tsx`
- これらはそのまま使用し、新規作成するカスタムコンポーネントのみPascalCaseを適用

### Co-location パターン

#### メリット
- 関連するコードが近くにある
- ファイルの検索が容易
- 機能削除時のクリーンアップが簡単

#### 実践例

```
app/
└── users/
    ├── page.tsx
    ├── loading.tsx
    ├── error.tsx
    └── _components/
        ├── UserList/
        │   ├── index.tsx
        │   └── UserListItem.tsx
        └── UserSearchForm/
            └── index.tsx
```

#### `_components` の役割
- アンダースコアプレフィックスはNext.jsのルーティングから除外される
- ページ固有のコンポーネントを整理する場所
- 他のページでは使用しないコンポーネントを格納

## Props設計パターン

### 型定義

#### Props インターフェース

```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}
```

#### デフォルトProps

```typescript
const defaultProps: Partial<ButtonProps> = {
  variant: "primary",
  size: "md",
  disabled: false,
};
```

### イベントハンドリング

#### 命名規則
- `on` + 動詞の命名規則を使用
- 例: `onClick`, `onSubmit`, `onChange`

#### 型定義

```typescript
interface FormProps {
  onSubmit: (data: FormData) => void;
  onChange: (field: string, value: string) => void;
}
```

### 状態管理

#### ローカル状態
- `useState` でローカル状態を管理
- 複雑な状態は `useReducer` を検討

```typescript
const [isOpen, setIsOpen] = useState(false);

// 複雑な状態の場合
const [state, dispatch] = useReducer(reducer, initialState);
```

### エラーハンドリング

#### Error Boundary
- 予期しないエラーをキャッチ
- ユーザーフレンドリーなエラー表示

#### バリデーション
- フォーム入力のバリデーション
- 適切なエラーメッセージの表示

### 実装例

#### 基本的なButtonコンポーネント

```typescript
// index.tsx
export interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}

import { button } from "styled-system/recipes";
import type { ButtonProps } from "./types";

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
}) => {
  return (
    <button
      className={button({ variant, size })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### パフォーマンス

#### メモ化
- `React.memo` で不要な再レンダリングを防止
- `useMemo`, `useCallback` で計算結果をキャッシュ

```typescript
const MemoizedComponent = React.memo(({ data, onClick }) => {
  return <div onClick={onClick}>{data.name}</div>;
});

// useCallbackでコールバックをメモ化
const handleClick = useCallback(() => {
  // 処理
}, [dependency]);
```

#### 遅延読み込み
- `React.lazy` で大きなコンポーネントの遅延読み込み
- `Suspense` で読み込み状態を表示

```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### アクセシビリティ

#### セマンティックHTML
- 適切なHTMLタグを使用
- `aria-*` 属性の適切な使用

```typescript
<button
  aria-label="メニューを開く"
  aria-expanded={isOpen}
>
  <MenuIcon />
</button>
```

#### キーボード操作
- キーボードのみでの操作を可能にする
- フォーカス管理の実装

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleClick();
  }
};
```

## スタイリングガイド（Tailwind CSS）

### 基本的な使い方

#### Tailwind CSS の使用
- Tailwind CSS v4 のユーティリティクラスを使用してスタイルを定義
- CSS変数（globals.css）でデザイントークンを管理
- shadcn/ui のコンポーネントを活用

```typescript
// ユーティリティクラスの使用
<div className="flex items-center gap-4 rounded-lg bg-white p-6 shadow-md">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
</div>
```

### cva によるバリアント管理

#### 基本的な使用方法

```typescript
import { cva } from "class-variance-authority";
import { cn } from "@repo/ui/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
```

### クラス名の結合

#### cn（className）ユーティリティの使用

```typescript
import { cn } from "@repo/ui/utils";

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("border rounded-lg p-4", className)}>
      {children}
    </div>
  );
}
```

#### 条件付きスタイル

```typescript
import { cn } from "@repo/ui/utils";

export function Button({ isActive, className }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-md",
        isActive ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900",
        className
      )}
    >
      Click me
    </button>
  );
}
```

### レスポンシブデザイン

#### ブレークポイント

```typescript
<div className="text-sm p-2 md:text-base md:p-4 lg:text-lg lg:p-6">
  レスポンシブコンテンツ
</div>
```

#### カスタムブレークポイント
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1440px

### ダークモード対応

```typescript
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  テーマ対応コンテンツ
</div>
```

### ベストプラクティス

#### 1. デザイントークンの活用
- `globals.css` で定義されたCSS変数を使用
- shadcn/ui のカラートークンを活用（`text-primary`, `bg-muted` 等）

#### 2. shadcn/ui コンポーネントを優先
- 既存の shadcn/ui コンポーネントを優先的に使用
- カスタムが必要な場合のみ cva で独自バリアントを定義

#### 3. スタイルの一貫性
- プロジェクト全体で同じTailwindユーティリティパターンを使用
- カラーパレット、スペーシングの統一

## 関連ドキュメント

- `docs/einja/steering/development/coding-standards.md` - コーディング規約
- `docs/einja/steering/development/testing-strategy.md` - テスト戦略
- `docs/einja/steering/development/frontend-development.md` - フロントエンド開発ガイド

## 参考資料

- [React 公式ドキュメント](https://react.dev)
- [TypeScript 公式ドキュメント](https://www.typescriptlang.org)
- [Tailwind CSS ドキュメント](https://tailwindcss.com)

<!-- @einja:project-private:start id="component-design-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
