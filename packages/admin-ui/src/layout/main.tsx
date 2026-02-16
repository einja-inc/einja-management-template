import type * as React from "react";
import { cn } from "../lib/utils";

interface MainProps extends React.ComponentProps<"main"> {
  fixed?: boolean;
}

function Main({ className, fixed, ...props }: MainProps) {
  return (
    <main
      className={cn(
        "px-4 py-6",
        fixed && "flex grow flex-col overflow-hidden",
        className
      )}
      data-layout={fixed ? "fixed" : "auto"}
      {...props}
    />
  );
}

export { Main };
export type { MainProps };
