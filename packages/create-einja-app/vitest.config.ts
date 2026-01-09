import { defineConfig } from "vitest/config";

export default defineConfig({
  // CSS処理を無効化（PostCSSエラー回避）
  css: {
    postcss: {},
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["templates/**", "node_modules/**"],
    // ルート設定ファイルを無視
    root: __dirname,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "tests/",
        "templates/",
      ],
    },
  },
});
