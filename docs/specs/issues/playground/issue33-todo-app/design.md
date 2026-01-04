# Todoアプリ基本機能 設計書

## 概要

playground環境でのTodoアプリ基本機能（CRUD操作）の技術設計書。
`pnpm task:loop`コマンドの検証用仮想タスクとして、Next.js App Router、Prisma、Panda CSSを使用した実装設計を定義します。

**関連ドキュメント**:
- 要件定義書: [requirements.md](./requirements.md)
- 管理Issue: #32
- 検証用Issue: #33

---

## アーキテクチャ設計

### システム構成

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │           React Components                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │    │
│  │  │ TodoList │ │ TodoItem │ │  TodoForm    │    │    │
│  │  └──────────┘ └──────────┘ └──────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ fetch API
┌─────────────────────────────────────────────────────────┐
│              Next.js App Router                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │           API Route Handlers                     │    │
│  │  /api/todos (GET, POST)                         │    │
│  │  /api/todos/[id] (GET, PUT, DELETE)             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ Prisma Client
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Todo Table                          │    │
│  │  id | title | completed | createdAt | updatedAt │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### ディレクトリ構造

```
playground/todo-app/
├── app/
│   ├── page.tsx                 # メインページ（TodoList表示）
│   ├── layout.tsx               # レイアウト
│   └── api/
│       └── todos/
│           ├── route.ts         # GET /api/todos, POST /api/todos
│           └── [id]/
│               └── route.ts     # GET, PUT, DELETE /api/todos/:id
├── components/
│   ├── TodoList.tsx             # Todo一覧コンポーネント
│   ├── TodoItem.tsx             # 個別Todoコンポーネント
│   └── TodoForm.tsx             # 新規作成フォーム
├── lib/
│   ├── prisma.ts                # Prismaクライアント初期化
│   ├── api.ts                   # API呼び出しユーティリティ
│   └── validation.ts            # バリデーションロジック
├── types/
│   └── todo.ts                  # 型定義
└── prisma/
    └── schema.prisma            # Prismaスキーマ（playground用）
```

---

## データモデル設計

### Prismaスキーマ

```prisma
// playground/todo-app/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Todo {
  id        String   @id @default(cuid())
  title     String   @db.VarChar(255)
  completed Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("todos")
}
```

### 型定義

```typescript
// types/todo.ts

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export interface TodoApiResponse {
  data?: Todo | Todo[];
  error?: string;
}
```

---

## API設計

### エンドポイント一覧

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---------|------|------|-----------|-----------|
| GET | /api/todos | 一覧取得 | - | `200: Todo[]` |
| POST | /api/todos | 新規作成 | `{title, completed?}` | `201: Todo` |
| GET | /api/todos/:id | 単一取得 | - | `200: Todo` |
| PUT | /api/todos/:id | 更新 | `{title?, completed?}` | `200: Todo` |
| DELETE | /api/todos/:id | 削除 | - | `204: No Content` |

### API実装詳細

#### GET /api/todos - 一覧取得

```typescript
// app/api/todos/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: [
        { completed: "asc" },
        { createdAt: "desc" },
      ],
    });
    return NextResponse.json(todos);
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

#### POST /api/todos - 新規作成

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateCreateTodo(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const todo = await prisma.todo.create({
      data: {
        title: body.title,
        completed: body.completed ?? false,
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error("Failed to create todo:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

#### PUT /api/todos/:id - 更新

```typescript
// app/api/todos/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const validation = validateUpdateTodo(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const existingTodo = await prisma.todo.findUnique({ where: { id } });
    if (!existingTodo) {
      return NextResponse.json(
        { error: "Todo not found" },
        { status: 404 }
      );
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.completed !== undefined && { completed: body.completed }),
      },
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error("Failed to update todo:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

#### DELETE /api/todos/:id - 削除

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existingTodo = await prisma.todo.findUnique({ where: { id } });
    if (!existingTodo) {
      return NextResponse.json(
        { error: "Todo not found" },
        { status: 404 }
      );
    }

    await prisma.todo.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

### エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: string;
}

// エラーコード一覧
const ERROR_MESSAGES = {
  TITLE_REQUIRED: "Title is required",
  TITLE_EMPTY: "Title cannot be empty",
  TITLE_TOO_LONG: "Title must be 255 characters or less",
  INVALID_DATA: "Invalid data",
  TODO_NOT_FOUND: "Todo not found",
  INTERNAL_ERROR: "Internal Server Error",
} as const;
```

---

## バリデーション設計

### バリデーション関数

```typescript
// lib/validation.ts

interface ValidationResult {
  success: boolean;
  error?: string;
}

export function validateCreateTodo(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Invalid data" };
  }

  const { title } = data as { title?: unknown };

  if (title === undefined || title === null) {
    return { success: false, error: "Title is required" };
  }

  if (typeof title !== "string") {
    return { success: false, error: "Title must be a string" };
  }

  if (title.trim() === "") {
    return { success: false, error: "Title cannot be empty" };
  }

  if (title.length > 255) {
    return { success: false, error: "Title must be 255 characters or less" };
  }

  return { success: true };
}

