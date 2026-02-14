import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

// UserAvatarコンポーネントをモック
vi.mock("@/components/auth/user-avatar", () => ({
  UserAvatar: () => <div data-testid="user-avatar">UserAvatar</div>,
}));

describe("ホームページ", () => {
  it("管理画面テンプレートのタイトルが表示される", () => {
    render(<Home />);

    expect(screen.getByText("Einja Management Template")).toBeInTheDocument();
    expect(screen.getByText("管理画面テンプレート")).toBeInTheDocument();
  });

  it("技術スタックのセクションが表示される", () => {
    render(<Home />);

    expect(screen.getByText("🚀 技術スタック")).toBeInTheDocument();
    expect(screen.getByText("• Next.js 15 (App Router)")).toBeInTheDocument();
    expect(screen.getByText("• TypeScript (Strict Mode)")).toBeInTheDocument();
  });

  it("主な機能のセクションが表示される", () => {
    render(<Home />);

    expect(screen.getByText("✨ 主な機能")).toBeInTheDocument();
    expect(screen.getByText("• メール・パスワード認証")).toBeInTheDocument();
  });

  it("セットアップ手順が表示される", () => {
    render(<Home />);

    expect(screen.getByText("🔧 セットアップ手順")).toBeInTheDocument();
    expect(screen.getByText("npm install")).toBeInTheDocument();
  });

  it("ナビゲーションリンクが表示される", () => {
    render(<Home />);

    const signupLink = screen.getByRole("link", { name: "新規登録" });
    const signinLink = screen.getByRole("link", { name: "ログイン" });

    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute("href", "/signup");
    expect(signinLink).toBeInTheDocument();
    expect(signinLink).toHaveAttribute("href", "/signin");
  });
});
