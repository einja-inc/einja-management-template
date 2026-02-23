#!/usr/bin/env node
/**
 * ビルド時にプロジェクト原本からCLI配布用ディレクトリへファイルをコピーするスクリプト
 *
 * 原本（プロジェクト内）:
 * - .claude/agents/einja/
 * - .claude/commands/einja/
 * - .claude/skills/einja-* (einja-プレフィックスのスキルのみ)
 * - .claude/hooks/einja/
 * - .claude/settings.json
 * - .mcp.json
 * - .vscode/settings.json
 * - docs/einja/ (memory, cli除く)
 *
 * コピー先（CLI配布用）:
 * - packages/cli/presets/default/.claude/
 * - packages/cli/presets/default/docs/einja/
 * - packages/cli/presets/default/.mcp.json
 * - packages/cli/presets/default/CLAUDE.md.template
 *
 * シンボリックリンク:
 * - プロジェクト原本のシンボリックリンクは symlinks.json に記録される
 * - CLI インストール時に symlinks.json を元にリンクを再作成する
 *
 * マーカーバリデーション:
 * - コピー前にdocs/einja/配下のマーカーをバリデーション
 * - エラーがある場合はビルドを中断
 */

import { execSync } from "node:child_process";
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
		dest: path.join(cliDir, "presets/default/.claude/agents/einja"),
		// シンボリックリンク記録用のベースパス（リポジトリルートからの相対）
		basePath: ".claude/agents/einja",
	},
	// コマンド
	{
		src: path.join(projectRoot, ".claude/commands/einja"),
		dest: path.join(cliDir, "presets/default/.claude/commands/einja"),
		basePath: ".claude/commands/einja",
	},
	// スキル（einja-* パターン）
	{
		src: path.join(projectRoot, ".claude/skills/einja-api-development"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-api-development"),
		basePath: ".claude/skills/einja-api-development",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-backend-architecture"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-backend-architecture"),
		basePath: ".claude/skills/einja-backend-architecture",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-coding-standards"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-coding-standards"),
		basePath: ".claude/skills/einja-coding-standards",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-component-design"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-component-design"),
		basePath: ".claude/skills/einja-component-design",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-conflict-resolver"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-conflict-resolver"),
		basePath: ".claude/skills/einja-conflict-resolver",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-frontend-development"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-frontend-development"),
		basePath: ".claude/skills/einja-frontend-development",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-general-context-loader"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-general-context-loader"),
		basePath: ".claude/skills/einja-general-context-loader",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-output-format"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-output-format"),
		basePath: ".claude/skills/einja-output-format",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-spec-context-loader"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-spec-context-loader"),
		basePath: ".claude/skills/einja-spec-context-loader",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-project-overview"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-project-overview"),
		basePath: ".claude/skills/einja-project-overview",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-skill-creator"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-skill-creator"),
		basePath: ".claude/skills/einja-skill-creator",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-task-commit"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-task-commit"),
		basePath: ".claude/skills/einja-task-commit",
	},
	{
		src: path.join(projectRoot, ".claude/skills/einja-task-qa"),
		dest: path.join(cliDir, "presets/default/.claude/skills/einja-task-qa"),
		basePath: ".claude/skills/einja-task-qa",
	},
	// フック（hooks/ディレクトリ全体をクリーンアップしてから再コピー）
	{
		src: path.join(projectRoot, ".claude/hooks/einja"),
		dest: path.join(cliDir, "presets/default/.claude/hooks/einja"),
		basePath: ".claude/hooks/einja",
		cleanParent: true, // hooks/ディレクトリ全体をクリーンアップ
	},
	// docs/einja全体（presets/defaultに統合、sync + init両対応）
	{
		src: path.join(projectRoot, "docs/einja"),
		dest: path.join(cliDir, "presets/default/docs/einja"),
		basePath: null, // シンボリックリンク記録対象外
		exclude: ["memory", "cli"], // プロジェクト固有のメモリとcli/preset.yamlはコピーしない
	},
];

// 単一ファイルのコピー設定
const fileMappings = [
	// settings.json
	{
		src: path.join(projectRoot, ".claude/settings.json"),
		dest: path.join(cliDir, "presets/default/.claude/settings.json"),
		required: true,
	},
	// .mcp.json
	{
		src: path.join(projectRoot, ".mcp.json"),
		dest: path.join(cliDir, "presets/default/.mcp.json"),
		required: false,
	},
	// preset.yaml（プリセット定義）
	{
		src: path.join(projectRoot, "docs/einja/cli/preset.yaml"),
		dest: path.join(cliDir, "presets/default/preset.yaml"),
		required: true,
	},
	// .envrc
	{
		src: path.join(projectRoot, ".envrc"),
		dest: path.join(cliDir, "presets/default/.envrc"),
		required: true,
	},
	// .vscode/settings.json
	{
		src: path.join(projectRoot, ".vscode/settings.json"),
		dest: path.join(cliDir, "presets/default/.vscode/settings.json"),
		required: false,
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
 * @param {string} basePath - 相対パス計算用のベースパス（presets/default からの相対）
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

			// リンク切れ検出
			if (!fs.existsSync(absoluteTarget)) {
				console.error(`❌ リンク切れ: ${relativePath} → ${linkTarget}`);
				process.exit(1);
			}

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
	for (const { src, dest, basePath, cleanParent, exclude = [] } of mappings) {
		// コピー先をクリア（cleanParent=trueの場合は親ディレクトリを削除）
		if (cleanParent) {
			const parentDir = path.dirname(dest);
			removeDir(parentDir);
		} else {
			removeDir(dest);
		}

		if (fs.existsSync(src)) {
			// コピー（basePathがnullの場合はシンボリックリンク記録対象外）
			copyDir(
				src,
				dest,
				(srcPath) => {
					const basename = path.basename(srcPath);
					// _ プレフィックスで始まるファイルをスキップ
					if (basename.startsWith("_")) {
						return false;
					}
					// 除外リストに含まれるディレクトリをスキップ
					if (exclude.includes(basename)) {
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
	for (const { src, dest, required } of fileMappings) {
		if (fs.existsSync(src)) {
			// コピー先ディレクトリを作成
			const destDir = path.dirname(dest);
			fs.mkdirSync(destDir, { recursive: true });
			// コピー
			fs.copyFileSync(src, dest);
			console.log(`  ✓ ${path.relative(cliDir, src)}`);
			console.log(`    → ${path.relative(cliDir, dest)}`);
		} else if (required) {
			console.error(`  ❌ 必須ファイルが見つかりません: ${path.relative(projectRoot, src)}`);
			process.exit(1);
		} else {
			console.log(`  ⚠ スキップ: ${path.relative(cliDir, src)} (存在しません)`);
		}
	}

	// シンボリックリンク情報をJSON出力
	if (symlinkMap.length > 0) {
		const symlinksPath = path.join(cliDir, "presets/default/symlinks.json");
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

/**
 * マーカーバリデーションを実行
 */
function validateMarkers() {
	console.log("🔍 マーカーバリデーションを実行中...\n");

	try {
		const validateScript = path.join(__dirname, "validate-markers.mjs");
		execSync(`node "${validateScript}"`, {
			stdio: "inherit",
			cwd: projectRoot,
		});
	} catch (error) {
		console.error("\n❌ マーカーバリデーションに失敗しました");
		console.error("   エラーを修正してから再度ビルドしてください\n");
		process.exit(1);
	}
}

try {
	// 1. マーカーバリデーション
	validateMarkers();

	// 2. ファイルコピー
	copyPresets();
} catch (error) {
	console.error("❌ エラー:", error);
	process.exit(1);
}
