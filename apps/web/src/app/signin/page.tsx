"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { center, vstack } from "../../../styled-system/patterns";

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
    } catch (error) {
      setError("ログイン中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={css({
        minHeight: "100vh",
        background: "linear-gradient(135deg, {colors.blue.50} 0%, {colors.purple.50} 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      })}
    >
      <div
        className={css({
          width: "100%",
          maxWidth: "md",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        })}
      >
        {/* ロゴ・ヘッダー部分 */}
        <div className={center({ flexDirection: "column", gap: "1rem" })}>
          <div
            className={css({
              width: "4rem",
              height: "4rem",
              background: "linear-gradient(135deg, {colors.blue.600}, {colors.purple.600})",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "lg",
            })}
          >
            <span
              className={css({
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "white",
              })}
            >
              E
            </span>
          </div>
          <h1
            className={css({
              fontSize: "2xl",
              fontWeight: "bold",
              color: "{colors.gray.800}",
              textAlign: "center",
            })}
          >
            Einja Management
          </h1>
        </div>

        {/* ログインカード */}
        <Card
          className={css({
            boxShadow: "2xl",
            border: "none",
            background: "white/90",
            backdropFilter: "blur(10px)",
          })}
        >
          <CardHeader
            className={vstack({
              gap: "0.5rem",
              alignItems: "center",
              padding: "1.5rem",
            })}
          >
            <CardTitle
              className={css({
                fontSize: "1.5rem",
                fontWeight: "semibold",
                color: "{colors.gray.800}",
              })}
            >
              ログイン
            </CardTitle>
            <CardDescription
              className={css({
                color: "{colors.gray.600}",
                textAlign: "center",
              })}
            >
              アカウントにログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent className={css({ padding: "1.5rem", paddingTop: "0" })}>
            <form onSubmit={handleSubmit} className={vstack({ gap: "1.5rem" })}>
              <div className={vstack({ gap: "0.5rem", width: "100%" })}>
                <Label
                  htmlFor="email"
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.700}",
                  })}
                >
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
                  className={css({
                    height: "2.75rem",
                    fontSize: "sm",
                    border: "2px solid {colors.gray.200}",
                    _focus: {
                      borderColor: "{colors.blue.500}",
                      boxShadow: "0 0 0 3px {colors.blue.100}",
                    },
                    _disabled: {
                      opacity: 0.6,
                      cursor: "not-allowed",
                    },
                  })}
                />
              </div>
              <div className={vstack({ gap: "0.5rem", width: "100%" })}>
                <Label
                  htmlFor="password"
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.700}",
                  })}
                >
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
                  className={css({
                    height: "2.75rem",
                    fontSize: "sm",
                    border: "2px solid {colors.gray.200}",
                    _focus: {
                      borderColor: "{colors.blue.500}",
                      boxShadow: "0 0 0 3px {colors.blue.100}",
                    },
                    _disabled: {
                      opacity: 0.6,
                      cursor: "not-allowed",
                    },
                  })}
                />
              </div>
              {error && (
                <div
                  className={css({
                    padding: "0.75rem",
                    background: "{colors.red.50}",
                    border: "1px solid {colors.red.200}",
                    borderRadius: "md",
                    fontSize: "sm",
                    color: "{colors.red.700}",
                    textAlign: "center",
                    width: "100%",
                  })}
                >
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className={css({
                  width: "100%",
                  height: "2.75rem",
                  background: "linear-gradient(135deg, {colors.blue.600}, {colors.purple.600})",
                  border: "none",
                  borderRadius: "md",
                  color: "white",
                  fontSize: "sm",
                  fontWeight: "medium",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  _hover: {
                    transform: "translateY(-1px)",
                    boxShadow: "lg",
                  },
                  _active: {
                    transform: "translateY(0)",
                  },
                  _disabled: {
                    opacity: 0.6,
                    cursor: "not-allowed",
                    transform: "none",
                  },
                })}
              >
                {isLoading ? "ログイン中..." : "ログイン"}
              </Button>
            </form>

            {/* サインアップリンク */}
            <div
              className={css({
                marginTop: "1.5rem",
                textAlign: "center",
              })}
            >
              <p
                className={css({
                  fontSize: "sm",
                  color: "{colors.gray.600}",
                })}
              >
                アカウントをお持ちでない方は{" "}
                <Link
                  href="/signup"
                  className={css({
                    color: "{colors.blue.600}",
                    fontWeight: "medium",
                    _hover: {
                      textDecoration: "underline",
                    },
                  })}
                >
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
