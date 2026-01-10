#!/usr/bin/env node
/**
 * docs/einja/配下のMarkdownファイルのマーカーをバリデーション
 *
 * チェック項目:
 * - 構文チェック: マーカーの形式が正しいか
 * - ペア一致: start/endが揃っているか
 * - ネスト禁止: managed内にseed等がないか
 * - seedにID必須: seedマーカーにID属性があるか
 * - ID重複禁止: 同一ファイル内でIDが重複していないか
 *
 * ビルド時に呼び出され、エラーがある場合はprocess.exit(1)で終了します。
 *
 * 注: このスクリプトはdist/への依存を排除し、正規表現ベースでバリデーションを行います。
 * これにより、prebuild時（tsc実行前）でも動作します。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/cli ディレクトリ
const cliDir = path.resolve(__dirname, "..");
// プロジェクトルート
const projectRoot = path.resolve(cliDir, "../..");

// マーカーパターン（MarkerProcessorと同等の正規表現）
const MARKER_PATTERNS = {
  MANAGED_START: /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/,
  MANAGED_END: /^<!--\s*@einja:managed:end\s*-->$/,
  SEED_START: /^<!--\s*@einja:seed:start\s+id="([^"]+)"\s*-->$/,
  SEED_END: /^<!--\s*@einja:seed:end\s*-->$/,
};

// 部分マッチ用パターン（行内のどこにでもマーカーがあるかチェック）
const PARTIAL_PATTERNS = {
  MANAGED_START: /@einja:managed:start/,
  MANAGED_END: /@einja:managed:end/,
  SEED_START: /@einja:seed:start/,
  SEED_END: /@einja:seed:end/,
};

/**
 * マーカーのバリデーションを行う
 * @param {string} content - ファイル内容
 * @returns {{ valid: boolean, errors: Array<{ line: number, type: string, message: string }> }}
 */
