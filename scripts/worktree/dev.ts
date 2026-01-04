/**
 * Worktree対応の開発サーバー起動スクリプト
 *
 * ブランチ名から一意なポート番号を計算し、複数のWorktreeを並行して起動可能にする。
 * PostgreSQLは共有インスタンスを使用し、database名で分離する。
 * 設定はworktree.config.jsonから読み込む。
 */

import { execSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
	type AppConfig,
	type WorktreeConfig,
	loadWorktreeConfig,
} from "@einja/config";

/** 設定を保持するグローバル変数 */
let config: WorktreeConfig;

/**
 * 設定を取得（遅延読み込み）
 */
function getConfig(): WorktreeConfig {
	if (!config) {
		config = loadWorktreeConfig();
	}
	return config;
}

/**
 * ブランチ名からハッシュベースで一意なポート番号を計算
 *
 * 各アプリは設定されたポート範囲を使用し、競合を回避。
 * PostgreSQLは共有インスタンスを使用（設定されたポート）。
 *
 * @param branchName - Gitブランチ名
 * @param apps - アプリケーション設定の配列
 * @returns アプリIDをキーとするポート番号のRecord
 */
export function calculatePorts(
	branchName: string,
	apps: AppConfig[],
): Record<string, number> {
	// ブランチ名をSHA-256でハッシュ化
	const hash = crypto.createHash("sha256").update(branchName).digest("hex");

	// ハッシュの最初の8文字を16進数として数値化
	const hashNum = Number.parseInt(hash.slice(0, 8), 16);

	const ports: Record<string, number> = {};
	for (const app of apps) {
		const offset = hashNum % app.rangeSize;
		ports[app.id] = app.portRangeStart + offset;
	}

	return ports;
}

/**
 * ブランチ名からデータベース名を生成
 * PostgreSQLのデータベース名として有効な形式に変換
 *
 * @param branchName - Gitブランチ名
 * @returns データベース名（例: main, feature_auth）
 */
export function generateDatabaseName(branchName: string): string {
	// ブランチ名を正規化（英数字とアンダースコアのみ）
	const normalized = branchName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 32);

	return normalized || "main";
}

/**
 * ポートが使用中かチェック
 *
 * @param port - チェックするポート番号
 * @returns ポートが使用中の場合true
 */
