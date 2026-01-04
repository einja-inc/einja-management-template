"use client";

import { Button } from "@/components/ui/button";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import { css } from "../../../styled-system/css";
import { hstack, vstack } from "../../../styled-system/patterns";

interface HeaderProps {
  user:
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
      }
    | undefined;
  onMobileMenuToggle?: () => void;
}

export function Header({ user, onMobileMenuToggle }: HeaderProps) {
  return (
    <header
      className={css({
        background: "white",
        borderBottom: "1px solid {colors.gray.200}",
        boxShadow: "sm",
      })}
    >
      <div
        className={css({
          maxWidth: "7xl",
          margin: "0 auto",
          padding: {
            base: "1rem 1rem",
            md: "1.25rem 1.5rem",
            lg: "1.5rem 2rem",
          },
        })}
      >
        <div
          className={hstack({
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          {/* ロゴ・ブランド */}
          <div className={hstack({ gap: "0.75rem", alignItems: "center" })}>
            {/* Mobile menu button */}
            {onMobileMenuToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMobileMenuToggle}
                className={css({
                  display: { base: "flex", md: "none" },
                  padding: "0.5rem",
                  marginRight: "0.5rem",
                })}
                aria-label="メニューを開く"
              >
                <HamburgerMenuIcon className={css({ width: "1.25rem", height: "1.25rem" })} />
              </Button>
            )}
            <div
              className={css({
                width: "2.5rem",
                height: "2.5rem",
                background: "linear-gradient(135deg, {colors.blue.600}, {colors.purple.600})",
                borderRadius: "md",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <span
                className={css({
                  fontSize: "lg",
                  fontWeight: "bold",
                  color: "white",
                })}
              >
                E
              </span>
            </div>
            <h1
              className={css({
                fontSize: "xl",
                fontWeight: "bold",
                color: "{colors.gray.900}",
              })}
            >
              Einja Management
            </h1>
          </div>

          {/* ユーザー情報 */}
          <div className={hstack({ gap: "1rem", alignItems: "center" })}>
            <div
              className={vstack({
                gap: "0.125rem",
                alignItems: "flex-end",
                display: { base: "none", md: "flex" },
              })}
            >
              {user?.name && (
                <span
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.900}",
                  })}
                >
                  {user.name}
                </span>
              )}
              <span
                className={css({
                  fontSize: "xs",
                  color: "{colors.gray.500}",
                })}
              >
                {user?.email}
              </span>
            </div>

            {/* ユーザーアバター */}
            <div
              className={css({
                width: "2.5rem",
                height: "2.5rem",
                background: user?.image ? "transparent" : "{colors.gray.300}",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              })}
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className={css({
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  })}
                />
              ) : (
                <span
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "{colors.gray.600}",
                  })}
                >
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
