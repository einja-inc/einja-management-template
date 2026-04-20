import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";

export default function RootPage() {
  const config = getConfig();
  const firstApp = config.apps[0]?.name ?? "web";
  redirect(`/apps/${firstApp}`);
}
