import { describe, it, expect } from "vitest";
import { getDefaultAddConfig } from "../../../src/prompts/add.js";

describe("getDefaultAddConfig", () => {
  it("全コンポーネントが選択状態で返される", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: 全コンポーネントが選択されている
    expect(config.components.packages).toBe(true);
    expect(config.components.apps).toBe(true);
    expect(config.components.config).toBe(true);
  });

  it("全パッケージが含まれる", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: 全パッケージコンポーネントが含まれる
    expect(config.packageComponents).toEqual([
      "front-core",
      "server-core",
      "config",
      "ui",
    ]);
    expect(config.packageComponents).toHaveLength(4);
  });

  it("全アプリが含まれる", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: 全アプリコンポーネントが含まれる
    expect(config.appComponents).toEqual(["web"]);
    expect(config.appComponents).toHaveLength(1);
  });

  it("dryRunがfalseである", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: dryRunがfalse
    expect(config.dryRun).toBe(false);
  });

  it("返される設定が正しい型構造を持つ", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: 正しい型構造を持つ
    expect(config).toHaveProperty("components");
    expect(config).toHaveProperty("packageComponents");
    expect(config).toHaveProperty("appComponents");
    expect(config).toHaveProperty("dryRun");

    expect(config.components).toHaveProperty("packages");
    expect(config.components).toHaveProperty("apps");
    expect(config.components).toHaveProperty("config");
  });

  it("packageComponentsが正しい型の配列である", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: packageComponentsが文字列配列
    expect(Array.isArray(config.packageComponents)).toBe(true);
    for (const component of config.packageComponents) {
      expect(typeof component).toBe("string");
      expect(["front-core", "server-core", "config", "ui"]).toContain(component);
    }
  });

  it("appComponentsが正しい型の配列である", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config = getDefaultAddConfig();

    // Then: appComponentsが文字列配列
    expect(Array.isArray(config.appComponents)).toBe(true);
    for (const component of config.appComponents) {
      expect(typeof component).toBe("string");
      expect(["web"]).toContain(component);
    }
  });

  it("複数回呼び出しても同じ結果が返る", () => {
    // Given: 複数回デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config1 = getDefaultAddConfig();
    const config2 = getDefaultAddConfig();

    // Then: 同じ設定が返る
    expect(config1).toEqual(config2);
  });

  it("返される設定がイミュータブルである", () => {
    // Given: デフォルト設定を取得
    // When: getDefaultAddConfig実行
    const config1 = getDefaultAddConfig();
    const config2 = getDefaultAddConfig();

    // When: config1を変更
    config1.dryRun = true;
    config1.packageComponents.push("config" as never);

    // Then: config2は変更されない
    expect(config2.dryRun).toBe(false);
    expect(config2.packageComponents).toHaveLength(4);
  });
});
