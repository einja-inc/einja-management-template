import * as fs from "node:fs";
import * as path from "node:path";
import { getConfig, getMonorepoRoot } from "./config";
import { extractMarkdownTitle, segmentToLabel } from "./path-utils";
import type {
  AppRoutes,
  DocFile,
  IntegrationTestFile,
  IssueSpec,
  RouteNode,
  ScanResult,
} from "./types";

function sanitizePath(slugParts: string[]): string | null {
  const joined = slugParts.join("/");
  if (joined.includes("..") || joined.includes("~")) {
    return null;
  }
  const normalized = path.normalize(joined);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }
  return normalized;
}

export type { RouteNode, DocFile, IntegrationTestFile, IssueSpec, ScanResult };

let cache: ScanResult | null = null;

/** Strip brackets from dynamic segments: [id] → id, [...slug] → slug */
function stripBrackets(name: string): string {
  return name
    .replace(/^\[\.\.\./, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "");
}

function buildRouteTree(
  dirPath: string,
  routePrefix: string,
  webAppDir?: string,
  qaTestDir?: string,
): RouteNode[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: RouteNode[] = [];

  // Collect spec file names to suppress duplicate directory entries
  const specDir = path.join(dirPath, "spec");
  const specFileNames = new Set<string>();
  if (fs.existsSync(specDir) && fs.statSync(specDir).isDirectory()) {
    for (const f of fs.readdirSync(specDir)) {
      if (f.endsWith(".md")) specFileNames.add(f.replace(/\.md$/, ""));
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    if (entry.name === "api") continue;
    // Skip route groups like (viewer) - they are layout-only
    if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
      const groupChildren = buildRouteTree(
        path.join(dirPath, entry.name),
        routePrefix,
        webAppDir,
        qaTestDir,
      );
      result.push(...groupChildren);
      continue;
    }

    const childDir = path.join(dirPath, entry.name);
    // Use bracket-stripped name for URL segments
    const segment = stripBrackets(entry.name);
    const routePath = routePrefix ? `${routePrefix}/${segment}` : segment;

    // "spec" directory: expose each .md file as a leaf node
    if (entry.name === "spec") {
      const specEntries = fs.readdirSync(childDir, { withFileTypes: true });
      for (const specEntry of specEntries) {
        if (specEntry.isFile() && specEntry.name.endsWith(".md")) {
          const specName = specEntry.name.replace(/\.md$/, "");
          const specRoutePath = routePrefix
            ? `${routePrefix}/spec/${specName}`
            : `spec/${specName}`;
          // Tab spec QA test: {qaTestDir}/{relDir}/{specName}.test.md
          let hasQATest = false;
          if (qaTestDir && webAppDir) {
            const relDir = path.relative(webAppDir, dirPath);
            const testPath = path.join(
              qaTestDir,
              relDir,
              `${specName}.test.md`,
            );
            hasQATest = fs.existsSync(testPath);
          }
          result.push({
            segment: specName,
            routePath: specRoutePath,
            hasSpecMd: true,
            hasPageTsx: false,
            hasQATest,
            children: [],
          });
        }
      }
      continue;
    }

    const hasSpecMd = fs.existsSync(path.join(childDir, "spec.md"));
    const hasPageTsx = fs.existsSync(path.join(childDir, "page.tsx"));
    const children = buildRouteTree(childDir, routePath, webAppDir, qaTestDir);

    // Skip directories that duplicate a spec file name, only when they have no spec.md, no page.tsx, and no children
    if (
      specFileNames.has(entry.name) &&
      !hasSpecMd &&
      !hasPageTsx &&
      children.length === 0
    )
      continue;

    // Route spec QA test: {qaTestDir}/{relDir}/test.md
    let hasQATest = false;
    if (qaTestDir && webAppDir) {
      const relDir = path.relative(webAppDir, childDir);
      const testPath = path.join(qaTestDir, relDir, "test.md");
      hasQATest = fs.existsSync(testPath);
    }

    result.push({
      segment,
      routePath,
      hasSpecMd,
      hasPageTsx,
      hasQATest,
      children,
    });
  }

  return result;
}

function scanDocs(docsDir: string): DocFile[] {
  if (!fs.existsSync(docsDir)) return [];

  const result: DocFile[] = [];

  function walk(dir: string, slugPrefix: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith("_")) continue;
      if (entry.name === "screenshots") continue;
      if (
        entry.isDirectory() &&
        slugPrefix[0] === "qa-tests" &&
        (entry.name === "integration" || entry.name === "pages")
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...slugPrefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const slug = [...slugPrefix, entry.name];
        const title = entry.name.replace(/\.md$/, "").replace(/-/g, " ");
        const section = slugPrefix[0] ?? "root";
        result.push({ slug, title, section });
      }
    }
  }

  walk(docsDir, []);
  return result;
}

