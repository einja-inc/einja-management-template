import { describe, expect, it } from "vitest";
import { ProjectPrivateSynchronizer } from "./project-private-synchronizer.js";

describe("ProjectPrivateSynchronizer", () => {
  const synchronizer = new ProjectPrivateSynchronizer();

  describe("syncProjectPrivateSections", () => {
    it("ローカルに存在しないproject-privateセクションがテンプレートに存在する場合、ローカルに追加されること", () => {
      // Given: ローカルにproject-privateがない
      const localContent = `ローカル行1
ローカル行2`;

      // Given: テンプレートにproject-privateがある
      const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="pp-1" -->
プロジェクト固有セクション1
<!-- @einja:project-private:end -->
テンプレート行2`;

      // When: project-privateを同期
      const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

      // Then: ローカルの末尾にproject-privateが追加される
      expect(result).toContain("ローカル行1");
      expect(result).toContain("ローカル行2");
      expect(result).toContain('<!-- @einja:project-private:start id="pp-1" -->');
      expect(result).toContain("プロジェクト固有セクション1");
      expect(result).toContain("<!-- @einja:project-private:end -->");
    });

    it("ローカルに既に存在するproject-privateセクションは上書きされないこと", () => {
      // Given: ローカルにproject-privateがある
      const localContent = `ローカル行1
<!-- @einja:project-private:start id="pp-1" -->
ローカルプロジェクト固有セクション1
<!-- @einja:project-private:end -->
ローカル行2`;

      // Given: テンプレートに同じIDのproject-privateがある
      const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="pp-1" -->
テンプレートプロジェクト固有セクション1
<!-- @einja:project-private:end -->
テンプレート行2`;

      // When: project-privateを同期
      const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

      // Then: ローカルがそのまま保持される
      expect(result).toBe(localContent);
      expect(result).toContain("ローカルプロジェクト固有セクション1");
      expect(result).not.toContain("テンプレートプロジェクト固有セクション1");
    });

    it("ローカルに一部のproject-privateが存在し、テンプレートに新しいproject-privateがある場合、新しいproject-privateのみ追加されること", () => {
      // Given: ローカルにpp-1がある
      const localContent = `ローカル行1
<!-- @einja:project-private:start id="pp-1" -->
ローカルプロジェクト固有セクション1
<!-- @einja:project-private:end -->
ローカル行2`;

      // Given: テンプレートにpp-1とpp-2がある
      const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="pp-1" -->
テンプレートプロジェクト固有セクション1
<!-- @einja:project-private:end -->
テンプレート行2
<!-- @einja:project-private:start id="pp-2" -->
テンプレートプロジェクト固有セクション2
<!-- @einja:project-private:end -->
テンプレート行3`;

      // When: project-privateを同期
      const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

      // Then: pp-1はそのまま、pp-2が追加される
      expect(result).toContain("ローカルプロジェクト固有セクション1");
      expect(result).not.toContain("テンプレートプロジェクト固有セクション1");
      expect(result).toContain('<!-- @einja:project-private:start id="pp-2" -->');
      expect(result).toContain("テンプレートプロジェクト固有セクション2");
      expect(result).toContain("<!-- @einja:project-private:end -->");
    });

    it("複数の新しいproject-privateセクションが追加される場合、全て追加されること", () => {
      // Given: ローカルにproject-privateがない
      const localContent = "ローカル行1";

      // Given: テンプレートに複数のproject-privateがある
      const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="pp-1" -->
プロジェクト固有セクション1
<!-- @einja:project-private:end -->
テンプレート行2
<!-- @einja:project-private:start id="pp-2" -->
プロジェクト固有セクション2
<!-- @einja:project-private:end -->
テンプレート行3`;

      // When: project-privateを同期
      const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

      // Then: 全てのproject-privateが追加される
      expect(result).toContain('<!-- @einja:project-private:start id="pp-1" -->');
      expect(result).toContain("プロジェクト固有セクション1");
      expect(result).toContain('<!-- @einja:project-private:start id="pp-2" -->');
      expect(result).toContain("プロジェクト固有セクション2");
    });

    it("managedセクションとproject-privateセクションが混在する場合、project-privateのみが同期対象となること", () => {
      // Given: ローカルにmanagedとproject-privateがある
      const localContent = `ローカル行1
<!-- @einja:managed:start -->
ローカル管理セクション
<!-- @einja:managed:end -->
<!-- @einja:project-private:start id="pp-1" -->
ローカルプロジェクト固有セクション
<!-- @einja:project-private:end -->
ローカル行2`;

      // Given: テンプレートにmanagedとpp-1、pp-2がある
      const templateContent = `テンプレート行1
<!-- @einja:managed:start -->
テンプレート管理セクション
<!-- @einja:managed:end -->
<!-- @einja:project-private:start id="pp-1" -->
テンプレートプロジェクト固有セクション1
<!-- @einja:project-private:end -->
<!-- @einja:project-private:start id="pp-2" -->
テンプレートプロジェクト固有セクション2
<!-- @einja:project-private:end -->
テンプレート行2`;

      // When: project-privateを同期
      const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

      // Then: pp-2のみ追加、pp-1とmanagedは元のまま
      expect(result).toContain("ローカル管理セクション");
      expect(result).toContain("ローカルプロジェクト固有セクション");
      expect(result).not.toContain("テンプレートプロジェクト固有セクション1");
      expect(result).toContain('<!-- @einja:project-private:start id="pp-2" -->');
      expect(result).toContain("テンプレートプロジェクト固有セクション2");
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

  describe("syncProjectPrivateOnlyFile", () => {
    it("managedなしファイルで本文の3方向マージとproject-private保持が行われること", () => {
      const localContent = `# ドキュメント

本文がローカルで変更されました

<!-- @einja:project-private:start id="pp-1" -->
## プロジェクト固有設定
ローカルの固有内容
<!-- @einja:project-private:end -->`;

      const templateContent = `# ドキュメント

本文がテンプレートで更新されました

<!-- @einja:project-private:start id="pp-1" -->
## プロジェクト固有設定
テンプレートのデフォルト内容
<!-- @einja:project-private:end -->`;

      const baseContent = `# ドキュメント

元の本文

<!-- @einja:project-private:start id="pp-1" -->
## プロジェクト固有設定
テンプレートのデフォルト内容
<!-- @einja:project-private:end -->`;

      const mockDiffEngine = {
        merge3Way: (base: string, local: string, template: string) => ({
          success: true,
          content: template, // テンプレート側を採用（baseからlocalは変更なし想定時）
          conflicts: [],
        }),
      };

      const result = synchronizer.syncProjectPrivateOnlyFile(
        localContent, templateContent, baseContent, mockDiffEngine
      );

      // project-privateセクションはローカル版が保持される
      expect(result.content).toContain("ローカルの固有内容");
      expect(result.content).not.toContain("テンプレートのデフォルト内容");
      expect(result.success).toBe(true);
    });

    it("ローカルにproject-privateがない場合、テンプレート版がseedされること", () => {
      const localContent = `# ドキュメント

ローカル本文`;

      const templateContent = `# ドキュメント

テンプレート本文

<!-- @einja:project-private:start id="pp-1" -->
## プロジェクト固有設定
デフォルト内容
<!-- @einja:project-private:end -->`;

      const baseContent = `# ドキュメント

元の本文`;

      const mockDiffEngine = {
        merge3Way: (_base: string, _local: string, template: string) => ({
          success: true,
          content: template,
          conflicts: [],
        }),
      };

      const result = synchronizer.syncProjectPrivateOnlyFile(
        localContent, templateContent, baseContent, mockDiffEngine
      );

      // テンプレートのproject-privateがseedされる
      expect(result.content).toContain("デフォルト内容");
      expect(result.success).toBe(true);
    });
  });

  describe("legacy @einja:seed マーカーとの互換性", () => {
    describe("syncProjectPrivateSections", () => {
      it("ローカルがlegacy seed → ID認識して重複追加しない", () => {
        // Given: ローカルにlegacy seedマーカーがある
        const localContent = `ローカル行1
<!-- @einja:seed:start id="intro" -->
ユーザーコンテンツ
<!-- @einja:seed:end -->
ローカル行2`;

        // Given: テンプレートに同じIDのproject-privateがある
        const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="intro" -->
デフォルト
<!-- @einja:project-private:end -->
テンプレート行2`;

        // When: project-privateを同期
        const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

        // Then: ローカルがそのまま返る（テンプレートで上書きしない）
        expect(result).toBe(localContent);
        expect(result).toContain("ユーザーコンテンツ");
        expect(result).not.toContain("デフォルト");
      });

      it("ローカルがlegacy seed + テンプレートが新規PP → 新規のみ追加", () => {
        // Given: ローカルにlegacy seedのintroがある
        const localContent = `ローカル行1
<!-- @einja:seed:start id="intro" -->
ユーザーコンテンツ
<!-- @einja:seed:end -->
ローカル行2`;

        // Given: テンプレートにintroと新しいnew-sectionがある
        const templateContent = `テンプレート行1
<!-- @einja:project-private:start id="intro" -->
デフォルト
<!-- @einja:project-private:end -->
テンプレート行2
<!-- @einja:project-private:start id="new-section" -->
新しいセクション
<!-- @einja:project-private:end -->
テンプレート行3`;

        // When: project-privateを同期
        const result = synchronizer.syncProjectPrivateSections(localContent, templateContent);

        // Then: ローカルのseedセクションは保持される
        expect(result).toContain("ユーザーコンテンツ");
        expect(result).not.toContain("デフォルト");
        // Then: 新しいnew-sectionのみ追加される
        expect(result).toContain('<!-- @einja:project-private:start id="new-section" -->');
        expect(result).toContain("新しいセクション");
      });
    });

    describe("syncProjectPrivateOnlyFile", () => {
      it("legacy seedファイル → PP抽出・本文マージ・PP再付加が動く", () => {
        // Given: ローカルにlegacy seedマーカーがある
        const localContent = `# ドキュメント

本文がローカルで変更されました

<!-- @einja:seed:start id="custom" -->
カスタム内容
<!-- @einja:seed:end -->`;

        // Given: テンプレートにproject-privateマーカーがある
        const templateContent = `# ドキュメント

本文がテンプレートで更新されました

<!-- @einja:project-private:start id="custom" -->
デフォルト
<!-- @einja:project-private:end -->`;

        // Given: ベースにproject-privateマーカーがある
        const baseContent = `# ドキュメント

元の本文

<!-- @einja:project-private:start id="custom" -->
デフォルト
<!-- @einja:project-private:end -->`;

        const mockDiffEngine = {
          merge3Way: (_base: string, _local: string, template: string) => ({
            success: true,
            content: template,
            conflicts: [],
          }),
        };

        // When: syncProjectPrivateOnlyFileを実行
        const result = synchronizer.syncProjectPrivateOnlyFile(
          localContent, templateContent, baseContent, mockDiffEngine
        );

        // Then: マージが成功する
        expect(result.success).toBe(true);
        // Then: ローカルのlegacy seedセクション内容が保持される
        expect(result.content).toContain("カスタム内容");
        // Then: テンプレートのデフォルト内容で上書きされない
        expect(result.content).not.toContain("デフォルト");
      });

      it("legacy seedの空セクション → 存在扱い（テンプレートでseedしない）", () => {
        // Given: ローカルにlegacy seedの空セクションがある
        const localContent = `# ドキュメント

本文

<!-- @einja:seed:start id="custom" -->
<!-- @einja:seed:end -->`;

        // Given: テンプレートにproject-privateマーカーがある
        const templateContent = `# ドキュメント

本文

<!-- @einja:project-private:start id="custom" -->
デフォルト内容
<!-- @einja:project-private:end -->`;

        // Given: ベースにproject-privateマーカーがある
        const baseContent = `# ドキュメント

本文

<!-- @einja:project-private:start id="custom" -->
デフォルト内容
<!-- @einja:project-private:end -->`;

        const mockDiffEngine = {
          merge3Way: (_base: string, _local: string, template: string) => ({
            success: true,
            content: template,
            conflicts: [],
          }),
        };

        // When: syncProjectPrivateOnlyFileを実行
        const result = synchronizer.syncProjectPrivateOnlyFile(
          localContent, templateContent, baseContent, mockDiffEngine
        );

        // Then: マージが成功する
        expect(result.success).toBe(true);
        // Then: ローカルの空seedセクションが保持される（テンプレート版でseedしない）
        expect(result.content).toContain('<!-- @einja:seed:start id="custom" -->');
        expect(result.content).toContain("<!-- @einja:seed:end -->");
        // Then: テンプレートのデフォルト内容は含まれない
        expect(result.content).not.toContain("デフォルト内容");
      });
    });
  });
});
