import { render, screen } from "@testing-library/react";
import type { Session } from "next-auth";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { UserAvatar } from "./user-avatar";

// next-authのuseSessionをモック
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

// LoginButtonコンポーネントをモック
vi.mock("./login-button", () => ({
  LoginButton: () => <button type="button">ログイン</button>,
}));

// LogoutButtonコンポーネントをモック
vi.mock("./logout-button", () => ({
  LogoutButton: () => <button type="button">ログアウト</button>,
}));

describe("UserAvatar", () => {
  it("認証されていない場合ログインボタンを表示", async () => {
    const { useSession } = await import("next-auth/react");
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    render(<UserAvatar />);

    expect(screen.getByText("ログイン")).toBeInTheDocument();
  });

  it("認証されている場合ユーザー情報を表示", async () => {
    const { useSession } = await import("next-auth/react");
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: "テストユーザー",
          email: "test@example.com",
        },
      } as Session,
      status: "authenticated",
      update: vi.fn(),
    });

    render(<UserAvatar />);

    expect(screen.getByText("テストユーザー")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("ローディング状態でローディング表示をする", async () => {
    const { useSession } = await import("next-auth/react");
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });

    const { container } = render(<UserAvatar />);

    const loadingElement = container.querySelector(".animate-pulse");
    expect(loadingElement).toBeInTheDocument();
  });
});
