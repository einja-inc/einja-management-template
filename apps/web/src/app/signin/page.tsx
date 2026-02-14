"use client";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // redirect: falseで手動リダイレクト制御
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("SignIn result:", result);

      if (result?.error) {
        console.error("SignIn error:", result.error);
        setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      } else if (result?.ok) {
        console.log("SignIn successful, redirecting to dashboard");
        // ログイン成功時に手動でダッシュボードにリダイレクト
        router.push("/dashboard");
        router.refresh(); // セッション情報を確実に更新
      } else {
        console.warn("Unexpected signIn result:", result);
        setError("ログインの結果が不明です。");
      }
    } catch (_error) {
      setError("ログイン中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* ロゴ・ヘッダー部分 */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 text-center">Einja Management</h1>
        </div>

        {/* ログインカード */}
        <Card className="shadow-2xl border-none bg-white/90 backdrop-blur">
          <CardHeader className="flex flex-col gap-2 items-center p-6">
            <CardTitle className="text-2xl font-semibold text-gray-800">ログイン</CardTitle>
            <CardDescription className="text-gray-600 text-center">
              アカウントにログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 text-sm border-2 border-gray-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 text-sm border-2 border-gray-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 text-center w-full">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-br from-blue-600 to-purple-600 border-none rounded-md text-white text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px hover:shadow-lg active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "ログイン中..." : "ログイン"}
              </Button>
            </form>

            {/* サインアップリンク */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                アカウントをお持ちでない方は{" "}
                <Link href="/signup" className="text-blue-600 font-medium hover:underline">
                  アカウント作成
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
