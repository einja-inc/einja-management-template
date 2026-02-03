"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    // バリデーション
    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "登録に失敗しました。";
        const details = data.details ? ` (${data.details})` : "";
        throw new Error(errorMessage + details);
      }

      setSuccess("アカウントが作成されました。サインインページに移動します...");

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Signup frontend error:", error);
      setError(error instanceof Error ? error.message : "登録中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* ロゴ・ヘッダー部分 */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 text-center">Einja Management</h1>
        </div>

        {/* サインアップカード */}
        <Card className="shadow-2xl border-none bg-white/90 backdrop-blur">
          <CardHeader className="flex flex-col gap-2 items-center">
            <CardTitle className="text-2xl font-semibold text-gray-800">アカウント作成</CardTitle>
            <CardDescription className="text-gray-600 text-center">
              新しいアカウントを作成してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  お名前
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="山田 太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 text-sm border-2 border-gray-200 focus:border-green-500 focus:ring-3 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
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
                  className="h-11 text-sm border-2 border-gray-200 focus:border-green-500 focus:ring-3 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8文字以上で入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 text-sm border-2 border-gray-200 focus:border-green-500 focus:ring-3 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  パスワード（確認）
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="パスワードを再入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 text-sm border-2 border-gray-200 focus:border-green-500 focus:ring-3 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 text-center w-full">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 text-center w-full">
                  {success}
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-br from-green-600 to-blue-600 border-none rounded-md text-white text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px hover:shadow-lg active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "アカウント作成中..." : "アカウント作成"}
              </Button>
            </form>

            {/* サインインリンク */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                既にアカウントをお持ちですか？{" "}
                <Link href="/signin" className="text-blue-600 font-medium hover:underline">
                  サインイン
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
