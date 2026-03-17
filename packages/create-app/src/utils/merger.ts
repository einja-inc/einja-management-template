import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, basename } from "node:path";
import type { SyncMetadata, JsonPathsConfig, ConflictStrategy } from "@/types/index.js";
import { mergeJsonWithConflicts as mergeJsonWithConflictsCore } from "@/internal/sync-core/json-merge.js";
import { mergeText3Way as mergeText3WayCore } from "@/internal/sync-core/text-merge.js";
import { ensureDir } from "@/utils/fs.js";
import { mergePackageJsonDependencies } from "@/utils/package-json-merger.js";
import * as logger from "@/utils/logger.js";
import { replacePlaceholders, type TemplateVariables } from "@/generators/template.js";

export interface FileConflict {
  line: number;
  localContent: string;
  templateContent: string;
  keyPath?: string;
}

export interface MergeAndWriteFileResult {
  action: "created" | "merged" | "skipped" | "overwritten" | "conflicted";
  path: string;
  conflicts: FileConflict[];
  templateContent: string;
}

function calculateContentHash(content: string, filePath: string): string {
  return createHash("sha256")
    .update(filePath, "utf-8")
    .update("\0")
    .update(content, "utf-8")
    .digest("hex");
}

function stringifyConflictValue(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

/**
 * マーカーベースのテキストマージを行う
 *
 * @param templateContent - テンプレートファイルの内容
 * @param existingContent - 既存ファイルの内容（存在しない場合はnull）
 * @returns マージ後の内容
 */
export function mergeTextWithMarkers(
  templateContent: string,
  existingContent: string | null
): string {
  // Given: 既存ファイルが存在しない場合
  if (existingContent === null) {
    // When: テンプレートをそのまま使用
    return templateContent;
  }

  // Given: 既存ファイルとテンプレートの両方が存在する場合
  const templateSections = parseMarkers(templateContent);
  const localSections = parseMarkers(existingContent);

  // マーカーがなければ既存優先
  const hasMarkers = templateSections.some(
    (s) => s.type === "managed" || s.type === "project-private"
  );
  if (!hasMarkers) {
    return existingContent;
  }

  // When: ID付きmanaged/project-privateセクションをMapで管理
  const templateManagedById = new Map<string, MarkerSection>();
  const templateProjectPrivateById = new Map<string, MarkerSection>();
  const templateManagedWithoutId: MarkerSection[] = [];
  const processedTemplateIds = new Set<string>();

  for (const section of templateSections) {
    if (section.type === "managed" && section.id) {
      templateManagedById.set(section.id, section);
    } else if (section.type === "managed") {
      templateManagedWithoutId.push(section);
    } else if (section.type === "project-private" && section.id) {
      templateProjectPrivateById.set(section.id, section);
    }
  }

  // When: ローカルセクションを処理（ローカル側の順序を基準にする）
  const result: string[] = [];
  let managedWithoutIdIndex = 0;

  for (const localSection of localSections) {
    if (localSection.type === "managed") {
      const match = localSection.id ? templateManagedById.get(localSection.id) : undefined;
      if (localSection.id && match) {
        // IDマッチ → テンプレートで上書き
        processedTemplateIds.add(localSection.id);
        result.push(match.content);
      } else if (!localSection.id) {
        // IDなし → テンプレートの順序で上書き（残りがあれば使用）
        const noIdMatch = templateManagedWithoutId[managedWithoutIdIndex];
        if (noIdMatch) {
          result.push(noIdMatch.content);
          managedWithoutIdIndex += 1;
        } else {
          result.push(localSection.content);
        }
      }
      // ID付きでテンプレートにマッチなし → 削除（resultに追加しない）
    } else if (localSection.type === "project-private") {
      // project-private: ローカル優先
      if (localSection.id) {
        processedTemplateIds.add(localSection.id);
      }
      result.push(localSection.content);
    } else {
      // unmanaged: ローカル優先
      result.push(localSection.content);
    }
  }

  // When: テンプレートにのみ存在するID付きmanagedセクションを末尾に追加
  for (const [id, section] of templateManagedById) {
    if (!processedTemplateIds.has(id)) {
      // テンプレートにのみ存在するID付きmanagedセクションを追加
      result.push(section.content);
    }
  }

  // When: テンプレートにのみ存在するIDなしmanagedセクションを末尾に追加
  for (const section of templateManagedWithoutId.slice(managedWithoutIdIndex)) {
    result.push(section.content);
  }

  // When: テンプレートにのみ存在するID付きproject-privateセクションを末尾に追加
  for (const [id, section] of templateProjectPrivateById) {
    if (!processedTemplateIds.has(id)) {
      // テンプレートにのみ存在するID付きproject-privateセクションを追加
      result.push(section.content);
    }
  }

  // Then: ファイル先頭の空セクションのみ除去（セクション間の空行は保持）
  const firstElement = result[0];
  if (result.length > 0 && firstElement !== undefined && firstElement.length === 0) {
    result.shift();
  }
  return result.join("\n");
}

/**
 * JSONのディープマージを行う
 *
 * @param templateJson - テンプレートのJSON
 * @param existingJson - 既存のJSON（存在しない場合はnull）
 * @param jsonPaths - managed/project-privateパスの設定
 * @param filePath - ファイルパス（例: "package.json"）
 * @returns マージ後のJSON
 */
export function mergeJson(
  templateJson: Record<string, unknown>,
  existingJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath = "package.json"
): Record<string, unknown> {
  return mergeJsonWithConflicts(templateJson, existingJson, jsonPaths, filePath).result;
}

function mergeJsonWithConflicts(
  templateJson: Record<string, unknown>,
  existingJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath = "package.json",
  baseJson?: Record<string, unknown>
): {
  result: Record<string, unknown>;
  conflicts: FileConflict[];
} {
  const mergeResult = mergeJsonWithConflictsCore(
    templateJson,
    existingJson,
    jsonPaths,
    filePath,
    baseJson,
    {
      missingLocalStrategy: "template",
      projectPrivateStrategy: "merge-missing",
    }
  );

  return {
    result: mergeResult.result,
    conflicts: mergeResult.conflicts.map((conflict) => ({
      line: 0,
      keyPath: conflict.keyPath,
      localContent: stringifyConflictValue(conflict.localValue),
      templateContent: stringifyConflictValue(conflict.templateValue),
    })),
  };
}

/**
 * .einja-sync.json を読み込む
 *
 * @param targetDir - ターゲットディレクトリ
 * @returns メタデータ（存在しない場合はnull）
 */
export async function loadSyncMetadata(targetDir: string): Promise<SyncMetadata | null> {
  const metadataPath = `${targetDir}/.einja-sync.json`;

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(content) as SyncMetadata & {
      jsonPaths?: JsonPathsConfig & { seed?: Record<string, string[]> };
    };

    if (parsed.jsonPaths?.seed && !parsed.jsonPaths["project-private"]) {
      parsed.jsonPaths["project-private"] = parsed.jsonPaths.seed;
      delete parsed.jsonPaths.seed;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * .einja-sync.json を保存する
 *
 * @param targetDir - ターゲットディレクトリ
 * @param metadata - メタデータ
 */
export async function saveSyncMetadata(targetDir: string, metadata: SyncMetadata): Promise<void> {
  const metadataPath = `${targetDir}/.einja-sync.json`;
  ensureDir(dirname(metadataPath));
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

export function buildSyncFileMetadata(content: string, filePath: string) {
  return {
    hash: calculateContentHash(content, filePath),
    syncedAt: new Date().toISOString(),
    baseContent: content,
  };
}

/**
 * package.json の特殊マージ処理
 *
 * @param existingContent - 既存の package.json の内容
 * @param templateContent - テンプレートの package.json の内容
 * @param packageJsonSections - 同期対象のセクション（指定がない場合は全セクション）
 * @returns マージ後の package.json の内容
 */
async function mergePackageJson(
  existingContent: string,
  templateContent: string,
  packageJsonSections?: Array<
    "scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines"
  >
): Promise<string> {
  // Given: JSON をパース
  const existingPkg = JSON.parse(existingContent) as Record<string, unknown>;
  const templatePkg = JSON.parse(templateContent) as Record<string, unknown>;

  // When: 既存の内容をベースにする
  const result = { ...existingPkg };

  // When: scripts をマージ（セクション指定がない、またはscriptsが含まれる場合のみ）
  if (
    (!packageJsonSections || packageJsonSections.includes("scripts")) &&
    templatePkg.scripts &&
    typeof templatePkg.scripts === "object"
  ) {
    result.scripts = {
      ...(existingPkg.scripts && typeof existingPkg.scripts === "object"
        ? existingPkg.scripts
        : {}),
      ...templatePkg.scripts,
    };
  }

  // When: dependencies をバージョン競合処理付きでマージ（セクション指定がない、またはdependenciesが含まれる場合のみ）
  if (
    (!packageJsonSections || packageJsonSections.includes("dependencies")) &&
    templatePkg.dependencies &&
    typeof templatePkg.dependencies === "object"
  ) {
    result.dependencies = await mergePackageJsonDependencies(
      (existingPkg.dependencies && typeof existingPkg.dependencies === "object"
        ? existingPkg.dependencies
        : {}) as Record<string, string>,
      templatePkg.dependencies as Record<string, string>,
      false
    );
  }

  // When: devDependencies をバージョン競合処理付きでマージ（セクション指定がない、またはdevDependenciesが含まれる場合のみ）
  if (
    (!packageJsonSections || packageJsonSections.includes("devDependencies")) &&
    templatePkg.devDependencies &&
    typeof templatePkg.devDependencies === "object"
  ) {
    result.devDependencies = await mergePackageJsonDependencies(
      (existingPkg.devDependencies && typeof existingPkg.devDependencies === "object"
        ? existingPkg.devDependencies
        : {}) as Record<string, string>,
      templatePkg.devDependencies as Record<string, string>,
      false
    );
  }

  // When: engines を完全置換（セクション指定がない、またはenginesが含まれる場合のみ）
  if (
    (!packageJsonSections || packageJsonSections.includes("engines")) &&
    templatePkg.engines &&
    typeof templatePkg.engines === "object"
  ) {
    if (
      existingPkg.engines &&
      JSON.stringify(existingPkg.engines) !== JSON.stringify(templatePkg.engines)
    ) {
      logger.warn("⚠️ engines を置換します:");
      logger.warn(`  既存: ${JSON.stringify(existingPkg.engines)}`);
      logger.warn(`  新規: ${JSON.stringify(templatePkg.engines)}`);
    }
    result.engines = templatePkg.engines;
  }

  // Then: JSON 文字列として返す
  return `${JSON.stringify(result, null, 2)}\n`;
}

/**
 * ファイルマージの実行（テキスト/JSON自動判定）
 *
 * @param templatePath - テンプレートファイルのパス
 * @param targetPath - ターゲットファイルのパス
 * @param syncMetadata - 同期メタデータ
 * @param packageJsonSections - 同期対象のpackage.jsonセクション（指定がない場合は全セクション）
 * @param conflictStrategy - 競合戦略（デフォルト: "merge"）
 * @param templateVariables - テンプレート変数（オプショナル）
 * @returns マージ結果
 */
export async function mergeAndWriteFile(
  templatePath: string,
  targetPath: string,
  syncMetadata: SyncMetadata,
  syncFilePath: string,
  packageJsonSections?: Array<
    "scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines"
  >,
  conflictStrategy: ConflictStrategy = "merge",
  templateVariables?: TemplateVariables
): Promise<MergeAndWriteFileResult> {
  let templateContent = readFileSync(templatePath, "utf-8");

  // テンプレート変数が指定されている場合は置換を実行
  if (templateVariables) {
    templateContent = replacePlaceholders(templateContent, templateVariables);
  }

  const targetExists = existsSync(targetPath);
  const existingContent = targetExists ? readFileSync(targetPath, "utf-8") : null;
  const fileMetadata = syncMetadata.files[syncFilePath];
  const storedBaseContent = fileMetadata?.baseContent;
  const conflicts: FileConflict[] = [];

  // conflictStrategy による早期リターン（ファイルが既に存在する場合のみ）
  if (targetExists && conflictStrategy === "skip") {
    return { action: "skipped", path: targetPath, conflicts, templateContent };
  }
  if (targetExists && conflictStrategy === "overwrite") {
    ensureDir(dirname(targetPath));
    writeFileSync(targetPath, templateContent, "utf-8");
    return { action: "overwritten", path: targetPath, conflicts, templateContent };
  }

  // Given: ファイルがJSONかどうか判定
  const isJsonFile = targetPath.endsWith(".json");
  const isPackageJson = basename(targetPath) === "package.json";

  let mergedContent: string;
  let action: MergeAndWriteFileResult["action"];

  if (!targetExists) {
    mergedContent = templateContent;
    action = "created";
  } else if (isPackageJson && existingContent) {
    try {
      mergedContent = await mergePackageJson(existingContent, templateContent, packageJsonSections);
      action = "merged";
    } catch {
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else if (isJsonFile) {
    try {
      const templateJson = JSON.parse(templateContent) as Record<string, unknown>;
      const existingJson = existingContent
        ? (JSON.parse(existingContent) as Record<string, unknown>)
        : null;
      const baseJson = storedBaseContent
        ? (JSON.parse(storedBaseContent) as Record<string, unknown>)
        : undefined;
      const jsonPaths = syncMetadata.jsonPaths || { managed: {}, "project-private": {} };
      const mergeResult = mergeJsonWithConflicts(
        templateJson,
        existingJson,
        jsonPaths,
        syncFilePath,
        baseJson
      );
      mergedContent = `${JSON.stringify(mergeResult.result, null, 2)}\n`;
      conflicts.push(...mergeResult.conflicts);
      action = mergeResult.conflicts.length > 0 ? "conflicted" : "merged";
    } catch {
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else {
    const currentContent = existingContent ?? "";
    const hasMarkers =
      templateContent.includes("@einja:managed:start") ||
      templateContent.includes("@einja:project-private:start") ||
      currentContent.includes("@einja:managed:start") ||
      currentContent.includes("@einja:project-private:start");

    if (hasMarkers) {
      mergedContent = mergeTextWithMarkers(templateContent, currentContent);
    } else if (storedBaseContent) {
      const mergeResult = mergeText3WayCore(
        storedBaseContent,
        currentContent,
        templateContent,
        "@einja-inc/create-app"
      );
      mergedContent = mergeResult.content;
      conflicts.push(...mergeResult.conflicts);
    } else {
      mergedContent = currentContent;
    }

    if (conflicts.length > 0) {
      action = "conflicted";
    } else if (mergedContent === currentContent) {
      action = "skipped";
    } else {
      action = "merged";
    }
  }

  // Then: ファイルに書き込み
  if (action !== "skipped") {
    ensureDir(dirname(targetPath));
    writeFileSync(targetPath, mergedContent, "utf-8");
  }

  return { action, path: targetPath, conflicts, templateContent };
}

/**
 * マーカーセクションの型定義
 */
interface MarkerSection {
  type: "managed" | "project-private" | "unmanaged";
  startLine: number;
  endLine: number;
  content: string;
  id?: string;
}

/**
 * ファイル内容をパースしてマーカーセクションに分離する
 *
 * @param content - ファイル内容
 * @returns セクション配列
 */
function parseMarkers(content: string): MarkerSection[] {
  const lines = content.split("\n");
  const sections: MarkerSection[] = [];
  let currentType: "managed" | "project-private" | "unmanaged" = "unmanaged";
  let currentStartLine = 1;
  let currentContent: string[] = [];
  let currentId: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const lineNumber = i + 1;

    // Given: マーカー開始を検出
    const startMarker = parseStartMarker(line);
    if (startMarker) {
      if (currentType !== "unmanaged") {
        // Then: 入れ子のマーカーは無視
        currentContent.push(line);
        continue;
      }

      // When: 現在のunmanagedセクションを保存
      if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
          type: "unmanaged",
          startLine: currentStartLine,
          endLine: lineNumber - 1,
          content: currentContent.join("\n"),
        });
      }

      // When: managed/seedセクション開始
      currentType = startMarker.type;
      currentId = startMarker.id;
      currentStartLine = lineNumber;
      currentContent = [line];
    }
    // Given: マーカー終了を検出
    else if (parseEndMarker(line)) {
      if (currentType === "unmanaged") {
        // Then: 対応するstartがない場合は無視
        currentContent.push(line);
        continue;
      }

      // When: マーカー終了行を追加
      currentContent.push(line);

      // When: managed/project-privateセクションを保存
      sections.push({
        type: currentType,
        startLine: currentStartLine,
        endLine: lineNumber,
        content: currentContent.join("\n"),
        id: currentId,
      });

      // When: unmanagedセクション開始
      currentType = "unmanaged";
      currentId = undefined;
      currentStartLine = lineNumber + 1;
      currentContent = [];
    }
    // Given: 通常行
    else {
      currentContent.push(line);
    }
  }

  // Then: 最後のセクションを保存
  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      type: currentType,
      startLine: currentStartLine,
      endLine: lines.length,
      content: currentContent.join("\n"),
      id: currentId,
    });
  }

  return sections;
}

/**
 * 行がマーカー開始かどうかを判定し、種別とIDを返す
 *
 * @param line - 行内容
 * @returns マーカー情報またはnull
 */
function parseStartMarker(
  line: string
): { type: "managed" | "project-private"; id?: string } | null {
  // Markdown managed
  const markdownManagedPattern = /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/;
  let match = line.match(markdownManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || undefined };
  }

  // Markdown project-private
  const markdownProjectPrivatePattern =
    /^<!--\s*@einja:project-private:start(?:\s+id="([^"]+)")?\s*-->$/;
  match = line.match(markdownProjectPrivatePattern);
  if (match) {
    return { type: "project-private", id: match[1] || undefined };
  }

  // Markdown seed (legacy)
  const markdownSeedPattern = /^<!--\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*-->$/;
  match = line.match(markdownSeedPattern);
  if (match) {
    return { type: "project-private", id: match[1] || undefined };
  }

  // YAML/JSON managed
  const yamlManagedPattern = /^\s*#\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || undefined };
  }

  // YAML/JSON project-private
  const yamlProjectPrivatePattern = /^\s*#\s*@einja:project-private:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlProjectPrivatePattern);
  if (match) {
    return { type: "project-private", id: match[1] || undefined };
  }

  // YAML/JSON seed (legacy)
  const yamlSeedPattern = /^\s*#\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlSeedPattern);
  if (match) {
    return { type: "project-private", id: match[1] || undefined };
  }

  return null;
}

/**
 * 行がマーカー終了かどうかを判定し、種別を返す
 *
 * @param line - 行内容
 * @returns マーカー種別またはnull
 */
function parseEndMarker(line: string): "managed" | "project-private" | null {
  // Markdown managed
  if (/^<!--\s*@einja:managed:end\s*-->$/.test(line)) {
    return "managed";
  }

  // Markdown project-private
  if (/^<!--\s*@einja:project-private:end\s*-->$/.test(line)) {
    return "project-private";
  }

  // Markdown seed (legacy)
  if (/^<!--\s*@einja:seed:end\s*-->$/.test(line)) {
    return "project-private";
  }

  // YAML/JSON managed
  if (/^\s*#\s*@einja:managed:end\s*$/.test(line)) {
    return "managed";
  }

  // YAML/JSON project-private
  if (/^\s*#\s*@einja:project-private:end\s*$/.test(line)) {
    return "project-private";
  }

  // YAML/JSON seed (legacy)
  if (/^\s*#\s*@einja:seed:end\s*$/.test(line)) {
    return "project-private";
  }

  return null;
}