function scanIntegrationTests(integrationDir: string): IntegrationTestFile[] {
  if (!fs.existsSync(integrationDir)) return [];

  const result: IntegrationTestFile[] = [];
  const entries = fs.readdirSync(integrationDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const filePath = path.join(
      integrationDir,
      entry.name,
      "integration-test.md",
    );
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    result.push({
      slug: [entry.name],
      title: extractMarkdownTitle(content) ?? segmentToLabel(entry.name),
    });
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

function scanIssueSpecs(issueSpecsDir: string): IssueSpec[] {
  if (!fs.existsSync(issueSpecsDir)) return [];
  const result: IssueSpec[] = [];

  function walkIssueDir(dir: string, category: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const issueDir = path.join(dir, entry.name);
      const hasRequirements = fs.existsSync(path.join(issueDir, "requirements.md"));
      const hasDesign = fs.existsSync(path.join(issueDir, "design.md"));
      const hasQATests = fs.existsSync(path.join(issueDir, "qa-tests"));

      if (hasRequirements || hasDesign || hasQATests) {
        // Extract title from requirements.md or use directory name
        let title = segmentToLabel(entry.name);
        if (hasRequirements) {
          const content = fs.readFileSync(path.join(issueDir, "requirements.md"), "utf-8");
          title = extractMarkdownTitle(content) ?? title;
        }
        result.push({
          slug: [category, entry.name],
          title,
          category,
          hasRequirements,
          hasDesign,
          hasQATests,
        });
      }
    }
  }

  const topEntries = fs.readdirSync(issueSpecsDir, { withFileTypes: true });
  for (const entry of topEntries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    // Check if this is a category dir or an issue dir directly
    const subDir = path.join(issueSpecsDir, entry.name);
    const hasRequirements = fs.existsSync(path.join(subDir, "requirements.md"));
    const hasDesign = fs.existsSync(path.join(subDir, "design.md"));
    const hasQATests = fs.existsSync(path.join(subDir, "qa-tests"));

    if (hasRequirements || hasDesign || hasQATests) {
      // This is an issue dir at root level
      let title = segmentToLabel(entry.name);
      if (hasRequirements) {
        const content = fs.readFileSync(path.join(subDir, "requirements.md"), "utf-8");
        title = extractMarkdownTitle(content) ?? title;
      }
      result.push({
        slug: [entry.name],
        title,
        category: "root",
        hasRequirements,
        hasDesign,
        hasQATests,
      });
    } else {
      // This is a category directory, walk its children
      walkIssueDir(subDir, entry.name);
    }
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

export function getScanResult(): ScanResult {
  if (cache) return cache;

  const monorepoRoot = getMonorepoRoot();
  const config = getConfig();

  const appRoutes: AppRoutes[] = config.apps.map((app) => {
    const appDir = path.join(monorepoRoot, app.appDir);
    const qaTestDir = app.qaTestDir
      ? path.join(monorepoRoot, app.qaTestDir)
      : undefined;
    return {
      appName: app.name,
      label: app.label,
      routes: buildRouteTree(appDir, "", appDir, qaTestDir),
    };
  });

  const issueSpecs = scanIssueSpecs(
    path.join(monorepoRoot, config.issueSpecsDir),
  );
  const docsDir = path.join(monorepoRoot, config.docsDir);
  const docs = scanDocs(docsDir);

  const integrationDir = config.integrationTestDir
    ? path.join(monorepoRoot, config.integrationTestDir)
    : undefined;
  const integrationTests = integrationDir
    ? scanIntegrationTests(integrationDir)
    : [];

  cache = { appRoutes, issueSpecs, integrationTests, docs };
  return cache;
}

/**
 * Resolve a URL slug segment to the actual filesystem directory.
 * Tries: literal name, [name], [...name]
 * Rejects segments containing path traversal characters.
 */
function resolveSegment(parentDir: string, segment: string): string | null {
  if (
    !segment ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\")
  ) {
    return null;
  }

  const direct = path.join(parentDir, segment);
  if (fs.existsSync(direct)) return direct;

  const dynamic = path.join(parentDir, `[${segment}]`);
  if (fs.existsSync(dynamic)) return dynamic;

  const catchAll = path.join(parentDir, `[...${segment}]`);
  if (fs.existsSync(catchAll)) return catchAll;

  return null;
}

/** Walk slug parts and resolve each segment against the filesystem. */
function resolveSlugToFsPath(
  basePath: string,
  slugParts: string[],
): string | null {
  let current = basePath;
  for (const segment of slugParts) {
    const resolved = resolveSegment(current, segment);
    if (!resolved) return null;
    current = resolved;
  }
  return current;
}

function isValidAppName(appName: string): boolean {
  return !(!appName || appName.includes("..") || appName.includes("/") || appName.includes("\\"));
}

export function readSpecMd(appName: string, slugParts: string[]): string | null {
  const sanitized = sanitizePath(slugParts);
  if (!sanitized) return null;
  if (!isValidAppName(appName)) return null;

  const monorepoRoot = getMonorepoRoot();
  const basePath = path.join(monorepoRoot, "apps", appName, "src", "app");

  // Try resolving all segments as directories → read spec.md
  const resolvedDir = resolveSlugToFsPath(basePath, slugParts);
  if (resolvedDir) {
    const specPath = path.join(resolvedDir, "spec.md");
    if (fs.existsSync(specPath)) {
      return fs.readFileSync(specPath, "utf-8");
    }
  }

  // Try resolving all-but-last segments, then read {last}.md
  // (for spec directory files like [id]/spec/home.md where "home" is not a directory)
  if (slugParts.length >= 2) {
    const parentParts = slugParts.slice(0, -1);
    const fileName = slugParts[slugParts.length - 1];
    const parentDir = resolveSlugToFsPath(basePath, parentParts);
    if (parentDir) {
      // If fileName already ends with .md (e.g. linked as "spec/payment.md"), try directly
      if (fileName.endsWith(".md")) {
        const mdPath = path.join(parentDir, fileName);
        if (fs.existsSync(mdPath)) {
          return fs.readFileSync(mdPath, "utf-8");
        }
      }
      const mdPath = path.join(parentDir, `${fileName}.md`);
      if (fs.existsSync(mdPath)) {
        return fs.readFileSync(mdPath, "utf-8");
      }
    }
  }

  return null;
}

export function readQATestMd(appName: string, slugParts: string[]): string | null {
  const sanitized = sanitizePath(slugParts);
  if (!sanitized) return null;
  if (!isValidAppName(appName)) return null;

  const monorepoRoot = getMonorepoRoot();
  const config = getConfig();
  const appTarget = config.apps.find((a) => a.name === appName);
  if (!appTarget?.qaTestDir) return null;

  const qaTestDir = path.join(monorepoRoot, appTarget.qaTestDir);
  const webAppDir = path.join(monorepoRoot, appTarget.appDir);

  const specIndex = slugParts.indexOf("spec");
  if (specIndex !== -1) {
    const dirParts = slugParts.slice(0, specIndex);
    const specName = slugParts[slugParts.length - 1];
    const resolvedDir = resolveSlugToFsPath(webAppDir, dirParts);
    if (!resolvedDir) return null;
    const relDir = path.relative(webAppDir, resolvedDir);
    const testPath = path.join(qaTestDir, relDir, `${specName}.test.md`);
    if (fs.existsSync(testPath)) return fs.readFileSync(testPath, "utf-8");
  } else {
    const resolvedDir = resolveSlugToFsPath(webAppDir, slugParts);
    if (!resolvedDir) return null;
    const relDir = path.relative(webAppDir, resolvedDir);
    const testPath = path.join(qaTestDir, relDir, "test.md");
    if (fs.existsSync(testPath)) return fs.readFileSync(testPath, "utf-8");
  }

  return null;
}

export function readIssueSpecFile(slugParts: string[]): string | null {
  const sanitized = sanitizePath(slugParts);
  if (!sanitized) return null;

  const monorepoRoot = getMonorepoRoot();
  const config = getConfig();
  const basePath = path.join(monorepoRoot, config.issueSpecsDir);

  // slug format: [category, issue-name, filename.md] or [issue-name, filename.md]
  const filePath = path.join(basePath, sanitized);
  if (!filePath.endsWith(".md")) return null;
  if (!fs.existsSync(filePath)) return null;

  return fs.readFileSync(filePath, "utf-8");
}

export function readDocFile(slugParts: string[]): string | null {
  const relativePath = sanitizePath(slugParts);
  if (!relativePath) return null;
  if (!relativePath.endsWith(".md")) return null;

  const monorepoRoot = getMonorepoRoot();
  const docPath = path.join(monorepoRoot, "docs", relativePath);

  if (!fs.existsSync(docPath)) return null;
  return fs.readFileSync(docPath, "utf-8");
}

export function readIntegrationTestFile(slugParts: string[]): string | null {
  const relativePath = sanitizePath(slugParts);
  if (!relativePath) return null;

  const monorepoRoot = getMonorepoRoot();
  const testPath = path.join(
    monorepoRoot,
    "docs",
    "qa-tests",
    "integration",
    relativePath,
    "integration-test.md",
  );

  if (!fs.existsSync(testPath)) return null;
  return fs.readFileSync(testPath, "utf-8");
}
