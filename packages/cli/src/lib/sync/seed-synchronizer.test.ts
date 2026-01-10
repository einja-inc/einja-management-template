import { describe, expect, it } from "vitest";
import { SeedSynchronizer } from "./seed-synchronizer.js";

describe("SeedSynchronizer", () => {
  const synchronizer = new SeedSynchronizer();

  describe("syncSeeds", () => {
    it("ローカルに存在しないseedセクションがテンプレートに存在する場合、ローカルに追加されること", () => {
      // Given: ローカルにseedがない
      const localContent = `ローカル行1
ローカル行2`;

      // Given: テンプレートにseedがある
      const templateContent = `テンプレート行1
<!-- @einja:seed:start id="seed-1" -->
シードセクション1
<!-- @einja:seed:end -->
テンプレート行2`;

      // When: seedを同期
      const result = synchronizer.syncSeeds(localContent, templateContent);

      // Then: ローカルの末尾にseedが追加される
      expect(result).toContain("ローカル行1");
      expect(result).toContain("ローカル行2");
      expect(result).toContain('<!-- @einja:seed:start id="seed-1" -->');
      expect(result).toContain("シードセクション1");
      expect(result).toContain("<!-- @einja:seed:end -->");
    });

    it("ローカルに既に存在するseedセクションは上書きされないこと", () => {
      // Given: ローカルにseedがある
      const localContent = `ローカル行1
<!-- @einja:seed:start id="seed-1" -->
ローカルシードセクション1
<!-- @einja:seed:end -->
ローカル行2`;

      // Given: テンプレートに同じIDのseedがある
      const templateContent = `テンプレート行1
<!-- @einja:seed:start id="seed-1" -->
テンプレートシードセクション1
<!-- @einja:seed:end -->
テンプレート行2`;

      // When: seedを同期
      const result = synchronizer.syncSeeds(localContent, templateContent);

      // Then: ローカルがそのまま保持される
      expect(result).toBe(localContent);
      expect(result).toContain("ローカルシードセクション1");
      expect(result).not.toContain("テンプレートシードセクション1");
    });

    it("ローカルに一部のseedが存在し、テンプレートに新しいseedがある場合、新しいseedのみ追加されること", () => {
      // Given: ローカルにseed-1がある
      const localContent = `ローカル行1
<!-- @einja:seed:start id="seed-1" -->
ローカルシードセクション1
<!-- @einja:seed:end -->
ローカル行2`;

      // Given: テンプレートにseed-1とseed-2がある
      const templateContent = `テンプレート行1
<!-- @einja:seed:start id="seed-1" -->
テンプレートシードセクション1
<!-- @einja:seed:end -->
テンプレート行2
<!-- @einja:seed:start id="seed-2" -->
テンプレートシードセクション2
<!-- @einja:seed:end -->
テンプレート行3`;

      // When: seedを同期
      const result = synchronizer.syncSeeds(localContent, templateContent);

      // Then: seed-1はそのまま、seed-2が追加される
      expect(result).toContain("ローカルシードセクション1");
      expect(result).not.toContain("テンプレートシードセクション1");
      expect(result).toContain('<!-- @einja:seed:start id="seed-2" -->');
      expect(result).toContain("テンプレートシードセクション2");
      expect(result).toContain("<!-- @einja:seed:end -->");
    });

    it("複数の新しいseedセクションが追加される場合、全て追加されること", () => {
      // Given: ローカルにseedがない
      const localContent = "ローカル行1";

      // Given: テンプレートに複数のseedがある
      const templateContent = `テンプレート行1
<!-- @einja:seed:start id="seed-1" -->
シードセクション1
<!-- @einja:seed:end -->
テンプレート行2
<!-- @einja:seed:start id="seed-2" -->
シードセクション2
<!-- @einja:seed:end -->
テンプレート行3`;

      // When: seedを同期
      const result = synchronizer.syncSeeds(localContent, templateContent);

      // Then: 全てのseedが追加される
      expect(result).toContain('<!-- @einja:seed:start id="seed-1" -->');
      expect(result).toContain("シードセクション1");
      expect(result).toContain('<!-- @einja:seed:start id="seed-2" -->');
      expect(result).toContain("シードセクション2");
    });

    it("managedセクションとseedセクションが混在する場合、seedのみが同期対象となること", () => {
      // Given: ローカルにmanagedとseedがある
      const localContent = `ローカル行1
<!-- @einja:managed:start -->
ローカル管理セクション
<!-- @einja:managed:end -->
<!-- @einja:seed:start id="seed-1" -->
ローカルシードセクション
<!-- @einja:seed:end -->
ローカル行2`;

      // Given: テンプレートにmanagedとseed-1、seed-2がある
      const templateContent = `テンプレート行1
<!-- @einja:managed:start -->
テンプレート管理セクション
<!-- @einja:managed:end -->
<!-- @einja:seed:start id="seed-1" -->
テンプレートシードセクション1
<!-- @einja:seed:end -->
<!-- @einja:seed:start id="seed-2" -->
テンプレートシードセクション2
<!-- @einja:seed:end -->
テンプレート行2`;

      // When: seedを同期
      const result = synchronizer.syncSeeds(localContent, templateContent);

      // Then: seed-2のみ追加、seed-1とmanagedは元のまま
      expect(result).toContain("ローカル管理セクション");
      expect(result).toContain("ローカルシードセクション");
      expect(result).not.toContain("テンプレートシードセクション1");
      expect(result).toContain('<!-- @einja:seed:start id="seed-2" -->');
      expect(result).toContain("テンプレートシードセクション2");
    });
  });

  describe("syncUnmarkedFile", () => {
    it("ローカルにファイルが存在しない場合、テンプレート内容を返すこと", () => {
      // Given: ローカルにファイルが存在しない
      const localExists = false;
      const templateContent = `テンプレート行1
テンプレート行2`;

      // When: マーカーなしファイルを同期
      const result = synchronizer.syncUnmarkedFile(localExists, templateContent);

      // Then: テンプレート内容が返る
      expect(result).toBe(templateContent);
    });

    it("ローカルにファイルが存在する場合、nullを返すこと（何もしない）", () => {
      // Given: ローカルにファイルが存在する
      const localExists = true;
      const templateContent = `テンプレート行1
テンプレート行2`;

      // When: マーカーなしファイルを同期
      const result = synchronizer.syncUnmarkedFile(localExists, templateContent);

      // Then: nullが返る（何もしない）
      expect(result).toBeNull();
    });
  });
});
