import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  target: "es2022",
  outDir: "dist",
  splitting: false,
  sourcemap: true,
  minify: false,
});
