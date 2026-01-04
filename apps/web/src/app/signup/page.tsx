"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { center, vstack } from "../../../styled-system/patterns";

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
    <div
      className={css({
        minHeight: "100vh",
        background: "linear-gradient(135deg, {colors.green.50} 0%, {colors.blue.50} 100%)",
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
              background: "linear-gradient(135deg, {colors.green.600}, {colors.blue.600})",
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

        {/* サインアップカード */}
        <Card
          className={css({
            boxShadow: "2xl",
            border: "none",
            background: "white/90",
            backdropFilter: "blur(10px)",
          })}
        >
          <CardHeader className={vstack({ gap: "0.5rem", alignItems: "center" })}>
            <CardTitle
              className={css({
                fontSize: "1.5rem",
                fontWeight: "semibold",
                color: "{colors.gray.800}",
              })}
            >
              アカウント作成
            </CardTitle>
            <CardDescription
              className={css({
                color: "{colors.gray.600}",
                textAlign: "center",
              })}
            >
              新しいアカウントを作成してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className={vstack({ gap: "1.5rem" })}>
              <div className={vstack({ gap: "0.5rem", width: "100%" })}>
                <Label
                  htmlFor="name"
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.700}",
                  })}
                >
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
                  className={css({
                    height: "2.75rem",
                    fontSize: "sm",
                    border: "2px solid {colors.gray.200}",
                    _focus: {
                      borderColor: "{colors.green.500}",
                      boxShadow: "0 0 0 3px {colors.green.100}",
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
                      borderColor: "{colors.green.500}",
                      boxShadow: "0 0 0 3px {colors.green.100}",
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
                  placeholder="8文字以上で入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={css({
                    height: "2.75rem",
                    fontSize: "sm",
                    border: "2px solid {colors.gray.200}",
                    _focus: {
                      borderColor: "{colors.green.500}",
                      boxShadow: "0 0 0 3px {colors.green.100}",
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
                  htmlFor="confirmPassword"
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.700}",
                  })}
                >
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
                  className={css({
                    height: "2.75rem",
                    fontSize: "sm",
                    border: "2px solid {colors.gray.200}",
                    _focus: {
                      borderColor: "{colors.green.500}",
                      boxShadow: "0 0 0 3px {colors.green.100}",
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
              {success && (
                <div
                  className={css({
                    padding: "0.75rem",
                    background: "{colors.green.50}",
                    border: "1px solid {colors.green.200}",
                    borderRadius: "md",
                    fontSize: "sm",
                    color: "{colors.green.700}",
                    textAlign: "center",
                    width: "100%",
                  })}
                >
                  {success}
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className={css({
                  width: "100%",
                  height: "2.75rem",
                  background: "linear-gradient(135deg, {colors.green.600}, {colors.blue.600})",
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
                {isLoading ? "アカウント作成中..." : "アカウント作成"}
              </Button>
            </form>

            {/* サインインリンク */}
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
                既にアカウントをお持ちですか？{" "}
                <Link
                  href="/signin"
                  className={css({
                    color: "{colors.blue.600}",
                    fontWeight: "medium",
                    _hover: {
                      textDecoration: "underline",
                    },
                  })}
                >
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
