import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
	},
	// PostCSSプラグインを無効化（CLIパッケージでは不要）
	css: {
		postcss: {
			plugins: [],
		},
	},
});
