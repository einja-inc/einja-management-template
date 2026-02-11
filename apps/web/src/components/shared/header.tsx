"use client";

import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import { Button } from "@repo/ui/button";

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
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
        <div className="flex flex-row items-center justify-between">
          {/* ロゴ・ブランド */}
          <div className="flex flex-row items-center gap-3">
            {/* Mobile menu button */}
            {onMobileMenuToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMobileMenuToggle}
                className="flex md:hidden p-2 mr-2"
                aria-label="メニューを開く"
              >
                <HamburgerMenuIcon className="w-5 h-5" />
              </Button>
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Einja Management</h1>
          </div>

          {/* ユーザー情報 */}
          <div className="flex flex-row items-center gap-4">
            <div className="hidden md:flex flex-col gap-0.5 items-end">
              {user?.name && <span className="text-sm font-medium text-gray-900">{user.name}</span>}
              <span className="text-xs text-gray-500">{user?.email}</span>
            </div>

            {/* ユーザーアバター */}
            <div
              className={`w-10 h-10 ${user?.image ? "bg-transparent" : "bg-gray-300"} rounded-full flex items-center justify-center overflow-hidden`}
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600">
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
