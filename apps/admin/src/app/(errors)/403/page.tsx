import { Button } from "@repo/admin-ui/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "403 - Forbidden",
  description: "Access Forbidden",
};

export default function ForbiddenPage() {
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">403</h1>
        <span className="font-medium">Access Forbidden</span>
        <p className="text-center text-muted-foreground">
          You don't have necessary permission <br />
          to view this resource.
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
