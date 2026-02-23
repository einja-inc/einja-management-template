#!/usr/bin/env node
/**
 * CLAUDE.mdからテンプレートファイルを生成するスクリプト
 *
 * 処理:
 * 1. CLAUDE.mdを読み込み
 * 2. <!-- @einja:excluded:start --> 〜 <!-- @einja:excluded:end --> マーカー内を除外
 * 3. プロジェクト固有値をプレースホルダーに変換
 * 4. scaffolds/CLAUDE.md.templateに出力
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

// 変換マッピング
const placeholderMap = [
	{ pattern: /pnpm install/g, placeholder: "{{INSTALL_COMMAND}}" },
	{ pattern: /pnpm dev:bg/g, placeholder: "{{DEV_BG_COMMAND}}" }, // pnpm dev:bg を先にマッチ
	{ pattern: /pnpm dev(?![:\w])/g, placeholder: "{{DEV_COMMAND}}" }, // pnpm dev のみマッチ（pnpm dev:xxxは除外）
	{ pattern: /pnpm build/g, placeholder: "{{BUILD_COMMAND}}" },
	{ pattern: /pnpm start/g, placeholder: "{{START_COMMAND}}" },
	{ pattern: /pnpm lint/g, placeholder: "{{LINT_COMMAND}}" },
	{ pattern: /pnpm format/g, placeholder: "{{FORMAT_COMMAND}}" },
	{ pattern: /pnpm typecheck/g, placeholder: "{{TYPE_CHECK_COMMAND}}" },
	{ pattern: /pnpm test/g, placeholder: "{{TEST_COMMAND}}" },
];

/**
 * マーカー除外とプレースホルダー変換を実行
 */
function generateTemplate() {
	console.log("📄 CLAUDE.md.template を生成中...\n");

	// CLAUDE.mdを読み込み
	const claudeMdPath = path.join(projectRoot, "CLAUDE.md");
	if (!fs.existsSync(claudeMdPath)) {
		console.error(`❌ エラー: ${claudeMdPath} が見つかりません`);
		process.exit(1);
	}

	let content = fs.readFileSync(claudeMdPath, "utf-8");

	// マーカー除外
	const excludePattern =
		/<!-- @einja:excluded:start -->[\s\S]*?<!-- @einja:excluded:end -->/g;
	const originalLength = content.length;
	content = content.replace(excludePattern, "");
	const removedLength = originalLength - content.length;

	console.log(`  ✓ マーカー除外: ${removedLength} 文字削除`);

	// プレースホルダー変換
	let replacementCount = 0;
	for (const { pattern, placeholder } of placeholderMap) {
		const matches = content.match(pattern);
		if (matches) {
			content = content.replace(pattern, placeholder);
			replacementCount += matches.length;
		}
	}

	console.log(`  ✓ プレースホルダー変換: ${replacementCount} 箇所置換`);

	// 出力先ディレクトリを作成
	const outputPath = path.join(cliDir, "presets/default/CLAUDE.md.template");
	const outputDir = path.dirname(outputPath);
	fs.mkdirSync(outputDir, { recursive: true });

	// 出力
	fs.writeFileSync(outputPath, content, "utf-8");
	console.log(`  ✓ 出力: ${path.relative(cliDir, outputPath)}`);

	console.log("\n✅ テンプレート生成完了");
}

try {
	generateTemplate();
} catch (error) {
	console.error("❌ エラー:", error);
	process.exit(1);
}
