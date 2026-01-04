import { auth } from "@einja/auth";
import { redirect } from "next/navigation";
import { AuthenticatedLayoutClient } from "./layout-client";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  return <AuthenticatedLayoutClient user={session.user}>{children}</AuthenticatedLayoutClient>;
}
