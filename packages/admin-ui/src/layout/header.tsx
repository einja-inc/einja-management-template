"use client";

import type * as React from "react";
import { SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";

interface HeaderProps extends React.ComponentProps<"header"> {
  children?: React.ReactNode;
}

function Header({ className, children, ...props }: HeaderProps) {
  const handleOpenCommand = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
      </div>
      <div className="flex flex-1 items-center justify-between">
        <Button
          variant="outline"
          className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-64 lg:w-96"
          onClick={handleOpenCommand}
        >
          <Search className="mr-2 h-4 w-4" />
          <span>Search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        {children}
      </div>
    </header>
  );
}

export { Header };
export type { HeaderProps };
