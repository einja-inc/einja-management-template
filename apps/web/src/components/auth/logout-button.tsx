"use client";

import { signOut } from "next-auth/react";

interface LogoutButtonProps {
  children?: React.ReactNode;
  className?: string;
}

export function LogoutButton({ children = "Sign out", className = "" }: LogoutButtonProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
