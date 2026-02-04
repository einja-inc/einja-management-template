import type { Metadata } from "next";
import { TasksPage } from "./_components/tasks-page";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Manage your tasks",
};

// Force dynamic rendering to avoid FileList reference in server component
export const dynamic = "force-dynamic";

export default function Page() {
  return <TasksPage />;
}
