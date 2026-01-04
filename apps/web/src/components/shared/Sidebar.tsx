"use client";

import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DashboardIcon,
  ExitIcon,
  HamburgerMenuIcon,
  HomeIcon,
  PersonIcon,
  TableIcon,
} from "@radix-ui/react-icons";
import { cn } from "@repo/ui/utils";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface SidebarProps {
  className?: string;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const navigationItems = [
  {
    title: "ホーム",
    href: "/",
    icon: HomeIcon,
  },
  {
    title: "ダッシュボード",
    href: "/dashboard",
    icon: DashboardIcon,
  },
  {
    title: "データ管理",
    href: "/data",
    icon: TableIcon,
  },
  {
    title: "プロフィール",
    href: "/profile",
    icon: PersonIcon,
  },
];

export function Sidebar({ className, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    // ローカルストレージから状態を復元（SSR対応）
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const pathname = usePathname();

  // デスクトップの折りたたみ状態をローカルストレージに保存
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isDesktopCollapsed));
  }, [isDesktopCollapsed]);

  const toggleDesktop = () => setIsDesktopCollapsed(!isDesktopCollapsed);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/signin" });
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: サイドメニューのオーバーレイ
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full border-r bg-card text-card-foreground transition-all duration-300 ease-in-out",
          "md:static md:z-auto",
          // Mobile状態
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          // Desktop状態
          isDesktopCollapsed ? "md:w-16" : "md:w-64",
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              {!isDesktopCollapsed && <h2 className="text-lg font-semibold">管理システム</h2>}
              {/* Desktop collapse toggle - integrated in sidebar header */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex"
                onClick={toggleDesktop}
                aria-label={isDesktopCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
              >
                {isDesktopCollapsed ? (
                  <ChevronRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileOpen(false)}
              aria-label="メニューを閉じる"
            >
              <ExitIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    isDesktopCollapsed ? "justify-center" : "gap-3"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                  title={isDesktopCollapsed ? item.title : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {(!isDesktopCollapsed || isMobileOpen) && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer with logout */}
          <div className="border-t p-4">
            <Button
              variant="ghost"
              className={cn(
                "w-full transition-all",
                isDesktopCollapsed ? "justify-center px-2" : "justify-start gap-3"
              )}
              onClick={handleSignOut}
              title={isDesktopCollapsed ? "ログアウト" : undefined}
            >
              <ExitIcon className="h-4 w-4 flex-shrink-0" />
              {(!isDesktopCollapsed || isMobileOpen) && <span>ログアウト</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
