import { css } from "@/styled-system/css";
import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className={css({
        minH: "100vh",
        display: "flex",
        flexDir: "column",
        alignItems: "center",
        justifyContent: "center",
        p: "4",
        bg: "white",
      })}
    >
      <div
        className={css({
          textAlign: "center",
        })}
      >
        <h1 className={css({ mb: "4" })}>404 - Page Not Found</h1>
        <p
          className={css({
            color: "gray.600",
            mb: "8",
            fontSize: "lg",
          })}
        >
          申し訳ありません。お探しのページが見つかりませんでした。
        </p>
        <Link
          href="/"
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
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