export function validateUpdateTodo(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Invalid data" };
  }

  const { title, completed } = data as { title?: unknown; completed?: unknown };

  if (title !== undefined) {
    if (typeof title !== "string") {
      return { success: false, error: "Title must be a string" };
    }
    if (title.trim() === "") {
      return { success: false, error: "Title cannot be empty" };
    }
    if (title.length > 255) {
      return { success: false, error: "Title must be 255 characters or less" };
    }
  }

  if (completed !== undefined && typeof completed !== "boolean") {
    return { success: false, error: "Completed must be a boolean" };
  }

  return { success: true };
}
```

---

## コンポーネント設計

### TodoList コンポーネント

```typescript
// components/TodoList.tsx
"use client";

import { useState, useEffect } from "react";
import { css } from "styled-system/css";
import { TodoItem } from "./TodoItem";
import { TodoForm } from "./TodoForm";
import type { Todo } from "@/types/todo";

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Todo一覧取得
  const fetchTodos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/todos");
      if (!response.ok) throw new Error("Failed to fetch todos");
      const data = await response.json();
      setTodos(data);
    } catch (err) {
      setError("Todoの取得に失敗しました。再試行してください。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  // Todo作成
  const handleCreate = async (title: string) => {
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Failed to create todo");
      const newTodo = await response.json();
      setTodos((prev) => [newTodo, ...prev]);
    } catch (err) {
      setError("Todoの作成に失敗しました。");
    }
  };

  // Todo更新（完了状態切り替え）
  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (!response.ok) throw new Error("Failed to update todo");
      const updatedTodo = await response.json();
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? updatedTodo : t))
      );
    } catch (err) {
      setError("Todoの更新に失敗しました。");
    }
  };

  // Todo削除
  const handleDelete = async (id: string) => {
    if (!window.confirm("このTodoを削除しますか？")) return;

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete todo");
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError("Todoの削除に失敗しました。");
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Todo App</h1>
      <TodoForm onSubmit={handleCreate} />

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={fetchTodos}>再試行</button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : (
        <ul className={styles.list}>
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
          {todos.length === 0 && (
            <li className={styles.empty}>Todoがありません</li>
          )}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: css({
    maxWidth: "600px",
    margin: "0 auto",
    padding: "2rem",
  }),
  title: css({
    fontSize: "2rem",
    fontWeight: "bold",
    marginBottom: "1.5rem",
  }),
  list: css({
    listStyle: "none",
    padding: 0,
  }),
  loading: css({
    textAlign: "center",
    color: "gray.500",
    padding: "2rem",
  }),
  error: css({
    backgroundColor: "red.100",
    color: "red.700",
    padding: "1rem",
    borderRadius: "md",
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  empty: css({
    textAlign: "center",
    color: "gray.500",
    padding: "2rem",
  }),
};
```

### TodoItem コンポーネント

```typescript
// components/TodoItem.tsx
"use client";

import { css } from "styled-system/css";
import type { Todo } from "@/types/todo";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li className={styles.item}>
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          className={styles.checkbox}
          aria-label={`${todo.title}を${todo.completed ? "未完了" : "完了"}にする`}
        />
        <span className={todo.completed ? styles.completedText : styles.text}>
          {todo.title}
        </span>
      </label>
      <button
        onClick={() => onDelete(todo.id)}
        className={styles.deleteButton}
        aria-label={`${todo.title}を削除`}
      >
        削除
      </button>
    </li>
  );
}

const styles = {
  item: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem",
    borderBottom: "1px solid",
    borderColor: "gray.200",
    _hover: {
      backgroundColor: "gray.50",
    },
  }),
  label: css({
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flex: 1,
    cursor: "pointer",
  }),
  checkbox: css({
    width: "1.25rem",
    height: "1.25rem",
    cursor: "pointer",
  }),
  text: css({
    fontSize: "1rem",
  }),
  completedText: css({
    fontSize: "1rem",
    textDecoration: "line-through",
    color: "gray.500",
  }),
  deleteButton: css({
    padding: "0.25rem 0.75rem",
    fontSize: "0.875rem",
    color: "red.600",
    backgroundColor: "transparent",
    border: "1px solid",
    borderColor: "red.300",
    borderRadius: "md",
    cursor: "pointer",
    _hover: {
      backgroundColor: "red.50",
    },
  }),
};
```

### TodoForm コンポーネント

```typescript
// components/TodoForm.tsx
"use client";

import { useState } from "react";
import { css } from "styled-system/css";

interface TodoFormProps {
  onSubmit: (title: string) => void;
}

