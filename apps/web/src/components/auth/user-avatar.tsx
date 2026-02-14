"use client";

import { useSession } from "next-auth/react";
import { LoginButton } from "./login-button";
import { LogoutButton } from "./logout-button";

interface UserAvatarProps {
  className?: string;
}

export function UserAvatar({ className = "" }: UserAvatarProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className={`animate-pulse bg-gray-300 rounded-full w-8 h-8 ${className}`} />;
  }

  if (!session) {
    return (
      <div className={`flex gap-2 ${className}`}>
        <LoginButton provider="credentials" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {session.user?.image && (
        <>
          {/* biome-ignore lint/performance/noImgElement: Next.js Imageへの移行は別タスクで対応 */}
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-8 h-8 rounded-full"
          />
        </>
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium">{session.user?.name || "User"}</span>
        <span className="text-xs text-gray-500">{session.user?.email}</span>
      </div>
      <LogoutButton />
    </div>
  );
}
