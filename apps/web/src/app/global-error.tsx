"use client";

import { css } from "@/styled-system/css";
import { flex } from "@/styled-system/patterns";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorPageProps) {
  const handleHomeClick = () => {
    window.location.href = "/";
  };

  return (
    <html lang="ja">
      <body>
        <div
          className={css({
            minH: "100vh",
            display: "flex",
            flexDir: "column",
            alignItems: "center",
            justifyContent: "center",
            p: "4",
            bg: "gray.50",
          })}
        >
          <div
            className={css({
              textAlign: "center",
            })}
          >
            <h1 className={css({ mb: "4" })}>システムエラー</h1>
            <p
              className={css({
                color: "gray.600",
                mb: "8",
                fontSize: "lg",
              })}
            >
              申し訳ありません。システムエラーが発生しました。
            </p>
            <div className={flex({ gap: "4", justify: "center" })}>
              <button
                type="button"
                onClick={reset}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: "6",
                  py: "3",
                  bg: "blue.500",
                  color: "white",
                  fontWeight: "semibold",
                  rounded: "md",
                  _hover: { bg: "blue.600" },
                  _active: { bg: "blue.700" },
                  transition: "all 0.2s",
                })}
              >
                もう一度試す
              </button>
              <button
                type="button"
                onClick={handleHomeClick}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: "6",
                  py: "3",
                  border: "1px solid",
                  borderColor: "blue.500",
                  color: "blue.500",
                  fontWeight: "semibold",
                  rounded: "md",
                  _hover: { bg: "blue.50" },
                  _active: { bg: "blue.100" },
                  transition: "all 0.2s",
                })}
              >
                トップページへ戻る
              </button>
            </div>
            {process.env.NODE_ENV === "development" && (
              <pre
                className={css({
                  mt: "8",
                  p: "4",
                  bg: "gray.100",
                  rounded: "md",
                  textAlign: "left",
                  overflow: "auto",
                  maxW: "full",
                  fontFamily: "mono",
                  fontSize: "sm",
                })}
              >
                {error.message}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