export function TodoForm({ onSubmit }: TodoFormProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() === "") return;
    onSubmit(title.trim());
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新しいTodoを入力"
        className={styles.input}
        maxLength={255}
        aria-label="新しいTodoのタイトル"
      />
      <button type="submit" className={styles.button}>
        追加
      </button>
    </form>
  );
}

const styles = {
  form: css({
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
  }),
  input: css({
    flex: 1,
    padding: "0.75rem",
    fontSize: "1rem",
    border: "1px solid",
    borderColor: "gray.300",
    borderRadius: "md",
    _focus: {
      outline: "none",
      borderColor: "blue.500",
      boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.3)",
    },
  }),
  button: css({
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: "medium",
    color: "white",
    backgroundColor: "blue.500",
    border: "none",
    borderRadius: "md",
    cursor: "pointer",
    _hover: {
      backgroundColor: "blue.600",
    },
    _disabled: {
      backgroundColor: "gray.300",
      cursor: "not-allowed",
    },
  }),
};
```

---

## テスト設計

### ユニットテスト

```typescript
// __tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateCreateTodo, validateUpdateTodo } from "@/lib/validation";

describe("validateCreateTodo", () => {
  it("有効なデータで成功を返す", () => {
    const result = validateCreateTodo({ title: "テストTodo" });
    expect(result.success).toBe(true);
  });

  it("titleが未指定でエラーを返す", () => {
    const result = validateCreateTodo({});
    expect(result.success).toBe(false);
    expect(result.error).toBe("Title is required");
  });

  it("titleが空文字でエラーを返す", () => {
    const result = validateCreateTodo({ title: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Title cannot be empty");
  });

  it("titleが255文字を超えるとエラーを返す", () => {
    const result = validateCreateTodo({ title: "a".repeat(256) });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Title must be 255 characters or less");
  });
});

describe("validateUpdateTodo", () => {
  it("有効な更新データで成功を返す", () => {
    const result = validateUpdateTodo({ completed: true });
    expect(result.success).toBe(true);
  });

  it("completedが非booleanでエラーを返す", () => {
    const result = validateUpdateTodo({ completed: "invalid" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Completed must be a boolean");
  });
});
```

### コンポーネントテスト

```typescript
// __tests__/TodoItem.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TodoItem } from "@/components/TodoItem";

const mockTodo = {
  id: "1",
  title: "テストTodo",
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TodoItem", () => {
  it("Todoのタイトルが表示される", () => {
    render(
      <TodoItem todo={mockTodo} onToggle={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("テストTodo")).toBeInTheDocument();
  });

  it("チェックボックスクリックでonToggleが呼ばれる", () => {
    const onToggle = vi.fn();
    render(
      <TodoItem todo={mockTodo} onToggle={onToggle} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("削除ボタンクリックでonDeleteが呼ばれる", () => {
    const onDelete = vi.fn();
    render(
      <TodoItem todo={mockTodo} onToggle={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /削除/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("完了済みTodoは取り消し線が表示される", () => {
    const completedTodo = { ...mockTodo, completed: true };
    render(
      <TodoItem todo={completedTodo} onToggle={vi.fn()} onDelete={vi.fn()} />
    );
    const titleElement = screen.getByText("テストTodo");
    expect(titleElement).toHaveStyle("text-decoration: line-through");
  });
});
```

---

## セキュリティ設計

### 入力サニタイゼーション

- Prismaの自動エスケープによるSQLインジェクション対策
- React の自動エスケープによるXSS対策
- Content-Type ヘッダーの検証

### エラーハンドリング

- 本番環境では詳細なエラーメッセージを非表示
- エラーログの適切な出力（console.error）
- ユーザーフレンドリーなエラーメッセージの表示

---

## 受け入れ基準との対応

| AC | 設計箇所 | 実装ファイル |
|----|---------|-------------|
| AC1.1-1.3 | データモデル設計 | prisma/schema.prisma |
| AC2.1-2.3 | API設計（GET） | app/api/todos/route.ts |
| AC3.1-3.4 | API設計（POST） | app/api/todos/route.ts |
| AC4.1-4.4 | API設計（PUT） | app/api/todos/[id]/route.ts |
| AC5.1-5.3 | API設計（DELETE） | app/api/todos/[id]/route.ts |
| AC6.1-6.6 | コンポーネント設計 | components/*.tsx |

---

## 実装順序

### Phase 1: データ層（タスク1.1, 1.2）
1. Prismaスキーマ定義
2. マイグレーション実行
3. Prismaクライアント設定

### Phase 2: API層（タスク2.1）
1. バリデーション関数実装
2. GET /api/todos 実装
3. POST /api/todos 実装
4. PUT /api/todos/:id 実装
5. DELETE /api/todos/:id 実装

### Phase 3: UI層（タスク2.2, 2.3, 3.1）
1. 型定義作成
2. TodoItemコンポーネント実装
3. TodoFormコンポーネント実装
4. TodoListコンポーネント実装
5. API連携・エラーハンドリング
6. ユニットテスト実装
