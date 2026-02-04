"use client";

import type { Task } from "@/data/tasks";
import useDialogState from "@/hooks/use-dialog-state";
import React, { useState } from "react";

type TasksDialogType = "create" | "update" | "delete" | "import";

type TasksContextType = {
  open: TasksDialogType | null;
  setOpen: (str: TasksDialogType | null) => void;
  currentRow: Task | null;
  setCurrentRow: React.Dispatch<React.SetStateAction<Task | null>>;
};

const TasksContext = React.createContext<TasksContextType | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<TasksDialogType>(null);
  const [currentRow, setCurrentRow] = useState<Task | null>(null);

  return (
    <TasksContext.Provider value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </TasksContext.Provider>
  );
}

export const useTasks = () => {
  const tasksContext = React.useContext(TasksContext);

  if (!tasksContext) {
    throw new Error("useTasks has to be used within <TasksProvider>");
  }

  return tasksContext;
};
