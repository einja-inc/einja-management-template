# スタイリングガイド（Tailwind CSS）

## 基本的な使い方

### Tailwind CSS の使用
- Tailwind CSS v4 のユーティリティクラスを使用してスタイルを定義
- CSS変数（globals.css）でデザイントークンを管理
- shadcn/ui のコンポーネントを活用

```typescript
// ユーティリティクラスの使用
<div className="flex items-center gap-4 rounded-lg bg-white p-6 shadow-md">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
</div>
```

## cva によるバリアント管理

### 基本的な使用方法

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

## クラス名の結合

### cn（className）ユーティリティの使用

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

### 条件付きスタイル

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

## レスポンシブデザイン

### ブレークポイント

```typescript
<div className="text-sm p-2 md:text-base md:p-4 lg:text-lg lg:p-6">
  レスポンシブコンテンツ
</div>
```

### カスタムブレークポイント
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1440px

## ダークモード対応

```typescript
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  テーマ対応コンテンツ
</div>
```

## ベストプラクティス

### 1. デザイントークンの活用
- `globals.css` で定義されたCSS変数を使用
- shadcn/ui のカラートークンを活用（`text-primary`, `bg-muted` 等）

### 2. shadcn/ui コンポーネントを優先
- 既存の shadcn/ui コンポーネントを優先的に使用
- カスタムが必要な場合のみ cva で独自バリアントを定義

### 3. スタイルの一貫性
- プロジェクト全体で同じTailwindユーティリティパターンを使用
- カラーパレット、スペーシングの統一
