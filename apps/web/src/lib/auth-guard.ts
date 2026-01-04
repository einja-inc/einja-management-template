import { auth } from "@einja/auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";

/**
 * 認証が必要なページコンポーネント用の高階関数
 * セッションを自動的に注入し、未認証時は/signinにリダイレクト
 */
export function withAuth<P extends Record<string, unknown> = Record<string, unknown>>(
  Component: (props: P & { session: Session }) => React.JSX.Element | Promise<React.JSX.Element>
) {
  return async function AuthenticatedComponent(props: P) {
    const session = await auth();

    if (!session) {
      redirect("/signin");
    }

    return React.createElement(Component, { ...props, session });
  };
}

/**
 * 認証チェック用のユーティリティ関数
 * セッションを取得し、ない場合は/signinにリダイレクト
 */
export async function requireAuth() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  return session;
}
