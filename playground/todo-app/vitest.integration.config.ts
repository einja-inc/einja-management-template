// playground/todo-app/vitest.integration.config.ts

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		// 統合テストのみ実行
		include: ["**/*.integration.ts"],
		env: {
			DATABASE_URL:
				process.env.DATABASE_URL ||
				"postgresql://postgres:postgres@localhost:5433/todo_app_dev?schema=public",
		},
	},
});
