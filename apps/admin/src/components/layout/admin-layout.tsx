"use client";

import { CommandMenu } from "@repo/admin-ui/command-menu";
import { SidebarInset, SidebarProvider } from "@repo/admin-ui/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { navGroups } from "./nav-config";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
      <CommandMenu navGroups={navGroups} />
    </SidebarProvider>
  );
}
