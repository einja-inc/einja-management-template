import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, basename } from "node:path";
import type { SyncMetadata, JsonPathsConfig } from "../types/index.js";
import { ensureDir } from "./fs.js";
import { mergePackageJsonDependencies } from "./package-json-merger.js";
import * as logger from "./logger.js";

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
    (s) => s.type === "managed" || s.type === "seed"
  );
  if (!hasMarkers) {
    return existingContent;
  }

  // When: ID付きmanaged/seedセクションをMapで管理
  const templateManagedById = new Map<string, MarkerSection>();
  const templateSeedById = new Map<string, MarkerSection>();
  const templateManagedWithoutId: MarkerSection[] = [];
  const processedTemplateIds = new Set<string>();

  for (const section of templateSections) {
    if (section.type === "managed" && section.id) {
      templateManagedById.set(section.id, section);
    } else if (section.type === "managed") {
      templateManagedWithoutId.push(section);
    } else if (section.type === "seed" && section.id) {
      templateSeedById.set(section.id, section);
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
    } else if (localSection.type === "seed") {
      // seed: ローカル優先
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

  // When: テンプレートにのみ存在するID付きseedセクションを末尾に追加
  for (const [id, section] of templateSeedById) {
    if (!processedTemplateIds.has(id)) {
      // テンプレートにのみ存在するID付きseedセクションを追加
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
 * @param jsonPaths - managed/seedパスの設定
 * @param filePath - ファイルパス（例: "package.json"）
 * @returns マージ後のJSON
 */
export function mergeJson(
  templateJson: Record<string, unknown>,
  existingJson: Record<string, unknown> | null,
  jsonPaths: JsonPathsConfig,
  filePath = "package.json"
): Record<string, unknown> {
  // Given: 既存JSONが存在しない場合
  if (existingJson === null) {
    // When: テンプレートをディープコピーして使用
    return JSON.parse(JSON.stringify(templateJson));
  }

  // When: ディープマージを実行
  return deepMergeWithPaths(
    templateJson,
    existingJson,
    jsonPaths,
    filePath,
    ""
  );
}

/**
 * パスを考慮したディープマージを行う
 *
 * @param template - テンプレートオブジェクト
 * @param existing - 既存オブジェクト
 * @param jsonPaths - managed/seedパスの設定
 * @param filePath - ファイルパス
 * @param currentPath - 現在のキーパス（例: "scripts.dev"）
 * @returns マージ後のオブジェクト
 */
function deepMergeWithPaths(
  template: Record<string, unknown>,
  existing: Record<string, unknown>,
  jsonPaths: JsonPathsConfig,
  filePath: string,
  currentPath: string
): Record<string, unknown> {
  // 既存オブジェクトをディープコピー（参照を共有しないように）
  const result = JSON.parse(JSON.stringify(existing)) as Record<string, unknown>;

  for (const [key, templateValue] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    const existingValue = existing[key];

    // Given: このパスがmanagedに含まれるか確認
    if (isPathManaged(filePath, keyPath, jsonPaths)) {
      // Then: managedパスはテンプレート値でディープコピーして上書き
      result[key] = deepClone(templateValue);
    }
    // Given: このパスがseedに含まれるか確認
    else if (isPathSeed(filePath, keyPath, jsonPaths)) {
      // Given: seedパスでオブジェクトの場合、子キーもディープマージ
      if (
        typeof templateValue === "object" &&
        templateValue !== null &&
        !Array.isArray(templateValue) &&
        typeof existingValue === "object" &&
        existingValue !== null &&
        !Array.isArray(existingValue)
      ) {
        // Then: seedパス内でもディープマージ（既存にないキーのみ追加）
        result[key] = deepMergeWithPaths(
          templateValue as Record<string, unknown>,
          existingValue as Record<string, unknown>,
          jsonPaths,
          filePath,
          keyPath
        );
      } else if (!(key in existing)) {
        // Then: seedパスはローカル優先（キーが存在しない場合のみディープコピーして追加）
        result[key] = deepClone(templateValue);
      }
      // 既存値がある場合は何もしない（既存値を保持）
    }
    // Given: 両方がオブジェクトの場合
    else if (
      typeof templateValue === "object" &&
      templateValue !== null &&
      !Array.isArray(templateValue) &&
      typeof existingValue === "object" &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      // Then: 再帰的にディープマージ
      result[key] = deepMergeWithPaths(
        templateValue as Record<string, unknown>,
        existingValue as Record<string, unknown>,
        jsonPaths,
        filePath,
        keyPath
      );
    }
    // Given: それ以外のパス（テンプレートにのみ存在する場合）
    else if (!(key in existing)) {
      // Then: テンプレートの値をディープコピーして追加
      result[key] = deepClone(templateValue);
    }
    // 既存値がある場合は何もしない（既存値を保持）
  }

  return result;
}

/**
 * 値をディープコピーする（undefinedも正しく扱う）
 *
 * @param value - コピーする値
 * @returns ディープコピーされた値
 */
function deepClone(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * .einja-sync.json を読み込む
 *
 * @param targetDir - ターゲットディレクトリ
 * @returns メタデータ（存在しない場合はnull）
 */
export async function loadSyncMetadata(
  targetDir: string
): Promise<SyncMetadata | null> {
  const metadataPath = `${targetDir}/.einja-sync.json`;

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, "utf-8");
    return JSON.parse(content) as SyncMetadata;
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
export async function saveSyncMetadata(
  targetDir: string,
  metadata: SyncMetadata
): Promise<void> {
  const metadataPath = `${targetDir}/.einja-sync.json`;
  ensureDir(dirname(metadataPath));
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
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
  packageJsonSections?: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">
): Promise<string> {
  // Given: JSON をパース
  const existingPkg = JSON.parse(existingContent) as Record<string, unknown>;
  const templatePkg = JSON.parse(templateContent) as Record<string, unknown>;

  // When: 既存の内容をベースにする
  const result = { ...existingPkg };

  // When: scripts をマージ（セクション指定がない、またはscriptsが含まれる場合のみ）
  if ((!packageJsonSections || packageJsonSections.includes("scripts")) && templatePkg.scripts && typeof templatePkg.scripts === "object") {
    result.scripts = {
      ...(existingPkg.scripts && typeof existingPkg.scripts === "object"
        ? existingPkg.scripts
        : {}),
      ...templatePkg.scripts,
    };
  }

  // When: dependencies をバージョン競合処理付きでマージ（セクション指定がない、またはdependenciesが含まれる場合のみ）
  if ((!packageJsonSections || packageJsonSections.includes("dependencies")) && templatePkg.dependencies && typeof templatePkg.dependencies === "object") {
    result.dependencies = await mergePackageJsonDependencies(
      (existingPkg.dependencies && typeof existingPkg.dependencies === "object"
        ? existingPkg.dependencies
        : {}) as Record<string, string>,
      templatePkg.dependencies as Record<string, string>,
      false
    );
  }

  // When: devDependencies をバージョン競合処理付きでマージ（セクション指定がない、またはdevDependenciesが含まれる場合のみ）
  if ((!packageJsonSections || packageJsonSections.includes("devDependencies")) && templatePkg.devDependencies && typeof templatePkg.devDependencies === "object") {
    result.devDependencies = await mergePackageJsonDependencies(
      (existingPkg.devDependencies && typeof existingPkg.devDependencies === "object"
        ? existingPkg.devDependencies
        : {}) as Record<string, string>,
      templatePkg.devDependencies as Record<string, string>,
      false
    );
  }

  // When: engines を完全置換（セクション指定がない、またはenginesが含まれる場合のみ）
  if ((!packageJsonSections || packageJsonSections.includes("engines")) && templatePkg.engines && typeof templatePkg.engines === "object") {
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
 * @returns マージ結果
 */
export async function mergeAndWriteFile(
  templatePath: string,
  targetPath: string,
  syncMetadata: SyncMetadata,
  packageJsonSections?: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">
): Promise<{
  action: "created" | "merged" | "skipped" | "overwritten";
  path: string;
}> {
  const templateContent = readFileSync(templatePath, "utf-8");
  const targetExists = existsSync(targetPath);
  const existingContent = targetExists ? readFileSync(targetPath, "utf-8") : null;

  // Given: ファイルがJSONかどうか判定
  const isJsonFile = targetPath.endsWith(".json");
  const isPackageJson = basename(targetPath) === "package.json";

  let mergedContent: string;
  let action: "created" | "merged" | "skipped" | "overwritten";

  if (!targetExists) {
    // When: ファイルが存在しない場合は新規作成
    mergedContent = templateContent;
    action = "created";
  } else if (isPackageJson && existingContent) {
    // When: package.json の特殊処理
    try {
      mergedContent = await mergePackageJson(existingContent, templateContent, packageJsonSections);
      action = "merged";
    } catch {
      // Then: パースエラーの場合はテンプレートで上書き
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else if (isJsonFile) {
    // When: JSONファイルの場合はディープマージ
    try {
      const templateJson = JSON.parse(templateContent) as Record<string, unknown>;
      const existingJson = existingContent
        ? (JSON.parse(existingContent) as Record<string, unknown>)
        : null;
      const jsonPaths = syncMetadata.jsonPaths || { managed: {}, seed: {} };
      // ファイルパスからファイル名を抽出（例: "/path/to/package.json" → "package.json"）
      const fileName = targetPath.split("/").pop() || "package.json";
      const mergedJson = mergeJson(templateJson, existingJson, jsonPaths, fileName);
      mergedContent = JSON.stringify(mergedJson, null, 2);
      action = "merged";
    } catch {
      // Then: パースエラーの場合はテンプレートで上書き
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else {
    // When: テキストファイルの場合はマーカーベースマージ
    mergedContent = mergeTextWithMarkers(templateContent, existingContent);

    // Then: 内容が変更されたかチェック
    if (mergedContent === existingContent) {
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

  return { action, path: targetPath };
}

/**
 * マーカーセクションの型定義
 */
interface MarkerSection {
  type: "managed" | "seed" | "unmanaged";
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
  let currentType: "managed" | "seed" | "unmanaged" = "unmanaged";
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

      // When: managed/seedセクションを保存
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
): { type: "managed" | "seed"; id?: string } | null {
  // Markdown managed
  const markdownManagedPattern =
    /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/;
  let match = line.match(markdownManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || undefined };
  }

  // Markdown seed
  const markdownSeedPattern =
    /^<!--\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*-->$/;
  match = line.match(markdownSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || undefined };
  }

  // YAML/JSON managed
  const yamlManagedPattern = /^\s*#\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || undefined };
  }

  // YAML/JSON seed
  const yamlSeedPattern = /^\s*#\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || undefined };
  }

  return null;
}

/**
 * 行がマーカー終了かどうかを判定し、種別を返す
 *
 * @param line - 行内容
 * @returns マーカー種別またはnull
 */
function parseEndMarker(line: string): "managed" | "seed" | null {
  // Markdown managed
  if (/^<!--\s*@einja:managed:end\s*-->$/.test(line)) {
    return "managed";
  }

  // Markdown seed
  if (/^<!--\s*@einja:seed:end\s*-->$/.test(line)) {
    return "seed";
  }

  // YAML/JSON managed
  if (/^\s*#\s*@einja:managed:end\s*$/.test(line)) {
    return "managed";
  }

  // YAML/JSON seed
  if (/^\s*#\s*@einja:seed:end\s*$/.test(line)) {
    return "seed";
  }

  return null;
}

/**
 * パスがmanagedに含まれるかチェック
 *
 * @param filePath - ファイルパス（例: "package.json"）
 * @param keyPath - チェックするキーパス（例: "scripts.dev"）
 * @param jsonPaths - JSONパス設定
 * @returns managedに含まれる場合true
 */
function isPathManaged(
  filePath: string,
  keyPath: string,
  jsonPaths: JsonPathsConfig
): boolean {
  const managedPaths = jsonPaths.managed[filePath] || [];
  // keyPath が managedPaths のいずれかで始まるかチェック
  // 例: keyPath="scripts.dev" が managedPaths=["scripts.dev"] にマッチ
  // または keyPath="scripts.dev" が managedPaths=["scripts"] にマッチ
  return managedPaths.some(
    (p) => keyPath === p || keyPath.startsWith(`${p}.`)
  );
}

/**
 * パスがseedに含まれるかチェック
 *
 * @param filePath - ファイルパス（例: "package.json"）
 * @param keyPath - チェックするキーパス（例: "scripts.custom"）
 * @param jsonPaths - JSONパス設定
 * @returns seedに含まれる場合true
 */
function isPathSeed(
  filePath: string,
  keyPath: string,
  jsonPaths: JsonPathsConfig
): boolean {
  const seedPaths = jsonPaths.seed[filePath] || [];
  // keyPath が seedPaths のいずれかで始まるかチェック
  return seedPaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
}
