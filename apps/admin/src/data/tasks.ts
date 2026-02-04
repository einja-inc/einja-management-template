import { faker } from "@faker-js/faker";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Circle,
  CircleOff,
  HelpCircle,
  Timer,
} from "lucide-react";
import { z } from "zod";

// Schema
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  label: z.string(),
  priority: z.string(),
});

export type Task = z.infer<typeof taskSchema>;

// Metadata
export const labels = [
  {
    value: "bug",
    label: "Bug",
  },
  {
    value: "feature",
    label: "Feature",
  },
  {
    value: "documentation",
    label: "Documentation",
  },
];

export const statuses = [
  {
    label: "Backlog",
    value: "backlog" as const,
    icon: HelpCircle,
  },
  {
    label: "Todo",
    value: "todo" as const,
    icon: Circle,
  },
  {
    label: "In Progress",
    value: "in progress" as const,
    icon: Timer,
  },
  {
    label: "Done",
    value: "done" as const,
    icon: CheckCircle,
  },
  {
    label: "Canceled",
    value: "canceled" as const,
    icon: CircleOff,
  },
];

export const priorities = [
  {
    label: "Low",
    value: "low" as const,
    icon: ArrowDown,
  },
  {
    label: "Medium",
    value: "medium" as const,
    icon: ArrowRight,
  },
  {
    label: "High",
    value: "high" as const,
    icon: ArrowUp,
  },
  {
    label: "Critical",
    value: "critical" as const,
    icon: AlertCircle,
  },
];

// Mock data
// Set a fixed seed for consistent data generation
faker.seed(12345);

export const tasks = Array.from({ length: 100 }, () => {
  const statusValues = ["todo", "in progress", "done", "canceled", "backlog"] as const;
  const labelValues = ["bug", "feature", "documentation"] as const;
  const priorityValues = ["low", "medium", "high"] as const;

  return {
    id: `TASK-${faker.number.int({ min: 1000, max: 9999 })}`,
    title: faker.lorem.sentence({ min: 5, max: 15 }),
    status: faker.helpers.arrayElement(statusValues),
    label: faker.helpers.arrayElement(labelValues),
    priority: faker.helpers.arrayElement(priorityValues),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    assignee: faker.person.fullName(),
    description: faker.lorem.paragraph({ min: 1, max: 3 }),
    dueDate: faker.date.future(),
  };
});
