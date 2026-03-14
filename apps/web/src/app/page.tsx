import { UserAvatar } from "@/components/auth/user-avatar";
import Link from "next/link";
import React from "react";

export default function Home() {
  return (
    <main
      className="min-h-screen p-4 md:p-8 text-white"
      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
    >
      <header className="mb-6 md:mb-12">
        <nav className="flex justify-between items-center p-4 md:p-6 bg-white/10 rounded-lg backdrop-blur">
          <h1 className="text-xl md:text-2xl font-bold">Einja Management Template</h1>
          <UserAvatar />
        </nav>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <section className="text-center mb-8 md:mb-12">
          <h2
            className="text-2xl md:text-4xl font-bold mb-4"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
          >
            管理画面テンプレート
          </h2>
          <p className="text-lg md:text-xl opacity-90 leading-relaxed">
            Next.js 16 + TypeScript + Tailwind CSS + NextAuth を使用した
            <br />
            モダンな管理画面テンプレートです
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-12">
          <div className="bg-white/10 p-4 md:p-6 rounded-lg backdrop-blur">
            <h3 className="text-lg md:text-xl font-semibold mb-3">🚀 技術スタック</h3>
            <ul className="text-sm leading-relaxed opacity-90">
              <li>• Next.js 16 (App Router)</li>
              <li>• TypeScript (Strict Mode)</li>
              <li>• Tailwind CSS</li>
              <li>• NextAuth v5 (認証)</li>
              <li>• Prisma ORM + PostgreSQL</li>
              <li>• shadcn/ui コンポーネント</li>
              <li>• Biome (Linting & Formatting)</li>
            </ul>
          </div>

          <div className="bg-white/10 p-4 md:p-6 rounded-lg backdrop-blur">
            <h3 className="text-lg md:text-xl font-semibold mb-3">✨ 主な機能</h3>
            <ul className="text-sm leading-relaxed opacity-90">
              <li>• メール・パスワード認証</li>
              <li>• ユーザー登録・ログイン</li>
              <li>• 認証保護されたダッシュボード</li>
              <li>• レスポンシブデザイン</li>
              <li>• Docker対応（PostgreSQL）</li>
              <li>• Vercel デプロイ対応</li>
              <li>• 拡張可能なアーキテクチャ</li>
            </ul>
          </div>
        </div>

        <section className="bg-white/10 p-4 md:p-6 rounded-lg backdrop-blur mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold mb-4">🔧 セットアップ手順</h3>
          <div className="text-sm leading-relaxed opacity-90">
            <ol className="list-decimal pl-4 flex flex-col gap-2">
              <li>
                <strong>依存関係のインストール:</strong> <code>npm install</code>
              </li>
              <li>
                <strong>データベース起動:</strong> <code>docker-compose up postgres -d</code>
              </li>
              <li>
                <strong>環境変数設定:</strong> <code>.env.example</code> を <code>.env</code>{" "}
                にコピー
              </li>
              <li>
                <strong>データベースセットアップ:</strong> <code>npm run db:push</code>
              </li>
              <li>
                <strong>開発サーバー起動:</strong> <code>npm run dev</code>
              </li>
            </ol>
          </div>
        </section>

        <div className="flex justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-white text-[#667eea] px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold text-sm md:text-base no-underline transition-all duration-200 shadow-md hover:-translate-y-0.5 hover:shadow-lg"
          >
            新規登録
          </Link>
          <Link
            href="/signin"
            className="bg-transparent text-white px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold text-sm md:text-base no-underline border-2 border-white transition-all duration-200 hover:bg-white hover:text-[#667eea] hover:-translate-y-0.5"
          >
            ログイン
          </Link>
          <Link
            href="/dashboard"
            className="bg-white/20 text-white px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold text-sm md:text-base no-underline border border-white/30 transition-all duration-200 hover:bg-white/30 hover:-translate-y-0.5"
          >
            デモを見る
          </Link>
        </div>
      </div>
    </main>
  );
}
