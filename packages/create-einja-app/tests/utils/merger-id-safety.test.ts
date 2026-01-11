import { describe, it, expect } from "vitest";
import { mergeTextWithMarkers } from "../../src/utils/merger.js";

describe("mergeTextWithMarkers - ID安全性テスト", () => {
  it("テンプレートの先頭に新しいID付きmanagedセクションが追加された場合、IDなしセクションはテンプレートで上書きされる", () => {
    // Given: ローカルにIDなしmanagedセクションが1つ存在
    const localContent = `# ドキュメント

<!-- @einja:managed:start -->
既存のローカル内容
<!-- @einja:managed:end -->

その他の内容`;

    // Given: テンプレートに新しいID付きセクションが先頭に追加され、既存セクションはIDなしのまま
    const templateContent = `# ドキュメント

<!-- @einja:managed:start id="new-section" -->
新しいセクション（ID付き）
<!-- @einja:managed:end -->

<!-- @einja:managed:start -->
テンプレートの内容（IDなし）
<!-- @einja:managed:end -->

その他の内容`;

    // When: マージを実行
    const result = mergeTextWithMarkers(templateContent, localContent);

    // Then: IDなしセクションはテンプレート内容で上書きされる
    expect(result).toContain("テンプレートの内容（IDなし）");
    expect(result).not.toContain("既存のローカル内容");

    // Then: 新しいID付きセクションは末尾に追加される
    expect(result).toContain("新しいセクション（ID付き）");
    const newSectionIndex = result.indexOf("新しいセクション（ID付き）");
    const existingContentIndex = result.indexOf("テンプレートの内容（IDなし）");
    expect(newSectionIndex).toBeGreaterThan(existingContentIndex);
  });

  it("ローカルとテンプレートの両方にID付きmanagedセクションがある場合、IDマッチでテンプレートが上書きする", () => {
    // Given: ローカルにID付きmanagedセクションが存在
    const localContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
ローカルのセクションA
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-b" -->
ローカルのセクションB
<!-- @einja:managed:end -->`;

    // Given: テンプレートにも同じIDのセクションが存在（内容が更新されている）
    const templateContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
テンプレートのセクションA（更新済み）
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-b" -->
テンプレートのセクションB（更新済み）
<!-- @einja:managed:end -->`;

    // When: マージを実行
    const result = mergeTextWithMarkers(templateContent, localContent);

    // Then: IDマッチでテンプレートの内容に上書きされる
    expect(result).toContain("テンプレートのセクションA（更新済み）");
    expect(result).toContain("テンプレートのセクションB（更新済み）");
    expect(result).not.toContain("ローカルのセクションA");
    expect(result).not.toContain("ローカルのセクションB");
  });

  it("テンプレートにのみ存在するID付きセクションは末尾に追加される", () => {
    // Given: ローカルに既存セクション
    const localContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
ローカルのセクションA
<!-- @einja:managed:end -->`;

    // Given: テンプレートに新しいID付きセクションが追加されている
    const templateContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
テンプレートのセクションA
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-b" -->
テンプレートのセクションB（新規）
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-c" -->
テンプレートのセクションC（新規）
<!-- @einja:managed:end -->`;

    // When: マージを実行
    const result = mergeTextWithMarkers(templateContent, localContent);

    // Then: 既存セクションは上書きされる
    expect(result).toContain("テンプレートのセクションA");

    // Then: 新しいセクションは末尾に追加される
    expect(result).toContain("テンプレートのセクションB（新規）");
    expect(result).toContain("テンプレートのセクションC（新規）");

    const sectionAIndex = result.indexOf("テンプレートのセクションA");
    const sectionBIndex = result.indexOf("テンプレートのセクションB（新規）");
    const sectionCIndex = result.indexOf("テンプレートのセクションC（新規）");

    expect(sectionBIndex).toBeGreaterThan(sectionAIndex);
    expect(sectionCIndex).toBeGreaterThan(sectionBIndex);
  });

  it("IDなしmanagedセクションが複数ある場合、テンプレート内容で上書きされる", () => {
    // Given: ローカルに複数のIDなしmanagedセクションが存在
    const localContent = `# ドキュメント

<!-- @einja:managed:start -->
ローカルセクション1
<!-- @einja:managed:end -->

中間コンテンツ

<!-- @einja:managed:start -->
ローカルセクション2
<!-- @einja:managed:end -->`;

    // Given: テンプレートにも複数のIDなしセクションがあるが内容が異なる
    const templateContent = `# ドキュメント

<!-- @einja:managed:start -->
テンプレートセクション1
<!-- @einja:managed:end -->

中間コンテンツ

<!-- @einja:managed:start -->
テンプレートセクション2
<!-- @einja:managed:end -->`;

    // When: マージを実行
    const result = mergeTextWithMarkers(templateContent, localContent);

    // Then: すべてのIDなしセクションはテンプレート内容で上書きされる
    expect(result).toContain("テンプレートセクション1");
    expect(result).toContain("テンプレートセクション2");
    expect(result).not.toContain("ローカルセクション1");
    expect(result).not.toContain("ローカルセクション2");
  });

  it("混在ケース: ID付きとIDなしのmanagedセクションが両方存在する", () => {
    // Given: ローカルにID付きとIDなしのセクションが混在
    const localContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
ローカルのセクションA（ID付き）
<!-- @einja:managed:end -->

<!-- @einja:managed:start -->
ローカルのセクションB（IDなし）
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-c" -->
ローカルのセクションC（ID付き）
<!-- @einja:managed:end -->`;

    // Given: テンプレートにも同じ構造があり、一部内容が更新されている
    const templateContent = `# ドキュメント

<!-- @einja:managed:start id="section-a" -->
テンプレートのセクションA（更新済み）
<!-- @einja:managed:end -->

<!-- @einja:managed:start -->
テンプレートのセクションB（IDなし・更新済み）
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-c" -->
テンプレートのセクションC（更新済み）
<!-- @einja:managed:end -->

<!-- @einja:managed:start id="section-d" -->
テンプレートのセクションD（新規・ID付き）
<!-- @einja:managed:end -->`;

    // When: マージを実行
    const result = mergeTextWithMarkers(templateContent, localContent);

    // Then: ID付きセクションはテンプレートで上書き
    expect(result).toContain("テンプレートのセクションA（更新済み）");
    expect(result).toContain("テンプレートのセクションC（更新済み）");

    // Then: IDなしセクションはテンプレートで上書き
    expect(result).toContain("テンプレートのセクションB（IDなし・更新済み）");
    expect(result).not.toContain("ローカルのセクションB（IDなし）");

    // Then: 新規ID付きセクションは末尾に追加
    expect(result).toContain("テンプレートのセクションD（新規・ID付き）");
  });
});
