"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import type { NavGroup } from "../layout/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";

interface CommandMenuProps {
  navGroups: NavGroup[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface FlatNavItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  group: string;
  parentTitle?: string;
}

function CommandMenu({ navGroups, open: controlledOpen, onOpenChange }: CommandMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  // 制御されている場合は親の状態、そうでない場合は内部状態を使用
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (onOpenChange) {
          onOpenChange(!open);
        } else {
          setInternalOpen((prev) => !prev);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router]
  );

  const handleThemeChange = React.useCallback(
    (theme: string) => {
      setOpen(false);
      setTheme(theme);
    },
    [setTheme]
  );

  // navGroupsをフラット化して全てのページをリストアップ
  const flatItems = React.useMemo(() => {
    const items: FlatNavItem[] = [];

    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.url) {
          // 直接URLを持つアイテム
          items.push({
            title: item.title,
            url: item.url,
            icon: item.icon,
            group: group.title,
          });
        }
        // サブアイテムがある場合
        if (item.items && item.items.length > 0) {
          item.items.forEach((subItem) => {
            items.push({
              title: subItem.title,
              url: subItem.url,
              icon: item.icon,
              group: group.title,
              parentTitle: item.title,
            });
          });
        }
      });
    });

    return items;
  }, [navGroups]);

  // グループごとに整理
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, FlatNavItem[]>();

    flatItems.forEach((item) => {
      const key = item.group;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });

    return Array.from(groups.entries());
  }, [flatItems]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* ページナビゲーション */}
        {groupedItems.map(([groupTitle, items], index) => (
          <React.Fragment key={groupTitle}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={groupTitle}>
              {items.map((item) => {
                const displayTitle = item.parentTitle
                  ? `${item.parentTitle} > ${item.title}`
                  : item.title;

                return (
                  <CommandItem
                    key={item.url}
                    value={`${groupTitle} ${displayTitle}`}
                    onSelect={() => handleSelect(item.url)}
                  >
                    {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                    <span>{displayTitle}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}

        {/* テーマ切り替え */}
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem value="theme light" onSelect={() => handleThemeChange("light")}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light</span>
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => handleThemeChange("dark")}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark</span>
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => handleThemeChange("system")}>
            <Monitor className="mr-2 h-4 w-4" />
            <span>System</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export { CommandMenu };
export type { CommandMenuProps };
