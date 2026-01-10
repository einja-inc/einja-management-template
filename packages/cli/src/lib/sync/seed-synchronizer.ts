import { MarkerProcessor } from "./marker-processor.js";

/**
 * @einja:seedマーカーの同期を行うクラス
 *
 * seedマーカーはプロジェクト固有のテンプレートを提供します。
 * - ファイルにseed（ID）がない場合: テンプレートから追加
 * - ファイルにseed（ID）がある場合: 保持（上書きしない）
 */
export class SeedSynchronizer {
  private readonly processor = new MarkerProcessor();

  /**
   * seedセクションを同期する
   *
   * @param localContent - ローカルファイルの内容
   * @param templateContent - テンプレートファイルの内容
   * @returns 同期後の内容
   */
  syncSeeds(localContent: string, templateContent: string): string {
    // Given: ローカルとテンプレートのセクションをパース
    const localSections = this.processor.parseMarkers(localContent);
    const templateSections = this.processor.parseMarkers(templateContent);

    // Given: ローカルに存在するseedのIDを収集
    const localSeedIds = new Set<string>();
    for (const section of localSections) {
      if (section.type === "seed" && section.id) {
        localSeedIds.add(section.id);
      }
    }

    // When: テンプレートのseedセクションを取得
    const templateSeeds = templateSections.filter((section) => section.type === "seed");

    // When: ローカルに存在しないseedセクションを抽出
    const seedsToAdd = templateSeeds.filter(
      (seed) => seed.id && !localSeedIds.has(seed.id)
    );

    // Then: ローカルに追加するseedがない場合は、ローカルをそのまま返す
    if (seedsToAdd.length === 0) {
      return localContent;
    }

    // Then: ローカルの末尾にseedセクションを追加
    const lines = localContent.split("\n");
    const result: string[] = [...lines];

    // 末尾に空行がない場合は追加
    if (result.length > 0 && result[result.length - 1].trim() !== "") {
      result.push("");
    }

    for (const seed of seedsToAdd) {
      // セクション間に空行を追加
      if (result[result.length - 1] !== "") {
        result.push("");
      }
      result.push(seed.content);
    }

    return result.join("\n");
  }

  /**
   * ファイル全体がseed扱い（マーカーなし）の場合の同期処理
   *
   * @param localExists - ローカルにファイルが存在するか
   * @param templateContent - テンプレートファイルの内容
   * @returns 同期後の内容（ローカルが存在する場合はnull）
   */
  syncUnmarkedFile(localExists: boolean, templateContent: string): string | null {
    // Given: ローカルにファイルが存在しない場合
    if (!localExists) {
      // When: テンプレートをそのまま追加
      return templateContent;
    }

    // Then: ローカルが存在する場合は何もしない（利用者管理）
    return null;
  }
}
