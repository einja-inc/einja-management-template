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
 *
 * シンボリックリンク:
 * - プロジェクト原本のシンボリックリンクは symlinks.json に記録される
 * - CLI インストール時に symlinks.json を元にリンクを再作成する
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

// シンボリックリンク情報を格納する配列
const symlinkMap = [];

const mappings = [
	// エージェント
	{
		src: path.join(projectRoot, ".claude/agents/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/agents/einja"),
		// シンボリックリンク記録用のベースパス（リポジトリルートからの相対）
		basePath: ".claude/agents/einja",
	},
	// コマンド
	{
		src: path.join(projectRoot, ".claude/commands/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/commands/einja"),
		basePath: ".claude/commands/einja",
	},
	// スキル
	{
		src: path.join(projectRoot, ".claude/skills/einja"),
		dest: path.join(cliDir, "presets/minimal/.claude/skills/einja"),
		basePath: ".claude/skills/einja",
	},
	// フック
	{
		src: path.join(projectRoot, ".claude/hooks"),
		dest: path.join(cliDir, "presets/minimal/.claude/hooks"),
		basePath: ".claude/hooks",
	},
	// ステアリングドキュメント（scaffoldsはシンボリックリンク非対象）
	{
		src: path.join(projectRoot, "docs/einja/steering"),
		dest: path.join(cliDir, "scaffolds/steering"),
		basePath: null, // シンボリックリンク記録対象外
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
 * シンボリックリンクを検出し、symlinkMap に記録する
 *
 * @param {string} src - コピー元ディレクトリ
 * @param {string} dest - コピー先ディレクトリ
 * @param {(path: string) => boolean} filter - フィルター関数
 * @param {string} basePath - 相対パス計算用のベースパス（presets/minimal からの相対）
 */
function copyDir(src, dest, filter = () => true, basePath = "") {
	if (!fs.existsSync(src)) {
		return;
	}

	fs.mkdirSync(dest, { recursive: true });

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		const relativePath = path.join(basePath, entry.name);

		// フィルターをチェック
		if (!filter(srcPath)) {
			continue;
		}

		if (entry.isSymbolicLink()) {
			// シンボリックリンクを検出 → メタデータに記録
			const linkTarget = fs.readlinkSync(srcPath);
			// 相対パス（../../../../../docs/...）をルートからの相対パス（docs/...）に変換
			const absoluteTarget = path.resolve(path.dirname(srcPath), linkTarget);
			const targetFromRoot = path.relative(projectRoot, absoluteTarget);
			symlinkMap.push({
				link: relativePath,
				target: targetFromRoot,
			});
			console.log(`  🔗 シンボリックリンク検出: ${relativePath} → ${targetFromRoot}`);
			// 実体はコピーしない（リンク先が別途コピーされる前提）
		} else if (entry.isDirectory()) {
			copyDir(srcPath, destPath, filter, relativePath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function copyPresets() {
	console.log("📦 プリセットファイルをコピー中...\n");

	// シンボリックリンク情報をリセット
	symlinkMap.length = 0;

	// ディレクトリのコピー
	console.log("ディレクトリ:");
	for (const { src, dest, basePath } of mappings) {
		if (fs.existsSync(src)) {
			// コピー先をクリア
			removeDir(dest);
			// コピー（basePathがnullの場合はシンボリックリンク記録対象外）
			copyDir(
				src,
				dest,
				(srcPath) => {
					// _ プレフィックスで始まるファイルをスキップ
					const basename = path.basename(srcPath);
					if (basename.startsWith("_")) {
						return false;
					}
					return true;
				},
				basePath || "",
			);
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

	// シンボリックリンク情報をJSON出力
	if (symlinkMap.length > 0) {
		const symlinksPath = path.join(cliDir, "presets/minimal/symlinks.json");
		const symlinksData = {
			version: 1,
			symlinks: symlinkMap,
		};
		fs.writeFileSync(symlinksPath, JSON.stringify(symlinksData, null, 2));
		console.log(`\nシンボリックリンク情報:`);
		console.log(`  ✓ ${symlinkMap.length} 件のシンボリックリンクを記録`);
		console.log(`    → ${path.relative(cliDir, symlinksPath)}`);
	}

	console.log("\n✅ コピー完了");
}

try {
	copyPresets();
} catch (error) {
	console.error("❌ エラー:", error);
	process.exit(1);
}
