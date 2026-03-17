import { describe, expect, it } from "vitest";
import type { JsonPathsConfig } from "@/types/sync.js";
import { JsonProcessor } from "./json-processor.js";

describe("JsonProcessor", () => {
  const processor = new JsonProcessor();
  const emptyPaths: JsonPathsConfig = { managed: {}, "project-private": {} };

  describe("mergeJson - 基本動作", () => {
    it("localJson が null の場合、project-private除外済みテンプレートを返す", () => {
      // Given
      const template = { name: "test", scripts: { build: "tsc" } };
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": { "package.json": ["name"] },
      };

      // When
      const result = processor.mergeJson(template, null, jsonPaths, "package.json");

      // Then: name は project-private 除外、scripts は残る
      expect(result.result).toEqual({ scripts: { build: "tsc" } });
      expect(result.conflicts).toEqual([]);
    });

    it("戻り値が JsonMergeResult 型であること", () => {
      // Given
      const template = { a: 1 };
      const local = { a: 1 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json");

      // Then: result と conflicts プロパティを持つ
      expect(result).toHaveProperty("result");
      expect(result).toHaveProperty("conflicts");
      expect(Array.isArray(result.conflicts)).toBe(true);
      expect(typeof result.result).toBe("object");
    });
  });

  describe("mergeJson - 3方向マージ", () => {
    it("base→template 変更のみ → テンプレート適用", () => {
      // Given: base(2) → template(3) に変更、local は未変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 2 };
      const template = { a: 1, b: 3 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: b がテンプレート値(3)に更新される
      expect(result.result).toEqual({ a: 1, b: 3 });
      expect(result.conflicts).toEqual([]);
    });

    it("base→local 変更のみ → ローカル保持", () => {
      // Given: base(2) → local(5) に変更、template は未変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 5 };
      const template = { a: 1, b: 2 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: b はローカル値(5)を保持
      expect(result.result).toEqual({ a: 1, b: 5 });
      expect(result.conflicts).toEqual([]);
    });

    it("両方変更（異なる値）→ コンフリクト検出、ローカル保持", () => {
      // Given: local(5) と template(3) が base(2) から異なる値に変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 5 };
      const template = { a: 1, b: 3 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: ローカル値(5)を保持 + コンフリクト検出
      expect(result.result).toEqual({ a: 1, b: 5 });
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].keyPath).toBe("b");
      expect(result.conflicts[0].baseValue).toBe(2);
      expect(result.conflicts[0].localValue).toBe(5);
      expect(result.conflicts[0].templateValue).toBe(3);
    });

    it("両方変更（同じ値）→ コンフリクトなし", () => {
      // Given: local と template が同じ値(3)に変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 3 };
      const template = { a: 1, b: 3 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: コンフリクトなし
      expect(result.result).toEqual({ a: 1, b: 3 });
      expect(result.conflicts).toEqual([]);
    });

    it("ローカル削除 + テンプレート未変更 → 削除維持", () => {
      // Given: ローカルで b を削除、テンプレートは未変更
      const base = { a: 1, b: 2 };
      const local = { a: 1 };
      const template = { a: 1, b: 2 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: b は削除されたまま
      expect(result.result).toEqual({ a: 1 });
      expect(result.conflicts).toEqual([]);
    });

    it("ローカル削除 + テンプレート変更 → コンフリクト（ローカル=削除を保持）", () => {
      // Given: ローカルで b を削除、テンプレートで b を変更
      const base = { a: 1, b: 2 };
      const local = { a: 1 };
      const template = { a: 1, b: 3 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: コンフリクト検出、b は削除されたまま（ローカルの削除を保持）
      expect(result.result).toEqual({ a: 1 });
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].keyPath).toBe("b");
      expect(result.conflicts[0].localValue).toBeUndefined();
      expect(result.conflicts[0].templateValue).toBe(3);
    });

    it("テンプレートで新キー追加 → 追加", () => {
      // Given: template に新キー b を追加
      const base = { a: 1 };
      const local = { a: 1 };
      const template = { a: 1, b: 2 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: b がローカルに追加される
      expect(result.result).toEqual({ a: 1, b: 2 });
      expect(result.conflicts).toEqual([]);
    });

    it("ローカルで新キー追加 → 保持", () => {
      // Given: local に独自キー c を追加
      const base = { a: 1 };
      const local = { a: 1, c: 3 };
      const template = { a: 1 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: c はローカルに保持される
      expect(result.result).toEqual({ a: 1, c: 3 });
      expect(result.conflicts).toEqual([]);
    });

    it("テンプレートでキー削除 + ローカル未変更 → 削除", () => {
      // Given: template で b を削除、local は未変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 2 };
      const template = { a: 1 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: b がローカルから削除される
      expect(result.result).toEqual({ a: 1 });
      expect(result.conflicts).toEqual([]);
    });

    it("テンプレートでキー削除 + ローカル変更あり → コンフリクト", () => {
      // Given: template で b を削除、local で b を変更
      const base = { a: 1, b: 2 };
      const local = { a: 1, b: 5 };
      const template = { a: 1 };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: コンフリクト検出、ローカル値(5)を保持
      expect(result.result).toEqual({ a: 1, b: 5 });
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].keyPath).toBe("b");
      expect(result.conflicts[0].localValue).toBe(5);
      expect(result.conflicts[0].templateValue).toBeUndefined();
    });

    it("配列値の両方変更でコンフリクトが検出されること", () => {
      const base = { deps: ["a", "b"] };
      const local = { deps: ["a", "b", "c"] }; // ローカルが変更
      const template = { deps: ["a", "b", "d"] }; // テンプレートも変更
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);
      // 両方変更で異なる値 → コンフリクト（ローカル保持）
      expect(result.result.deps).toEqual(["a", "b", "c"]);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].keyPath).toBe("deps");
    });

    it("配列内オブジェクトのキー順差だけではコンフリクトせず、実際のテンプレート変更を適用する", () => {
      const base = { arr: [{ a: 1, b: 2 }] };
      const local = { arr: [{ b: 2, a: 1 }] };
      const template = { arr: [{ a: 1, b: 3 }] };

      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      expect(result.result).toEqual({ arr: [{ a: 1, b: 3 }] });
      expect(result.conflicts).toEqual([]);
    });

    it("base が空オブジェクトの場合、テンプレートとローカルの新キーがすべて保持されること", () => {
      const base = {};
      const local = { localKey: "local" };
      const template = { templateKey: "template" };
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);
      // ローカルの新キー → 保持
      expect(result.result.localKey).toBe("local");
      // テンプレートの新キー → 追加
      expect(result.result.templateKey).toBe("template");
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("mergeJson - 初回sync（baseなし）", () => {
    it("初回sync + ローカルにユーザー変更あり → ローカル保持", () => {
      // Given: base なし、ローカルに変更あり
      const template = { a: 1, b: 2, c: 3 };
      const local = { a: 10, b: 20 };
      const jsonPaths: JsonPathsConfig = { managed: {}, "project-private": {} };

      // When
      const result = processor.mergeJson(template, local, jsonPaths, "test.json");

      // Then: a, b はローカル保持、c はテンプレートから追加
      expect(result.result).toEqual({ a: 10, b: 20, c: 3 });
      expect(result.conflicts).toEqual([]);
    });

    it("初回sync + オブジェクト型の再帰マージ", () => {
      // Given: base なし、ネストされたオブジェクト
      const template = { scripts: { build: "tsc", dev: "next dev" } };
      const local = { scripts: { build: "vite build" } };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json");

      // Then: build はローカル保持、dev はテンプレートから追加
      expect(result.result).toEqual({ scripts: { build: "vite build", dev: "next dev" } });
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("mergeJson - project-private", () => {
    it("project-private: テンプレートにあってもローカルに追加しない（完全除外）", () => {
      // Given: name, version が project-private
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": { "package.json": ["name", "version"] },
      };
      const template = { name: "template-name", version: "1.0.0", scripts: { build: "tsc" } };
      const local = { scripts: {} };

      // When
      const result = processor.mergeJson(template, local, jsonPaths, "package.json");

      // Then: name, version は追加されない
      expect(result.result).not.toHaveProperty("name");
      expect(result.result).not.toHaveProperty("version");
      expect(result.result).toHaveProperty("scripts");
    });

    it("project-private: 初回syncでも追加しない", () => {
      // Given: base なし、name が project-private
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": { "package.json": ["name"] },
      };
      const template = { name: "template", scripts: { build: "tsc" } };
      const local = {};

      // When
      const result = processor.mergeJson(template, local, jsonPaths, "package.json");

      // Then: name は追加されない
      expect(result.result).not.toHaveProperty("name");
      expect(result.result).toHaveProperty("scripts");
    });

    it("project-private ネスト指定: devDeps.@types/node が除外される", () => {
      // Given: devDeps.@types/node が project-private
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": { "test.json": ["devDeps.@types/node"] },
      };
      const template = { devDeps: { "@types/node": "20", typescript: "5" } };
      const local = { devDeps: { typescript: "4" } };

      // When
      const result = processor.mergeJson(template, local, jsonPaths, "test.json");

      // Then: @types/node は除外（追加されない）、typescript はマージ対象
      expect(result.result.devDeps).not.toHaveProperty("@types/node");
      expect((result.result.devDeps as Record<string, unknown>).typescript).toBe("4");
    });

    it("project-private キーがローカルにある場合、削除されないこと", () => {
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": { "package.json": ["name", "version"] },
      };
      const base = { name: "old-name", version: "0.1.0", scripts: { build: "tsc" } };
      const local = { name: "my-project", version: "1.0.0", scripts: { build: "tsc" } };
      const template = {
        name: "template-name",
        version: "2.0.0",
        scripts: { build: "tsc --noEmit" },
      };
      const result = processor.mergeJson(template, local, jsonPaths, "package.json", base);
      // project-private キーはローカル値がそのまま保持される
      expect(result.result.name).toBe("my-project");
      expect(result.result.version).toBe("1.0.0");
      // scripts.build はテンプレート変更あり → テンプレート適用
      expect((result.result.scripts as Record<string, unknown>).build).toBe("tsc --noEmit");
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("mergeJson - managed", () => {
    it("managed: テンプレート値で強制上書き", () => {
      // Given: plansDirectory が managed
      const jsonPaths: JsonPathsConfig = {
        managed: { "settings.json": ["plansDirectory"] },
        "project-private": {},
      };
      const template = { plansDirectory: "docs/plans", userSetting: "template" };
      const local = { plansDirectory: "my-plans", userSetting: "local" };
      const base = { plansDirectory: "old-plans", userSetting: "template" };

      // When
      const result = processor.mergeJson(template, local, jsonPaths, "settings.json", base);

      // Then: plansDirectory はテンプレート値（managed）、userSetting はローカル保持
      expect(result.result.plansDirectory).toBe("docs/plans");
      expect(result.result.userSetting).toBe("local");
    });

    it("managed パスが初回sync（baseなし）でも強制上書きされること", () => {
      const jsonPaths: JsonPathsConfig = {
        managed: { "settings.json": ["plansDirectory"] },
        "project-private": {},
      };
      const template = { plansDirectory: "docs/plans", userSetting: "template" };
      const local = { plansDirectory: "my-plans", userSetting: "local" };
      // base なし（初回sync）でも managed は強制上書き
      const result = processor.mergeJson(template, local, jsonPaths, "settings.json");
      expect(result.result.plansDirectory).toBe("docs/plans");
      expect(result.result.userSetting).toBe("local"); // managed以外はローカル保持
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("mergeJson - フルパスルックアップ", () => {
    it(".claude/settings.json がフルパスで正しくマッチ", () => {
      // Given: .claude/settings.json の plansDirectory が managed
      const jsonPaths: JsonPathsConfig = {
        managed: { ".claude/settings.json": ["plansDirectory"] },
        "project-private": {},
      };
      const template = { plansDirectory: "docs/plans", hooks: {} };
      const local = { plansDirectory: "my-plans", hooks: { custom: true } };

      // When
      const result = processor.mergeJson(template, local, jsonPaths, ".claude/settings.json");

      // Then: plansDirectory はテンプレート値（managed）
      expect(result.result.plansDirectory).toBe("docs/plans");
    });
  });

  describe("mergeJson - ネストされたオブジェクト", () => {
    it("3階層以上のネストでも3方向マージが正しく動作すること", () => {
      const base = { a: { b: { c: 1, d: 2 } } };
      const local = { a: { b: { c: 1, d: 5 } } }; // d を変更
      const template = { a: { b: { c: 3, d: 2 } } }; // c を変更
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);
      // c はテンプレート変更 → テンプレート適用
      // d はローカル変更 → ローカル保持
      const nested = result.result.a as Record<string, unknown>;
      const deepNested = nested.b as Record<string, unknown>;
      expect(deepNested.c).toBe(3);
      expect(deepNested.d).toBe(5);
      expect(result.conflicts).toEqual([]);
    });

    it("ネストされたオブジェクト内でも3方向マージが動作する", () => {
      // Given: scripts オブジェクト内の各キーを個別に変更
      const base = { scripts: { build: "tsc", dev: "next dev", test: "vitest" } };
      const local = { scripts: { build: "tsc", dev: "next dev --turbo", test: "vitest" } };
      const template = { scripts: { build: "tsc --noEmit", dev: "next dev", test: "vitest" } };

      // When
      const result = processor.mergeJson(template, local, emptyPaths, "test.json", base);

      // Then: build → template適用（local未変更）、dev → local保持（template未変更）、test → 変更なし
      expect((result.result.scripts as Record<string, unknown>).build).toBe("tsc --noEmit");
      expect((result.result.scripts as Record<string, unknown>).dev).toBe("next dev --turbo");
      expect((result.result.scripts as Record<string, unknown>).test).toBe("vitest");
      expect(result.conflicts).toEqual([]);
    });
  });
});