export function isPortInUse(port: number): boolean {
	try {
		// lsofコマンドでポートを使用しているプロセスを確認
		execSync(`lsof -i :${port}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * ポートを使用しているプロセスのPIDを取得
 *
 * @param port - チェックするポート番号
 * @returns PIDの配列（見つからない場合は空配列）
 */
export function getProcessesOnPort(port: number): number[] {
	try {
		// lsofコマンドでポートを使用しているプロセスのPIDを取得
		const result = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
		if (!result) return [];
		return result.split("\n").map((pid) => Number.parseInt(pid, 10)).filter((pid) => !Number.isNaN(pid));
	} catch {
		return [];
	}
}

/**
 * 指定したポートを使用しているプロセスを終了
 *
 * @param port - 終了するプロセスのポート番号
 * @param signal - 送信するシグナル（デフォルト: SIGTERM）
 * @returns 終了したプロセス数
 */
export function killProcessesOnPort(port: number, signal: NodeJS.Signals = "SIGTERM"): number {
	const pids = getProcessesOnPort(port);
	if (pids.length === 0) {
		return 0;
	}

	console.log(`🔪 ポート ${port} を使用しているプロセス (PID: ${pids.join(", ")}) を終了します...`);

	let killedCount = 0;
	for (const pid of pids) {
		try {
			process.kill(pid, signal);
			killedCount++;
			console.log(`   ✓ PID ${pid} にシグナル ${signal} を送信`);
		} catch (error) {
			console.warn(`   ⚠ PID ${pid} の終了に失敗: ${error}`);
		}
	}

	// プロセス終了を待機（最大5秒）
	const startTime = Date.now();
	while (Date.now() - startTime < 5000) {
		if (!isPortInUse(port)) {
			console.log(`✅ ポート ${port} が解放されました`);
			return killedCount;
		}
		spawnSync("sleep", ["0.2"]);
	}

	// まだ使用中ならSIGKILLを送信
	const remainingPids = getProcessesOnPort(port);
	if (remainingPids.length > 0) {
		console.log(`⚠ ポート ${port} がまだ使用中です。SIGKILLを送信します...`);
		for (const pid of remainingPids) {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// 無視
			}
		}
		spawnSync("sleep", ["0.5"]);
	}

	return killedCount;
}

/**
 * ログファイルのパスを取得
 *
 * 各worktreeは独立したディレクトリなので、シンプルに log/dev.log を使用。
 * 同じブランチ名のworktreeは実用上存在しないため、ブランチ名での分離は不要。
 *
 * @returns ログファイルのパス
 */
export function getLogFilePath(): string {
	const projectRoot = process.cwd();
	const logDir = path.join(projectRoot, "log");

	// ログディレクトリを作成
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true });
	}

	return path.join(logDir, "dev.log");
}

/**
 * ポートを使用しているプロセスのコマンドパスを取得
 *
 * @param port - チェックするポート番号
 * @returns コマンドパスの配列
 */
export function getProcessCommandsOnPort(port: number): { pid: number; command: string }[] {
	try {
		const result = execSync(`lsof -i :${port} -Fp -Fc`, { encoding: "utf-8" }).trim();
		if (!result) return [];

		const processes: { pid: number; command: string }[] = [];
		let currentPid = 0;

		for (const line of result.split("\n")) {
			if (line.startsWith("p")) {
				currentPid = Number.parseInt(line.slice(1), 10);
			} else if (line.startsWith("c") && currentPid) {
				processes.push({ pid: currentPid, command: line.slice(1) });
			}
		}
		return processes;
	} catch {
		return [];
	}
}

/**
 * プロセスがこのリポジトリに属するか判定
 *
 * @param pid - プロセスID
 * @returns このリポジトリのプロセスならtrue
 */
export function isProcessFromThisRepo(pid: number): boolean {
	try {
		const cwd = execSync(`lsof -p ${pid} -Fn | grep "^n" | grep "cwd" || true`, {
			encoding: "utf-8",
		}).trim();

		// cwdが取得できない場合はコマンドラインで判定
		if (!cwd) {
			const cmdline = execSync(`ps -p ${pid} -o command=`, { encoding: "utf-8" }).trim();
			return cmdline.includes(process.cwd()) || cmdline.includes("turbo") || cmdline.includes("next");
		}

		return cwd.includes(process.cwd());
	} catch {
		return false;
	}
}

/**
 * ポートを確保する（必要に応じて自リポジトリのプロセスをkill）
 *
 * 他のワークツリーや外部アプリは誤killしないよう、
 * 自リポジトリのプロセスのみを対象とする。
 *
 * @param ports - 確保するポート番号セット
 * @returns 確保したポート番号セット
 */
export function ensurePorts(ports: Record<string, number>): Record<string, number> {
	for (const [appId, port] of Object.entries(ports)) {
		if (!isPortInUse(port)) {
			continue;
		}

		const processes = getProcessCommandsOnPort(port);
		const ownProcesses = processes.filter((p) => isProcessFromThisRepo(p.pid));

		if (ownProcesses.length > 0) {
			// 自リポジトリのプロセスならkill
			console.log(`🔄 ポート ${port} を使用中の自プロセスを停止します...`);
			for (const p of ownProcesses) {
				try {
					process.kill(p.pid, "SIGTERM");
					console.log(`   ✓ PID ${p.pid} (${p.command}) を停止`);
				} catch {
					// 既に終了している
				}
			}
			// 終了待機
			spawnSync("sleep", ["0.5"]);
		}

		// まだ使用中なら外部プロセス
		if (isPortInUse(port)) {
			const remaining = getProcessCommandsOnPort(port);
			console.error(`❌ ポート ${port} は外部プロセスが使用中です:`);
			for (const p of remaining) {
				console.error(`   - PID ${p.pid}: ${p.command}`);
			}
			console.error(`   手動で停止するか、別のブランチ名を使用してください`);
			throw new Error(`ポート ${port} を確保できません（外部プロセスが使用中）`);
		}
	}

	return ports;
}

/**
 * 現在のGitブランチ名を取得
 *
 * @returns ブランチ名
 */
export function getCurrentBranch(): string {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD", {
			encoding: "utf-8",
		}).trim();
	} catch (error) {
		console.error("Gitブランチの取得に失敗しました:", error);
		return "main";
	}
}

/**
 * AUTH_SECRETを生成
 *
 * @returns 生成されたAUTH_SECRET（32文字以上のランダム文字列）
 */
export function generateAuthSecret(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * .envファイルを生成
 *
 * .env.exampleをベースに、ワークツリー固有の値を設定した.envを生成。
 *
 * @param ports - アプリIDをキーとするポート番号のRecord
 * @param databaseName - データベース名
 */
export function writeEnvFile(
	ports: Record<string, number>,
	databaseName: string,
): void {
	const cfg = getConfig();
	const projectRoot = process.cwd();
	const envExamplePath = path.join(projectRoot, ".env.example");
	const envPath = path.join(projectRoot, ".env");

	// .env.exampleをベースに読み込む
	let envContent = "";
	if (fs.existsSync(envExamplePath)) {
		envContent = fs.readFileSync(envExamplePath, "utf-8");
	}

	// ヘッダーを追加
	const branch = getCurrentBranch();
	const header = `# ============================================
# Auto-generated by pnpm dev - DO NOT EDIT
# ============================================
# Branch: ${branch}
# Generated: ${new Date().toISOString()}
#
# このファイルは pnpm dev 実行時に上書きされます
# 手動で編集しても次回実行時にリセットされます
# 秘密情報は .env.local に設定してください
# ============================================

`;

	// DATABASE_URLを生成
	const databaseUrl = `postgresql://postgres:postgres@localhost:${cfg.postgres.port}/${databaseName}?schema=public`;

	// 環境変数設定
	const envSettings: Record<string, string> = {
		DATABASE_URL: `"${databaseUrl}"`,
		AUTH_SECRET: generateAuthSecret(),
	};

	// 各アプリのポートを動的に追加（PORT_WEB, PORT_ADMIN等）
	for (const [appId, port] of Object.entries(ports)) {
		envSettings[`PORT_${appId.toUpperCase()}`] = port.toString();
	}

	// webアプリがあればNEXTAUTH_URLを設定
	if (ports.web) {
		envSettings.NEXTAUTH_URL = `http://localhost:${ports.web}`;
	}

	// 環境変数の更新または追加
	for (const [key, value] of Object.entries(envSettings)) {
		const regex = new RegExp(`^${key}=.*$`, "m");
		if (regex.test(envContent)) {
			envContent = envContent.replace(regex, `${key}=${value}`);
		} else {
			envContent += `\n${key}=${value}`;
		}
	}

	fs.writeFileSync(envPath, header + envContent.trim() + "\n", "utf-8");
}

/**
 * 設定されたポートでPostgreSQLが起動しているか確認
 *
 * @returns 起動していればコンテナ名、なければnull
 */
export function getRunningPostgresContainer(): string | null {
	const cfg = getConfig();
	try {
		// 設定されたポートを使用しているコンテナを検索
		const result = execSync(
			`docker ps --filter "publish=${cfg.postgres.port}" --format "{{.Names}}"`,
			{
				encoding: "utf-8",
			},
		).trim();
		return result.length > 0 ? result.split("\n")[0] : null;
	} catch {
		return null;
	}
}

/**
 * PostgreSQLコンテナが起動しているか確認（後方互換性）
 *
 * @returns 起動していればtrue
 */
export function isPostgresRunning(): boolean {
	return getRunningPostgresContainer() !== null;
}

/**
 * PostgreSQLコンテナを起動（または既存を再利用）
 *
 * @returns 使用するコンテナ名
 */
export function startPostgres(): string {
	const cfg = getConfig();

	// 既存のPostgreSQLコンテナを確認
	const existingContainer = getRunningPostgresContainer();
	if (existingContainer) {
		console.log(`✅ PostgreSQL（${existingContainer}）は既に起動しています`);
		return existingContainer;
	}

	console.log("🐘 PostgreSQLコンテナを起動します...");

	// 環境変数を設定してdocker compose up
	execSync("docker compose up -d postgres", {
		stdio: "inherit",
		env: {
			...process.env,
			POSTGRES_PORT: cfg.postgres.port.toString(),
			POSTGRES_CONTAINER_NAME: cfg.postgres.containerName,
		},
	});

	// 起動待機
	console.log("⏳ PostgreSQL起動を待機中...");
	let retries = 0;
	const maxRetries = 30;

	while (retries < maxRetries) {
		const container = getRunningPostgresContainer();
		if (container) {
			try {
				execSync(`docker exec ${container} pg_isready -U postgres`, {
					stdio: "ignore",
				});
				console.log("✅ PostgreSQL起動完了");
				return container;
			} catch {
				// まだ準備中
			}
		}
		retries++;
		execSync("sleep 1");
	}

	throw new Error("PostgreSQLの起動に失敗しました");
}

/**
 * データベースが存在するか確認し、なければ作成
 *
 * @param containerName - PostgreSQLコンテナ名
 * @param databaseName - 作成するデータベース名
 */
export function ensureDatabaseExists(
	containerName: string,
	databaseName: string,
): void {
	console.log(`🗄️  データベース「${databaseName}」を確認中...`);

	try {
		// データベースの存在確認
		const result = execSync(
			`docker exec ${containerName} psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${databaseName}'"`,
			{ encoding: "utf-8" },
		).trim();

		if (result === "1") {
			console.log(`✅ データベース「${databaseName}」は既に存在します`);
			return;
		}
	} catch {
		// コマンド失敗時は作成を試みる
	}

	// データベース作成
	console.log(`📦 データベース「${databaseName}」を作成します...`);
	execSync(
		`docker exec ${containerName} psql -U postgres -c "CREATE DATABASE ${databaseName}"`,
		{
			stdio: "inherit",
		},
	);
	console.log(`✅ データベース「${databaseName}」を作成しました`);
}

/**
 * マイグレーションを実行
 *
 * @param databaseName - データベース名
 */
export function runMigration(databaseName: string): void {
	const cfg = getConfig();
	console.log("🔄 マイグレーションを実行します...");
	const databaseUrl = `postgresql://postgres:postgres@localhost:${cfg.postgres.port}/${databaseName}?schema=public`;

	try {
		execSync("pnpm db:push", {
			stdio: "inherit",
			env: {
				...process.env,
				DATABASE_URL: databaseUrl,
			},
		});
		console.log("✅ マイグレーション完了");
	} catch (error) {
		console.error("❌ マイグレーションに失敗しました");
		throw error;
	}
}

/**
 * 開発サーバーを起動（turbo経由）
 *
 * @param envVars - 追加の環境変数
 * @param options - 起動オプション
 */
function startDevServer(
	envVars: Record<string, string> = {},
	options: { background?: boolean; logFile?: string } = {},
): void {
	const { background = false, logFile } = options;

	// ポートの確保は ensurePorts() で実施済み

	if (background && logFile) {
		console.log("🚀 開発サーバーをバックグラウンドで起動します...");
		console.log(`📄 ログファイル: ${logFile}`);

		// ログファイルをクリアして新規作成
		const logStream = fs.openSync(logFile, "w");

		// タイムスタンプ付きヘッダーをログに追加
		const header = `${"=".repeat(60)}\n[${new Date().toISOString()}] 開発サーバー起動\n${"=".repeat(60)}\n`;
		fs.writeSync(logStream, header);

		// バックグラウンドプロセスとして起動
		const child = spawn("pnpm", ["turbo", "run", "dev"], {
			stdio: ["ignore", logStream, logStream],
			shell: true,
			detached: true,
			env: {
				...process.env,
				...envVars,
			},
		});

		// 親プロセスから切り離す
		child.unref();

		// PIDをファイルに保存（後でstop/statusで使用）
		const pidFile = logFile.replace(".log", ".pid");
		fs.writeFileSync(pidFile, child.pid?.toString() ?? "");

		console.log(`✅ 開発サーバーが起動しました (PID: ${child.pid})`);
		console.log(`\n📋 ログを確認: tail -f ${logFile}`);
		console.log(`🛑 停止: pnpm dev:stop`);

		// 親プロセスは終了
		process.exit(0);
	}

	console.log("🚀 開発サーバーを起動します...");

	// spawn を使用してプロセスを実行（環境変数を渡す）
	const child = spawn("pnpm", ["turbo", "run", "dev"], {
		stdio: "inherit",
		shell: true,
		env: {
			...process.env,
			...envVars,
		},
	});

	child.on("error", (error) => {
		console.error("開発サーバーの起動に失敗しました:", error);
		process.exit(1);
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});
}

/**
 * メイン実行関数
 *
 * @param options - 実行オプション
 */
export function main(options: {
	setupOnly?: boolean;
	skipSetup?: boolean;
	background?: boolean;
} = {}): void {
	const { setupOnly = false, skipSetup = false, background = false } = options;
	const cfg = getConfig();

	// バックグラウンドモードの場合、既存のサーバーを停止
	if (background) {
		const logFile = getLogFilePath();
		const pidFile = logFile.replace(".log", ".pid");

		if (fs.existsSync(pidFile)) {
			const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
			if (!Number.isNaN(pid)) {
				try {
					process.kill(pid, 0); // プロセス存在確認
					console.log(`⚠️  既存の開発サーバー (PID: ${pid}) が起動中です`);
					console.log("🔄 既存サーバーを停止して再起動します...");
					stopDevServer();
				} catch {
					// プロセスが存在しない場合はPIDファイルを削除
					fs.unlinkSync(pidFile);
				}
			}
		}
	}

	// --skip-setup: 環境準備をスキップして直接turbo run dev
	if (skipSetup) {
		startDevServer();
		return;
	}

	const branch = getCurrentBranch();
	console.log(`現在のブランチ: ${branch}`);

	// ブランチ名からデータベース名を生成
	const databaseName = generateDatabaseName(branch);
	console.log(`データベース名: ${databaseName}`);

	// ブランチ名からポート番号を計算（固定）
	const calculatedPorts = calculatePorts(branch, cfg.apps);
	console.log("ポート:", calculatedPorts);

	// ポートを確保（自リポジトリのプロセスのみkill対象）
	const availablePorts = ensurePorts(calculatedPorts);

	// .envに書き込み
	writeEnvFile(availablePorts, databaseName);
	console.log(".envに書き込みました");

	// PostgreSQLの起動確認・起動（コンテナ名を取得）
	const containerName = startPostgres();

	// データベースの存在確認・作成
	ensureDatabaseExists(containerName, databaseName);

	// マイグレーション実行
	runMigration(databaseName);

	// webアプリのポートを取得（表示用）
	const webPort = availablePorts.web ?? Object.values(availablePorts)[0];

	console.log(`
===========================================
Worktree環境設定完了
===========================================
  Web:        http://localhost:${webPort}
  PostgreSQL: localhost:${cfg.postgres.port}
  Database:   ${databaseName}
${Object.entries(availablePorts)
	.map(([id, port]) => `  PORT_${id.toUpperCase()}: ${port}`)
	.join("\n")}
===========================================
`);

	if (setupOnly) {
		return;
	}

	// 環境変数を準備
	const envVars: Record<string, string> = {
		DATABASE_URL: `postgresql://postgres:postgres@localhost:${cfg.postgres.port}/${databaseName}?schema=public`,
		NEXTAUTH_URL: `http://localhost:${webPort}`,
		AUTH_SECRET: generateAuthSecret(),
	};

	// 各アプリのポートを追加
	for (const [id, port] of Object.entries(availablePorts)) {
		envVars[`PORT_${id.toUpperCase()}`] = port.toString();
	}

	// ログファイルパスを取得
	const logFile = getLogFilePath();

	// 開発サーバーを起動
	startDevServer(envVars, { background, logFile });
}

/**
 * 開発サーバーを停止
 */
export function stopDevServer(): void {
	const branch = getCurrentBranch();
	const logFile = getLogFilePath();
	const pidFile = logFile.replace(".log", ".pid");

	if (!fs.existsSync(pidFile)) {
		console.log("⚠ 実行中の開発サーバーが見つかりません");
		return;
	}

	const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
	if (Number.isNaN(pid)) {
		console.log("⚠ PIDファイルが無効です");
		fs.unlinkSync(pidFile);
		return;
	}

	try {
		process.kill(pid, "SIGTERM");
		console.log(`✅ 開発サーバー (PID: ${pid}) を停止しました`);
	} catch (error) {
		console.log(`⚠ プロセス ${pid} は既に終了しています`);
	}

	// PIDファイルを削除
	fs.unlinkSync(pidFile);
}

/**
 * 開発サーバーのステータスを表示
 */
export function showDevStatus(): void {
	const branch = getCurrentBranch();
	const logFile = getLogFilePath();
	const pidFile = logFile.replace(".log", ".pid");
	const cfg = getConfig();

	console.log(`\n📊 開発サーバーステータス`);
	console.log(`${"=".repeat(50)}`);
	console.log(`ブランチ: ${branch}`);

	if (fs.existsSync(pidFile)) {
		const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
		try {
			process.kill(pid, 0); // シグナル0でプロセス存在確認
			console.log(`状態: 🟢 実行中 (PID: ${pid})`);
		} catch {
			console.log(`状態: 🔴 停止 (古いPIDファイルあり)`);
		}
	} else {
		console.log(`状態: ⚪ 未起動`);
	}

	// ポート使用状況
	const calculatedPorts = calculatePorts(branch, cfg.apps);
	console.log(`\nポート使用状況:`);
	for (const [appId, port] of Object.entries(calculatedPorts)) {
		const status = isPortInUse(port) ? "🟢 使用中" : "⚪ 空き";
		console.log(`  ${appId}: ${port} ${status}`);
	}

	console.log(`\nログファイル: ${logFile}`);
	console.log(`${"=".repeat(50)}\n`);
}

// スクリプトとして直接実行された場合
const args = process.argv.slice(2);
const setupOnly = args.includes("--setup-only");
const skipSetup = args.includes("--skip-setup");
const background = args.includes("--background") || args.includes("-b");
const noKill = args.includes("--no-kill");
const stop = args.includes("--stop");
const status = args.includes("--status");

if (stop) {
	stopDevServer();
} else if (status) {
	showDevStatus();
} else {
	main({ setupOnly, skipSetup, background, killExisting: !noKill });
}
