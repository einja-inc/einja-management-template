import { describe, it, expect } from "vitest";
import { mergeTextWithMarkers, mergeJson } from "@/utils/merger.js";
import type { JsonPathsConfig } from "@/types/index.js";

describe("mergeTextWithMarkers", () => {
  describe("マーカーなしの場合", () => {
    it("既存ファイルが存在しない場合、テンプレートがそのまま使用される", () => {
      // Given: テンプレート内容のみ
      const templateContent = "Line 1\nLine 2\nLine 3";
      const existingContent = null;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: テンプレートがそのまま返る
      expect(result).toBe(templateContent);
    });

    it("マーカーがない場合、既存ファイルが優先される", () => {
      // Given: マーカーなしのテンプレートと既存ファイル
      const templateContent = "Template line 1\nTemplate line 2";
      const existingContent = "Existing line 1\nExisting line 2";

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 既存内容が優先される
      expect(result).toBe(existingContent);
    });
  });

  describe("@einja:managedマーカー", () => {
    it("ID付きmanagedマーカー内はテンプレートで上書きされる", () => {
      // Given: ID付きmanagedマーカー内にテンプレート更新がある
      const templateContent = `Before managed
<!-- @einja:managed:start id="test-section" -->
Template managed content
<!-- @einja:managed:end -->
After managed`;

      const existingContent = `Before managed
<!-- @einja:managed:start id="test-section" -->
Existing managed content
<!-- @einja:managed:end -->
After managed`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: managed内がテンプレートで上書きされる
      expect(result).toContain("Template managed content");
      expect(result).not.toContain("Existing managed content");
      expect(result).toContain("Before managed");
      expect(result).toContain("After managed");
    });

    it("managedマーカー外のunmanagedセクションは既存が優先される", () => {
      // Given: ID付きmanagedマーカー外にユーザー変更がある
      const templateContent = `Template header
<!-- @einja:managed:start id="test-section" -->
Managed content
<!-- @einja:managed:end -->
Template footer`;

      const existingContent = `User header
<!-- @einja:managed:start id="test-section" -->
Old managed content
<!-- @einja:managed:end -->
User footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: unmanaged部分は既存が優先され、ID付きmanagedはテンプレートで上書き
      expect(result).toContain("User header");
      expect(result).toContain("User footer");
      expect(result).toContain("Managed content");
      expect(result).not.toContain("Template header");
      expect(result).not.toContain("Template footer");
      expect(result).not.toContain("Old managed content");
    });

    it("ID付き複数のmanagedマーカーが正しく処理される", () => {
      // Given: ID付き複数のmanagedセクション
      const templateContent = `Header
<!-- @einja:managed:start id="section1" -->
Template section 1
<!-- @einja:managed:end -->
Middle
<!-- @einja:managed:start id="section2" -->
Template section 2
<!-- @einja:managed:end -->
Footer`;

      const existingContent = `Header
<!-- @einja:managed:start id="section1" -->
Old section 1
<!-- @einja:managed:end -->
Middle
<!-- @einja:managed:start id="section2" -->
Old section 2
<!-- @einja:managed:end -->
Footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 両方のmanagedセクションがIDでマッチして上書きされる
      expect(result).toContain("Template section 1");
      expect(result).toContain("Template section 2");
      expect(result).not.toContain("Old section 1");
      expect(result).not.toContain("Old section 2");
    });

    it("IDなし複数のmanagedマーカーはテンプレート内容で上書きされる", () => {
      // Given: IDなし複数のmanagedセクション
      const templateContent = `Header
<!-- @einja:managed:start -->
Template section 1
<!-- @einja:managed:end -->
Middle
<!-- @einja:managed:start -->
Template section 2
<!-- @einja:managed:end -->
Footer`;

      const existingContent = `Header
<!-- @einja:managed:start -->
Old section 1
<!-- @einja:managed:end -->
Middle
<!-- @einja:managed:start -->
Old section 2
<!-- @einja:managed:end -->
Footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: IDなしセクションはテンプレート内容で上書きされる
      expect(result).toContain("Template section 1");
      expect(result).toContain("Template section 2");
      expect(result).not.toContain("Old section 1");
      expect(result).not.toContain("Old section 2");
    });
  });

  describe("@einja:project-privateマーカー", () => {
    it("project-privateマーカー内はローカル優先（変更されない）", () => {
      // Given: project-privateマーカー内にユーザー変更がある
      const templateContent = `Before project-private
<!-- @einja:project-private:start id="custom" -->
Template project-private content
<!-- @einja:project-private:end -->
After project-private`;

      const existingContent = `Before project-private
<!-- @einja:project-private:start id="custom" -->
User custom content
<!-- @einja:project-private:end -->
After project-private`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: project-private内はローカルが優先される
      expect(result).toContain("User custom content");
      expect(result).not.toContain("Template project-private content");
      expect(result).toContain("Before project-private");
      expect(result).toContain("After project-private");
    });

    it("テンプレートにのみseedセクションが存在する場合は末尾に追加される", () => {
      // Given: テンプレートにseedがあるがローカルにはない
      const templateContent = `Before project-private
<!-- @einja:project-private:start id="new-section" -->
New project-private content
<!-- @einja:project-private:end -->
After project-private`;

      const existingContent = `Before project-private
After project-private`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: テンプレートのproject-privateセクションが末尾に追加される
      expect(result).toContain("Before project-private");
      expect(result).toContain("After project-private");
      expect(result).toContain("New project-private content");
      expect(result).toContain("<!-- @einja:project-private:start id=\"new-section\" -->");
    });

    it("ローカルにのみ存在するseedセクションが保持される", () => {
      // Given: ローカル独自のseedセクション
      const templateContent = "Template content";

      const existingContent = `Existing content
<!-- @einja:project-private:start id="local-only" -->
Local custom content
<!-- @einja:project-private:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: ローカルのproject-privateセクションが保持される
      expect(result).toContain("Existing content");
      expect(result).toContain("Local custom content");
      expect(result).toContain("<!-- @einja:project-private:start id=\"local-only\" -->");
    });

    it("テンプレートにのみmanagedセクションが存在する場合は末尾に追加される", () => {
      // Given: テンプレートにmanagedがあるがローカルにはない
      const templateContent = `Before managed
<!-- @einja:managed:start id="new-managed" -->
New managed content
<!-- @einja:managed:end -->
After managed`;

      const existingContent = `Before managed
After managed`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: テンプレートのmanagedセクションが末尾に追加される
      expect(result).toContain("Before managed");
      expect(result).toContain("After managed");
      expect(result).toContain("New managed content");
      expect(result).toContain("<!-- @einja:managed:start id=\"new-managed\" -->");
    });

    it("ID付きmanagedセクションは正しくマッチングされる", () => {
      // Given: ID付きmanagedセクション（テンプレートとローカルで同じID）
      const templateContent = `Header
<!-- @einja:managed:start id="section-a" -->
Template section A
<!-- @einja:managed:end -->
Footer`;

      const existingContent = `Header
<!-- @einja:managed:start id="section-a" -->
Old section A
<!-- @einja:managed:end -->
Footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: IDでマッチして上書きされる
      expect(result).toContain("Template section A");
      expect(result).not.toContain("Old section A");
    });

    it("既存のmanagedセクションはテンプレート新規追加で破壊されない", () => {
      // Given: テンプレートに新規managedセクションと既存managedセクション
      const templateContent = `<!-- @einja:managed:start id="new" -->
New section
<!-- @einja:managed:end -->
<!-- @einja:managed:start id="existing" -->
Template existing
<!-- @einja:managed:end -->`;

      const existingContent = `<!-- @einja:managed:start id="existing" -->
Local existing (should be overwritten)
<!-- @einja:managed:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: "existing"セクションはテンプレートで上書き
      expect(result).toContain("Template existing");
      expect(result).not.toContain("Local existing (should be overwritten)");
      // Then: "new"セクションは末尾に追加
      expect(result).toContain("New section");
      expect(result).toContain("<!-- @einja:managed:start id=\"new\" -->");
    });

    it("ローカルにのみ存在するID付きmanagedセクションは削除される", () => {
      // Given: ローカルにのみ存在するID付きmanagedセクション（テンプレート削除済み）
      const templateContent = `Header
<!-- @einja:managed:start id="current-section" -->
Current managed content
<!-- @einja:managed:end -->
Footer`;

      const existingContent = `Header
<!-- @einja:managed:start id="current-section" -->
Current managed content
<!-- @einja:managed:end -->
Middle
<!-- @einja:managed:start id="removed-section" -->
Old managed content (should be removed)
<!-- @einja:managed:end -->
Footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: テンプレートにないmanagedセクションは削除される
      expect(result).not.toContain("removed-section");
      expect(result).not.toContain("Old managed content (should be removed)");
      // Then: テンプレートにあるmanagedセクションは上書きされる
      expect(result).toContain("Current managed content");
      // Then: unmanagedセクションは保持される
      expect(result).toContain("Header");
      expect(result).toContain("Middle");
      expect(result).toContain("Footer");
    });
  });

  describe("セクション間の空行保持", () => {
    it("2つのmanagedブロック間の空行が保持される", () => {
      // Given: 2つのmanagedブロックが空行で区切られている
      const templateContent = `<!-- @einja:managed:start id="section1" -->
Section 1
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section2" -->
Section 2
<!-- @einja:managed:end -->`;

      const existingContent = `<!-- @einja:managed:start id="section1" -->
Old Section 1
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section2" -->
Old Section 2
<!-- @einja:managed:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: セクション間の空行が保持される
      expect(result).toContain("<!-- @einja:managed:end -->\n\n<!-- @einja:managed:start");
      expect(result).toContain("Section 1");
      expect(result).toContain("Section 2");
    });

    it("managedとproject-privateブロック間の空行が保持される", () => {
      // Given: managedとproject-privateブロックが空行で区切られている
      const templateContent = `<!-- @einja:managed:start id="managed" -->
Managed content
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="seed" -->
Project-private content
<!-- @einja:project-private:end -->`;

      const existingContent = `<!-- @einja:managed:start id="managed" -->
Old managed
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="seed" -->
User project-private
<!-- @einja:project-private:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: セクション間の空行が保持される
      expect(result).toContain("<!-- @einja:managed:end -->\n\n<!-- @einja:project-private:start");
    });

    it("複数の空行が正しく保持される", () => {
      // Given: 複数の空行で区切られている
      const templateContent = `<!-- @einja:managed:start id="section1" -->
Section 1
<!-- @einja:managed:end -->


<!-- @einja:managed:start id="section2" -->
Section 2
<!-- @einja:managed:end -->`;

      const existingContent = `<!-- @einja:managed:start id="section1" -->
Old Section 1
<!-- @einja:managed:end -->


<!-- @einja:managed:start id="section2" -->
Old Section 2
<!-- @einja:managed:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 複数の空行が保持される
      expect(result).toContain("<!-- @einja:managed:end -->\n\n\n<!-- @einja:managed:start");
    });
  });

  describe("ファイル先頭マーカーのケース", () => {
    it("ファイルが先頭マーカーで始まる場合、先頭に空行が追加されない", () => {
      // Given: ファイルが先頭マーカーで始まる
      const templateContent = `<!-- @einja:managed:start id="main" -->
Managed content
<!-- @einja:managed:end -->`;

      const existingContent = `<!-- @einja:managed:start id="main" -->
Old content
<!-- @einja:managed:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 先頭に空行が追加されない
      expect(result.startsWith("\n")).toBe(false);
      expect(result).toBe(templateContent);
    });

    it("ファイルが先頭project-privateマーカーで始まる場合、先頭に空行が追加されない", () => {
      // Given: ファイルが先頭project-privateマーカーで始まる
      const templateContent = `<!-- @einja:project-private:start id="config" -->
Project-private content
<!-- @einja:project-private:end -->`;

      const existingContent = `<!-- @einja:project-private:start id="config" -->
User content
<!-- @einja:project-private:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 先頭に空行が追加されない
      expect(result.startsWith("\n")).toBe(false);
      expect(result).toContain("User content");
    });

    it("ファイルが先頭マーカーで始まり、複数セクションがある場合でも空行が追加されない", () => {
      // Given: 先頭マーカーと複数セクション
      const templateContent = `<!-- @einja:managed:start id="section1" -->
Section 1 template
<!-- @einja:managed:end -->
Middle unmanaged
<!-- @einja:project-private:start id="section2" -->
Section 2 template
<!-- @einja:project-private:end -->`;

      const existingContent = `<!-- @einja:managed:start id="section1" -->
Section 1 old
<!-- @einja:managed:end -->
Middle user
<!-- @einja:project-private:start id="section2" -->
Section 2 user
<!-- @einja:project-private:end -->`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: 先頭に空行が追加されない
      expect(result.startsWith("\n")).toBe(false);
      expect(result).toContain("Section 1 template");
      expect(result).toContain("Middle user");
      expect(result).toContain("Section 2 user");
    });
  });

  describe("managedとproject-privateの混在", () => {
    it("managedとproject-privateマーカーが混在している場合、それぞれ正しく処理される", () => {
      // Given: managedとproject-privateが混在
      const templateContent = `Header
<!-- @einja:managed:start id="main-content" -->
Template managed
<!-- @einja:managed:end -->
Middle
<!-- @einja:project-private:start id="config" -->
Template project-private
<!-- @einja:project-private:end -->
Footer`;

      const existingContent = `User header
<!-- @einja:managed:start id="main-content" -->
Old managed
<!-- @einja:managed:end -->
User middle
<!-- @einja:project-private:start id="config" -->
User project-private
<!-- @einja:project-private:end -->
User footer`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: ID付きmanagedは上書き、project-privateとunmanagedはローカル優先
      expect(result).toContain("Template managed");
      expect(result).toContain("User project-private");
      expect(result).toContain("User header");
      expect(result).toContain("User middle");
      expect(result).toContain("User footer");
      expect(result).not.toContain("Old managed");
      expect(result).not.toContain("Template project-private");
      expect(result).not.toContain("Header");
      expect(result).not.toContain("Middle");
      expect(result).not.toContain("Footer");
    });
  });

  describe("YAMLコメント形式のマーカー", () => {
    it("YAMLコメント形式のmanagedマーカーが正しく処理される", () => {
      // Given: YAMLコメント形式のマーカー（ID付き）
      const templateContent = `key: value
# @einja:managed:start id="managed-config"
managed_key: template_value
# @einja:managed:end
other_key: value`;

      const existingContent = `key: user_value
# @einja:managed:start id="managed-config"
managed_key: old_value
# @einja:managed:end
other_key: user_other_value`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: ID付きmanaged内が上書きされ、unmanaged部分はローカル優先
      expect(result).toContain("managed_key: template_value");
      expect(result).not.toContain("managed_key: old_value");
      expect(result).toContain("key: user_value");
      expect(result).toContain("other_key: user_other_value");
    });

    it("YAMLコメント形式のproject-privateマーカーが正しく処理される", () => {
      // Given: YAMLコメント形式のproject-privateマーカー
      const templateContent = `# @einja:project-private:start id="custom"
custom_key: template_value
# @einja:project-private:end`;

      const existingContent = `# @einja:project-private:start id="custom"
custom_key: user_value
# @einja:project-private:end`;

      // When: マージ実行
      const result = mergeTextWithMarkers(templateContent, existingContent);

      // Then: project-private内はローカルが優先される
      expect(result).toContain("custom_key: user_value");
      expect(result).not.toContain("custom_key: template_value");
    });
  });
});

