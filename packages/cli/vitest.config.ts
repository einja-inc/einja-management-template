import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// 配布用プリセット配下にコピーされた *.test.ts は実行対象にしない
		exclude: [...configDefaults.exclude, "presets/**"],
	},
	// PostCSSプラグインを無効化（CLIパッケージでは不要）
	css: {
		postcss: {
			plugins: [],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
