export interface JsonPathsConfig {
  managed: Record<string, string[]>;
  "project-private": Record<string, string[]>;
}

export interface TextConflict {
  line: number;
  localContent: string;
  templateContent: string;
}

export interface TextMergeResult {
  success: boolean;
  content: string;
  conflicts: TextConflict[];
}

export interface JsonConflict {
  keyPath: string;
  baseValue: unknown;
  localValue: unknown;
  templateValue: unknown;
}

export interface JsonMergeResult {
  result: Record<string, unknown>;
  conflicts: JsonConflict[];
}

export interface JsonMergeOptions {
  missingLocalStrategy?: "template" | "exclude-project-private";
  projectPrivateStrategy?: "exclude" | "merge-missing";
}
