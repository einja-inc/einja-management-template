import { Button } from "@repo/admin-ui/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "500 - Internal Server Error",
  description: "Something went wrong",
};

export const dynamic = "force-dynamic";

export default function InternalServerErrorPage() {
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">500</h1>
        <span className="font-medium">Oops! Something went wrong {":)"}</span>
        <p className="text-center text-muted-foreground">
          We apologize for the inconvenience. <br /> Please try again later.
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
