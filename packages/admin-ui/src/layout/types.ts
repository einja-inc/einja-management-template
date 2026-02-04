import type { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  url?: string;
  icon?: LucideIcon;
  badge?: string;
  isActive?: boolean;
  items?: NavSubItem[];
}

export interface NavSubItem {
  title: string;
  url: string;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}
