import type { Metadata } from "next";
import { AppsPage } from "./_components/apps-page";

export const metadata: Metadata = {
  title: "Apps",
};

export default function Page() {
  return <AppsPage />;
}
