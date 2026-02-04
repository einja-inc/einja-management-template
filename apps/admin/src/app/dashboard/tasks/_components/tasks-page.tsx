"use client";

import { tasks } from "@/data/tasks";
import { TasksDialogs } from "./tasks-dialogs";
import { TasksPrimaryButtons } from "./tasks-primary-buttons";
import { TasksProvider } from "./tasks-provider";
import { TasksTable } from "./tasks-table";

export function TasksPage() {
  return (
    <TasksProvider>
      <div className="flex flex-1 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
            <p className="text-muted-foreground">
              Here&apos;s a list of your tasks for this month!
            </p>
          </div>
          <TasksPrimaryButtons />
        </div>
        <TasksTable data={tasks} />
      </div>
      <TasksDialogs />
    </TasksProvider>
  );
}