describe("mergeJson", () => {
  describe("基本動作", () => {
    it("既存JSONが存在しない場合、テンプレートがそのまま使用される", () => {
      // Given: テンプレートJSONのみ
      const templateJson = {
        name: "test-project",
        version: "1.0.0",
      };
      const existingJson = null;
      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: テンプレートがそのまま返る
      expect(result).toEqual(templateJson);
    });

    it("managedパスの値はテンプレートで上書きされる", () => {
      // Given: managedパス指定
      const templateJson = {
        name: "template-name",
        version: "2.0.0",
        dependencies: {
          react: "^18.0.0",
        },
      };

      const existingJson = {
        name: "user-name",
        version: "1.0.0",
        dependencies: {
          react: "^17.0.0",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["version", "dependencies"],
        },
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: managedパスはテンプレート値で上書き
      expect(result.version).toBe("2.0.0");
      expect(result.dependencies).toEqual({ react: "^18.0.0" });
      // managedでないパスはローカル優先
      expect(result.name).toBe("user-name");
    });

    it("project-privateパスの値はローカルに存在しない場合のみコピーされる", () => {
      // Given: project-privateパス指定
      const templateJson = {
        scripts: {
          dev: "next dev",
          build: "next build",
        },
        customConfig: {
          theme: "dark",
        },
      };

      const existingJson = {
        scripts: {
          dev: "custom dev command",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {
          "package.json": ["scripts", "customConfig"],
        },
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: 既存のキーは保持され、存在しないキーのみ追加される
      expect(result.scripts).toEqual({ dev: "custom dev command", build: "next build" });
      expect(result.customConfig).toEqual({ theme: "dark" });
    });

    it("指定外のパスはローカル優先", () => {
      // Given: managed/seed指定なし
      const templateJson = {
        name: "template-name",
        author: "template-author",
      };

      const existingJson = {
        name: "user-name",
        license: "MIT",
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: ローカル値が優先され、テンプレートにのみ存在するキーも追加される
      expect(result.name).toBe("user-name");
      expect(result.license).toBe("MIT");
      expect(result.author).toBe("template-author");
    });
  });

  describe("ネストパスのサポート", () => {
    it("ネストパス（例: scripts.dev）がmanagedに指定されている場合、そのパスのみ上書きされる", () => {
      // Given: ネストパスのmanaged指定
      const templateJson = {
        scripts: {
          dev: "turbo dev",
          build: "turbo build",
          custom: "echo custom",
        },
        dependencies: {
          react: "19.0.0",
        },
      };

      const existingJson = {
        scripts: {
          dev: "npm run dev",
          lint: "eslint .",
        },
        dependencies: {
          lodash: "4.0.0",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["scripts.dev", "scripts.build"],
        },
        "project-private": {
          "package.json": ["scripts.custom"],
        },
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: managed指定のネストパスは上書きされる
      expect(result.scripts).toEqual({
        dev: "turbo dev", // managed: テンプレートで上書き
        build: "turbo build", // managed: テンプレートで上書き
        lint: "eslint .", // 既存を保持
        custom: "echo custom", // seed: 存在しないのでコピー
      });
      // Then: dependenciesはディープマージされる
      expect(result.dependencies).toEqual({
        lodash: "4.0.0", // 既存を保持
        react: "19.0.0", // 既存にないので追加
      });
    });

    it("親パスがmanagedの場合、子パスも全て上書きされる", () => {
      // Given: 親パス全体がmanaged
      const templateJson = {
        scripts: {
          dev: "turbo dev",
          build: "turbo build",
        },
      };

      const existingJson = {
        scripts: {
          dev: "npm run dev",
          lint: "eslint .",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["scripts"],
        },
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: scripts全体がテンプレートで上書きされる
      expect(result.scripts).toEqual({
        dev: "turbo dev",
        build: "turbo build",
      });
    });

    it("深くネストしたパス（例: config.database.host）が正しく処理される", () => {
      // Given: 深いネストパス
      const templateJson = {
        config: {
          database: {
            host: "localhost",
            port: 5432,
          },
          cache: {
            ttl: 3600,
          },
        },
      };

      const existingJson = {
        config: {
          database: {
            host: "prod-db.example.com",
            port: 5432,
            password: "secret",
          },
          cache: {
            ttl: 7200,
          },
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["config.database.port"],
        },
        "project-private": {
          "package.json": ["config.cache.ttl"],
        },
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: managed指定のネストパスは上書きされ、それ以外は保持される
      expect(result).toEqual({
        config: {
          database: {
            host: "prod-db.example.com", // 既存を保持
            port: 5432, // managed: テンプレートで上書き
            password: "secret", // 既存を保持
          },
          cache: {
            ttl: 7200, // seed: 既存を保持
          },
        },
      });
    });
  });

  describe("複雑なケース", () => {
    it("managedとproject-privateが混在する場合、それぞれ正しく処理される", () => {
      // Given: managedとproject-private混在
      const templateJson = {
        version: "2.0.0", // managed
        scripts: {
          // seed
          dev: "next dev",
          build: "next build",
        },
        config: {
          // 指定なし
          value: "template",
        },
      };

      const existingJson = {
        version: "1.0.0",
        scripts: {
          dev: "custom dev",
        },
        config: {
          value: "user",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["version"],
        },
        "project-private": {
          "package.json": ["scripts"],
        },
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: managedは上書き、seedは保持、その他はローカル優先
      expect(result.version).toBe("2.0.0");
      expect(result.scripts).toEqual({ dev: "custom dev", build: "next build" });
      expect(result.config).toEqual({ value: "user" });
    });

    it("ローカルにのみ存在するキーが保持される", () => {
      // Given: ローカル独自のキー
      const templateJson = {
        name: "template",
      };

      const existingJson = {
        name: "user",
        customKey: "user-value",
        anotherKey: {
          nested: "value",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: ローカル独自のキーが保持される
      expect(result.customKey).toBe("user-value");
      expect(result.anotherKey).toEqual({ nested: "value" });
    });

    it("空オブジェクトが正しく処理される", () => {
      // Given: 空のmanaged/project-privateパス
      const templateJson = {
        name: "template",
      };

      const existingJson = {
        name: "user",
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: ローカル優先で結果が返る
      expect(result).toEqual({ name: "user" });
    });
  });

  describe("ディープコピーの検証", () => {
    it("マージ結果が元のオブジェクトとは独立したコピーであること", () => {
      // Given: ネストしたオブジェクト
      const templateJson = {
        config: {
          database: {
            host: "localhost",
          },
        },
      };

      const existingJson = {
        config: {
          database: {
            port: 5432,
          },
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // When: マージ結果を変更
      (result.config as Record<string, unknown>).newKey = "new-value";

      // Then: 元のオブジェクトは変更されない
      expect("newKey" in (existingJson.config as Record<string, unknown>)).toBe(false);
      expect("newKey" in (templateJson.config as Record<string, unknown>)).toBe(false);
    });

    it("managed指定でコピーされた値が独立していること", () => {
      // Given: managed指定でオブジェクトをコピー
      const templateJson = {
        dependencies: {
          react: "^18.0.0",
        },
      };

      const existingJson = {
        dependencies: {
          vue: "^3.0.0",
        },
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {
          "package.json": ["dependencies"],
        },
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // When: マージ結果のdependenciesを変更
      (result.dependencies as Record<string, unknown>).lodash = "^4.0.0";

      // Then: テンプレートの元オブジェクトは変更されない
      expect("lodash" in templateJson.dependencies).toBe(false);
    });

    it("seed指定でコピーされた値が独立していること", () => {
      // Given: seed指定でオブジェクトをコピー
      const templateJson = {
        scripts: {
          dev: "next dev",
        },
      };

      const existingJson = {};

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {
          "package.json": ["scripts"],
        },
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // When: マージ結果のscriptsを変更
      (result.scripts as Record<string, unknown>).test = "vitest";

      // Then: テンプレートの元オブジェクトは変更されない
      expect("test" in templateJson.scripts).toBe(false);
    });
  });

  describe("エッジケース", () => {
    it("テンプレートとローカルで完全に異なるキーセットの場合、両方が含まれる", () => {
      // Given: 完全に異なるキー
      const templateJson = {
        templateKey1: "value1",
        templateKey2: "value2",
      };

      const existingJson = {
        userKey1: "value1",
        userKey2: "value2",
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: 両方のキーが含まれる
      expect(result).toEqual({
        templateKey1: "value1",
        templateKey2: "value2",
        userKey1: "value1",
        userKey2: "value2",
      });
    });

    it("undefinedの値が正しく処理される", () => {
      // Given: undefined値を含む
      const templateJson = {
        key1: "value1",
        key2: undefined,
      };

      const existingJson = {
        key1: "user-value1",
        key3: "value3",
      };

      const jsonPaths: JsonPathsConfig = {
        managed: {},
        "project-private": {},
      };

      // When: マージ実行
      const result = mergeJson(templateJson, existingJson, jsonPaths, "package.json");

      // Then: 既存値が優先され、テンプレートのkey2はexistingJsonに存在しないのでundefinedのまま追加される
      expect(result.key1).toBe("user-value1");
      expect(result.key3).toBe("value3");
      expect("key2" in result).toBe(true);
      expect(result.key2).toBeUndefined();
    });
  });
});
