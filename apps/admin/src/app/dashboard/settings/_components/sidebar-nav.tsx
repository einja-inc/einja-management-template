"use client";

import { cn } from "@repo/admin-ui/lib/utils";
import { buttonVariants } from "@repo/admin-ui/ui/button";
import { ScrollArea } from "@repo/admin-ui/ui/scroll-area";
import { Bell, Monitor, Palette, UserCog, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarNavItems = [
  {
    title: "Profile",
    href: "/dashboard/settings/profile",
    icon: UserCog,
  },
  {
    title: "Account",
    href: "/dashboard/settings/account",
    icon: Wrench,
  },
  {
    title: "Appearance",
    href: "/dashboard/settings/appearance",
    icon: Palette,
  },
  {
    title: "Notifications",
    href: "/dashboard/settings/notifications",
    icon: Bell,
  },
  {
    title: "Display",
    href: "/dashboard/settings/display",
    icon: Monitor,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <ScrollArea className="h-full w-full">
      <nav className="flex flex-col space-y-1">
        {sidebarNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                pathname === item.href
                  ? "bg-muted hover:bg-muted"
                  : "hover:bg-transparent hover:underline",
                "justify-start"
              )}
            >
              <Icon className="mr-2 size-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
