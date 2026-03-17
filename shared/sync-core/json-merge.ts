import type { JsonConflict, JsonMergeOptions, JsonMergeResult, JsonPathsConfig } from "./types.js";

export function mergeJsonWithConflicts(
  templateJson: Record<string, unknown>,
  localJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  baseJson?: Record<string, unknown>,
  options: JsonMergeOptions = {}
): JsonMergeResult {
  const { missingLocalStrategy = "exclude-project-private", projectPrivateStrategy = "exclude" } =
    options;

  if (!localJson) {
    if (missingLocalStrategy === "template") {
      return {
        result: deepClone(templateJson) as Record<string, unknown>,
        conflicts: [],
      };
    }

    return {
      result: removeProjectPrivateKeys(templateJson, jsonPaths, filePath, ""),
      conflicts: [],
    };
  }

  const conflicts: JsonConflict[] = [];
  const result = deepMergeWithPaths(
    templateJson,
    localJson,
    jsonPaths,
    filePath,
    "",
    conflicts,
    baseJson,
    projectPrivateStrategy
  );

  return { result, conflicts };
}

export function mergeJson(
  templateJson: Record<string, unknown>,
  localJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  baseJson?: Record<string, unknown>,
  options: JsonMergeOptions = {}
): Record<string, unknown> {
  return mergeJsonWithConflicts(templateJson, localJson, jsonPaths, filePath, baseJson, options)
    .result;
}

function removeProjectPrivateKeys(
  template: Record<string, unknown>,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  currentPath: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    if (isPathProjectPrivate(filePath, keyPath, jsonPaths)) {
      continue;
    }

    if (isObject(value)) {
      result[key] = removeProjectPrivateKeys(
        value as Record<string, unknown>,
        jsonPaths,
        filePath,
        keyPath
      );
      continue;
    }

    result[key] = deepClone(value);
  }

  return result;
}

function deepMergeWithPaths(
  template: Record<string, unknown>,
  existing: Record<string, unknown>,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  currentPath: string,
  conflicts: JsonConflict[],
  base?: Record<string, unknown>,
  projectPrivateStrategy: "exclude" | "merge-missing" = "exclude"
): Record<string, unknown> {
  const result = deepClone(existing) as Record<string, unknown>;

  for (const [key, templateValue] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;

    if (isPathManaged(filePath, keyPath, jsonPaths)) {
      result[key] = deepClone(templateValue);
      continue;
    }

    const localValue = existing[key];
    const baseValue = base ? base[key] : undefined;
    const localExists = key in existing;
    const baseExists = base != null && key in base;

    if (isPathProjectPrivate(filePath, keyPath, jsonPaths)) {
      if (projectPrivateStrategy === "exclude") {
        continue;
      }

      if (isObject(templateValue) && isObject(localValue)) {
        result[key] = deepMergeWithPaths(
          templateValue as Record<string, unknown>,
          localValue as Record<string, unknown>,
          jsonPaths,
          filePath,
          keyPath,
          conflicts,
          undefined,
          projectPrivateStrategy
        );
      } else if (!localExists) {
        result[key] = deepClone(templateValue);
      }
      continue;
    }

    if (base) {
      if (!localExists) {
        if (!baseExists) {
          result[key] = deepClone(templateValue);
        } else {
          const templateChanged = !deepEqual(baseValue, templateValue);
          if (templateChanged) {
            conflicts.push({ keyPath, baseValue, localValue: undefined, templateValue });
          }
        }
        continue;
      }

      if (isObject(templateValue) && isObject(localValue)) {
        result[key] = deepMergeWithPaths(
          templateValue as Record<string, unknown>,
          localValue as Record<string, unknown>,
          jsonPaths,
          filePath,
          keyPath,
          conflicts,
          baseExists && isObject(baseValue) ? (baseValue as Record<string, unknown>) : undefined,
          projectPrivateStrategy
        );
        continue;
      }

      const localChanged = !deepEqual(baseValue, localValue);
      const templateChanged = !deepEqual(baseValue, templateValue);

      if (!localChanged && templateChanged) {
        result[key] = deepClone(templateValue);
      } else if (localChanged && templateChanged && !deepEqual(localValue, templateValue)) {
        conflicts.push({ keyPath, baseValue, localValue, templateValue });
      }
      continue;
    }

    if (!localExists) {
      result[key] = deepClone(templateValue);
    } else if (isObject(templateValue) && isObject(localValue)) {
      result[key] = deepMergeWithPaths(
        templateValue as Record<string, unknown>,
        localValue as Record<string, unknown>,
        jsonPaths,
        filePath,
        keyPath,
        conflicts,
        undefined,
        projectPrivateStrategy
      );
    }
  }

  if (base) {
    for (const [key, baseValue] of Object.entries(base)) {
      if (key in template) {
        continue;
      }

      const keyPath = currentPath ? `${currentPath}.${key}` : key;
      if (
        isPathManaged(filePath, keyPath, jsonPaths) ||
        isPathProjectPrivate(filePath, keyPath, jsonPaths)
      ) {
        continue;
      }

      const localExists = key in existing;
      if (!localExists) {
        continue;
      }

      const localValue = existing[key];
      if (deepEqual(baseValue, localValue)) {
        delete result[key];
      } else {
        conflicts.push({
          keyPath,
          baseValue,
          localValue,
          templateValue: undefined,
        });
      }
    }
  }

  return result;
}

function isPathManaged(filePath: string, keyPath: string, jsonPaths: JsonPathsConfig): boolean {
  const managedPaths = jsonPaths.managed[filePath] || [];
  return managedPaths.some((path) => keyPath === path || keyPath.startsWith(`${path}.`));
}

function isPathProjectPrivate(
  filePath: string,
  keyPath: string,
  jsonPaths: JsonPathsConfig
): boolean {
  const projectPrivatePaths = jsonPaths["project-private"][filePath] || [];
  return projectPrivatePaths.some((path) => keyPath === path || keyPath.startsWith(`${path}.`));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