function validateMarkers(content) {
  const errors = [];
  const lines = content.split("\n");
  const stack = []; // { type: 'managed' | 'seed', line: number, id?: string }
  const seenIds = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // managed:start
    if (PARTIAL_PATTERNS.MANAGED_START.test(line)) {
      const match = line.match(MARKER_PATTERNS.MANAGED_START);

      if (!match) {
        errors.push({
          line: lineNumber,
          type: "invalid_syntax",
          message: "@einja:managed:startの構文が不正です",
        });
        continue;
      }

      // ネストチェック
      if (stack.length > 0) {
        const current = stack[stack.length - 1];
        errors.push({
          line: lineNumber,
          type: "nested",
          message: `@einja:${current.type}マーカー内に@einja:managedマーカーをネストすることは許可されていません`,
        });
        continue;
      }

      const id = match[1];
      if (id) {
        if (seenIds.has(id)) {
          errors.push({
            line: lineNumber,
            type: "duplicate_id",
            message: `ID "${id}" は既に使用されています`,
          });
        }
        seenIds.add(id);
      }

      stack.push({ type: "managed", line: lineNumber, id });
    }
    // managed:end
    else if (PARTIAL_PATTERNS.MANAGED_END.test(line)) {
      const match = line.match(MARKER_PATTERNS.MANAGED_END);

      if (!match) {
        errors.push({
          line: lineNumber,
          type: "invalid_syntax",
          message: "@einja:managed:endの構文が不正です",
        });
        continue;
      }

      if (stack.length === 0 || stack[stack.length - 1].type !== "managed") {
        errors.push({
          line: lineNumber,
          type: "unpaired_end",
          message:
            "@einja:managed:endに対応する@einja:managed:startが見つかりません",
        });
        continue;
      }

      stack.pop();
    }
    // seed:start
    else if (PARTIAL_PATTERNS.SEED_START.test(line)) {
      const match = line.match(MARKER_PATTERNS.SEED_START);

      if (!match) {
        // seedマーカーにIDがない場合
        if (/@einja:seed:start/.test(line) && !/id="/.test(line)) {
          errors.push({
            line: lineNumber,
            type: "seed_without_id",
            message: "@einja:seedマーカーにはid属性が必須です",
          });
        } else {
          errors.push({
            line: lineNumber,
            type: "invalid_syntax",
            message: "@einja:seed:startの構文が不正です",
          });
        }
        continue;
      }

      // ネストチェック
      if (stack.length > 0) {
        const current = stack[stack.length - 1];
        errors.push({
          line: lineNumber,
          type: "nested",
          message: `@einja:${current.type}マーカー内に@einja:seedマーカーをネストすることは許可されていません`,
        });
        continue;
      }

      const id = match[1];
      if (seenIds.has(id)) {
        errors.push({
          line: lineNumber,
          type: "duplicate_id",
          message: `ID "${id}" は既に使用されています`,
        });
      }
      seenIds.add(id);

      stack.push({ type: "seed", line: lineNumber, id });
    }
    // seed:end
    else if (PARTIAL_PATTERNS.SEED_END.test(line)) {
      const match = line.match(MARKER_PATTERNS.SEED_END);

      if (!match) {
        errors.push({
          line: lineNumber,
          type: "invalid_syntax",
          message: "@einja:seed:endの構文が不正です",
        });
        continue;
      }

      if (stack.length === 0 || stack[stack.length - 1].type !== "seed") {
        errors.push({
          line: lineNumber,
          type: "unpaired_end",
          message: "@einja:seed:endに対応する@einja:seed:startが見つかりません",
        });
        continue;
      }

      stack.pop();
    }
  }

  // 閉じられていないマーカーをチェック
  for (const item of stack) {
    errors.push({
      line: item.line,
      type: "unpaired_start",
      message: `@einja:${item.type}:startに対応する@einja:${item.type}:endが見つかりません`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * ディレクトリ配下の.mdおよび.md.templateファイルを再帰的に収集
 */
function collectMarkdownFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".md") || entry.name.endsWith(".md.template"))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 対象ディレクトリ配下のマーカーをバリデーション
 */
async function runValidation() {
  const targetDirs = [
    path.join(projectRoot, "docs/einja/steering"),
    path.join(projectRoot, "docs/einja/example"),
    path.join(projectRoot, "docs/einja/instructions"),
    path.join(projectRoot, "docs/einja/templates"),
  ];

  const allFiles = [];
  for (const dir of targetDirs) {
    const files = collectMarkdownFiles(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log("⚠️  検証対象のMarkdownファイルが見つかりませんでした");
    return { success: true, totalErrors: 0 };
  }

  console.log(`📝 ${allFiles.length}件のMarkdownファイルを検証中...\n`);

  let totalErrors = 0;
  const filesWithErrors = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const result = validateMarkers(content);

    if (!result.valid) {
      totalErrors += result.errors.length;
      filesWithErrors.push({ file, errors: result.errors });
    }
  }

  if (filesWithErrors.length > 0) {
    console.error("❌ マーカーバリデーションエラーが見つかりました:\n");

    for (const { file, errors } of filesWithErrors) {
      const relativePath = path.relative(projectRoot, file);
      console.error(`📄 ${relativePath}`);

      for (const error of errors) {
        console.error(`   L${error.line}: ${error.message} (${error.type})`);
      }

      console.error("");
    }

    console.error(`合計 ${totalErrors} 件のエラーが見つかりました`);
    console.error("マーカーを修正してから再度ビルドしてください\n");

    return { success: false, totalErrors };
  }

  console.log(
    `✅ すべてのマーカーバリデーションが成功しました (${allFiles.length}件のファイル)\n`
  );
  return { success: true, totalErrors: 0 };
}

// スクリプト実行
runValidation()
  .then(({ success }) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ 予期しないエラー:", error);
    process.exit(1);
  });
