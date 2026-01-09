#!/usr/bin/env node
/**
 * ビルド時にプロジェクト原本からCLI配布用ディレクトリへファイルをコピーするスクリプト
 *
 * 原本（プロジェクト内）:
 * - .claude/agents/einja/
 * - .claude/commands/einja/
 * - .claude/skills/einja/
 * - .claude/hooks/
 * - docs/einja/steering/
 * - packages/cli/templates/CLAUDE.md.template
 *
 * コピー先（CLI配布用）:
 * - packages/cli/presets/minimal/.claude/
 * - packages/cli/scaffolds/steering/
 * - packages/cli/scaffolds/CLAUDE.md.template
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

const mappings = [
	// エージェント
	{
		src: path.join(projectRoot, ".claude/agents/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/agents/einja"),
	},
	// コマンド
	{
		src: path.join(projectRoot, ".claude/commands/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/commands/einja"),
	},
	// スキル
	{
		src: path.join(projectRoot, ".claude/skills/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/skills/einja"),
	},
	// フック
	{
		src: path.join(projectRoot, ".claude/hooks"),
		dest: path.join(cliDir, "presets/minimal/.claude/hooks"),
	},
	// ステアリングドキュメント
	{
		src: path.join(projectRoot, "docs/einja/steering"),
		dest: path.join(cliDir, "scaffolds/steering"),
	},
];

// 単一ファイルのコピー設定
const fileMappings = [
	// CLAUDE.mdテンプレート
	{
		src: path.join(cliDir, "templates/CLAUDE.md.template"),
		dest: path.join(cliDir, "scaffolds/CLAUDE.md.template"),
	},
	// settings.json
	{
		src: path.join(projectRoot, ".claude/settings.json"),
		dest: path.join(cliDir, "presets/minimal/.claude/settings.json"),
	},
];

/**
 * ディレクトリを再帰的に削除
 */
function removeDir(dirPath) {
	if (fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
	}
}

/**
 * ディレクトリを再帰的にコピー
 */
function copyDir(src, dest, filter = () => true) {
	if (!fs.existsSync(src)) {
		return;
	}

	fs.mkdirSync(dest, { recursive: true });

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		// フィルターをチェック
		if (!filter(srcPath)) {
			continue;
		}

		if (entry.isDirectory()) {
			copyDir(srcPath, destPath, filter);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function copyPresets() {
	console.log("📦 プリセットファイルをコピー中...\n");

	// ディレクトリのコピー
	console.log("ディレクトリ:");
	for (const { src, dest } of mappings) {
		if (fs.existsSync(src)) {
			// コピー先をクリア
			removeDir(dest);
			// コピー
			copyDir(src, dest, (srcPath) => {
				// _ プレフィックスで始まるファイルをスキップ
				const basename = path.basename(srcPath);
				if (basename.startsWith("_")) {
					return false;
				}
				return true;
			});
			console.log(`  ✓ ${path.relative(projectRoot, src)}`);
			console.log(`    → ${path.relative(cliDir, dest)}`);
		} else {
			console.log(`  ⚠ スキップ: ${path.relative(projectRoot, src)} (存在しません)`);
		}
	}

	// 単一ファイルのコピー
	console.log("\nファイル:");
	for (const { src, dest } of fileMappings) {
		if (fs.existsSync(src)) {
			// コピー先ディレクトリを作成
			const destDir = path.dirname(dest);
			fs.mkdirSync(destDir, { recursive: true });
			// コピー
			fs.copyFileSync(src, dest);
			console.log(`  ✓ ${path.relative(cliDir, src)}`);
			console.log(`    → ${path.relative(cliDir, dest)}`);
		} else {
			console.log(`  ⚠ スキップ: ${path.relative(cliDir, src)} (存在しません)`);
		}
	}

	console.log("\n✅ コピー完了");
}

try {
	copyPresets();
} catch (error) {
	console.error("❌ エラー:", error);
	process.exit(1);
}
