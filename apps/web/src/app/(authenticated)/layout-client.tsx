"use client";

import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/header";
import { useState } from "react";

interface AuthenticatedLayoutClientProps {
  children: React.ReactNode;
  user:
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
      }
    | undefined;
}

export function AuthenticatedLayoutClient({ children, user }: AuthenticatedLayoutClientProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} onMobileMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
