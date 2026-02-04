"use client";

import { cn } from "@repo/admin-ui/lib/utils";
import { Input } from "@repo/admin-ui/ui/input";
import { Search } from "lucide-react";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input type="search" className="pl-8" {...props} />
    </div>
  );
}
