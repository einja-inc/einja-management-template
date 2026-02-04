import { Button } from "@repo/admin-ui/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "401 - Unauthorized",
  description: "Unauthorized Access",
};

export default function UnauthorizedPage() {
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight">401</h1>
        <span className="font-medium">Unauthorized Access</span>
        <p className="text-center text-muted-foreground">
          Please log in with the appropriate credentials <br /> to access this resource.
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
