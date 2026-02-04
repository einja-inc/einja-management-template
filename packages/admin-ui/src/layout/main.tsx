import type * as React from "react";
import { cn } from "../lib/utils";

interface MainProps extends React.ComponentProps<"main"> {
  fixed?: boolean;
}

function Main({ className, fixed, ...props }: MainProps) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col gap-4 p-4 pt-0",
        fixed && "overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export { Main };
export type { MainProps };
