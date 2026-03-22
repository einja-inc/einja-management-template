import { transformContent } from "../scripts/template-update";

describe("template-update", () => {
  describe("transformContent", () => {
    it("ルートpackage.jsonを変換すると、sync:shared系スクリプトが除去される", () => {
      // Given: monorepo専用スクリプトを含むルートpackage.json
      const content = JSON.stringify(
        {
          name: "einja-management-monorepo",
          description: "template source",
          scripts: {
            "sync:shared:sync-core": "node scripts/sync-shared-sync-core.mts",
            "sync:shared:check": "node scripts/sync-shared-sync-core.mts --check",
            "test:sync:shared": "node --test scripts/sync-shared-sync-core.test.mts",
            test: "pnpm test:sync:shared && turbo run test",
            prepush: "pnpm sync:shared:check && pnpm prepush:test",
            "prepush:test": "pnpm test",
          },
        },
        null,
        2
      );

      // When: テンプレート向けに変換する
      const transformed = JSON.parse(transformContent("package.json", content));

      // Then: 下流で不要なsync:shared系が除去され、参照も剥がれる
      expect(transformed.name).toBe("{{projectName}}");
      expect(transformed.description).toBe("{{description}}");
      expect(transformed.scripts["sync:shared:sync-core"]).toBeUndefined();
      expect(transformed.scripts["sync:shared:check"]).toBeUndefined();
      expect(transformed.scripts["test:sync:shared"]).toBeUndefined();
      expect(transformed.scripts.test).toBe("turbo run test");
      expect(transformed.scripts.prepush).toBe("pnpm prepush:test");
    });

    it("huskyフックを変換すると、sync:shared:check呼び出しが除去される", () => {
      // Given: monorepo専用チェックを含むhuskyフック
      const content = "pnpm sync:shared:check\nnpx lint-staged\n";

      // When: テンプレート向けに変換する
      const transformed = transformContent(".husky/pre-commit", content);

      // Then: 下流で不要な行だけが除去される
      expect(transformed).toBe("npx lint-staged\n");
    });
  });
});
