"use client";

import { signIn } from "next-auth/react";

interface LoginButtonProps {
  provider?: "credentials"; // | "google" | "github" - add when OAuth is enabled
  children?: React.ReactNode;
  className?: string;
}

export function LoginButton({
  provider = "credentials",
  children,
  className = "",
}: LoginButtonProps) {
  const handleSignIn = async () => {
    await signIn(provider, { callbackUrl: "/" });
  };

  const defaultText = {
    credentials: "Sign in with Email",
    // google: "Sign in with Google", // add when needed
    // github: "Sign in with GitHub", // add when needed
  };

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${className}`}
    >
      {children || defaultText[provider]}
    </button>
  );
}
