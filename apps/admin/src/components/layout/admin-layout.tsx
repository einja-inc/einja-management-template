"use client";

import { CommandMenu } from "@repo/admin-ui/command-menu";
import { Header, Main } from "@repo/admin-ui/layout";
import { SidebarProvider } from "@repo/admin-ui/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { navGroups } from "./nav-config";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <Main>{children}</Main>
      </div>
      <CommandMenu navGroups={navGroups} />
    </SidebarProvider>
  );
}
