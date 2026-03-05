import { MarkerProcessor } from "./marker-processor.js";

/**
 * @einja:project-privateマーカーの同期を行うクラス
 *
 * project-privateマーカーはプロジェクト固有のテンプレートを提供します。
 * - ファイルにproject-private（ID）がない場合: テンプレートから追加
 * - ファイルにproject-private（ID）がある場合: 保持（上書きしない）
 */
export class ProjectPrivateSynchronizer {
  private readonly processor = new MarkerProcessor();

  /**
   * project-privateセクションを同期する
   *
   * @param localContent - ローカルファイルの内容
   * @param templateContent - テンプレートファイルの内容
   * @returns 同期後の内容
   */
  syncProjectPrivateSections(localContent: string, templateContent: string): string {
    // Given: ローカルとテンプレートのセクションをパース
    const localSections = this.processor.parseMarkers(localContent);
    const templateSections = this.processor.parseMarkers(templateContent);

    // Given: ローカルに存在するproject-privateのIDを収集
    const localProjectPrivateIds = new Set<string>();
    for (const section of localSections) {
      if (section.type === "project-private" && section.id) {
        localProjectPrivateIds.add(section.id);
      }
    }

    // When: テンプレートのproject-privateセクションを取得
    const templateProjectPrivates = templateSections.filter((section) => section.type === "project-private");

    // When: ローカルに存在しないproject-privateセクションを抽出
    const projectPrivatesToAdd = templateProjectPrivates.filter((pp) => pp.id && !localProjectPrivateIds.has(pp.id));

    // Then: ローカルに追加するproject-privateがない場合は、ローカルをそのまま返す
    if (projectPrivatesToAdd.length === 0) {
      return localContent;
    }

    // Then: ローカルの末尾にproject-privateセクションを追加
    const lines = localContent.split("\n");
    const result: string[] = [...lines];

    // 末尾に空行がない場合は追加
    if (result.length > 0 && result[result.length - 1].trim() !== "") {
      result.push("");
    }

    for (const pp of projectPrivatesToAdd) {
      // セクション間に空行を追加
      if (result[result.length - 1] !== "") {
        result.push("");
      }
      result.push(pp.content);
    }

    return result.join("\n");
  }

  /**
   * ファイル全体がproject-private扱い（マーカーなし）の場合の同期処理
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

  /**
   * managedなしファイル（project-privateのみ）の同期処理
   *
   * 1. base版・テンプレート・ローカルの3つからproject-privateセクションを抽出
   * 2. 残りの本文を3方向マージで処理（テンプレート更新が反映される）
   * 3. ローカル版のproject-privateセクションをファイル末尾に再付加
   * 4. ローカルにproject-privateがなければテンプレート版をseed
   *
   * @param localContent - ローカルファイルの内容
   * @param templateContent - テンプレートファイルの内容
   * @param baseContent - ベースファイルの内容
   * @param diffEngine - DiffEngineインスタンス
   * @returns マージ結果
   */
  syncProjectPrivateOnlyFile(
    localContent: string,
    templateContent: string,
    baseContent: string,
    // biome-ignore lint/suspicious/noExplicitAny: DiffEngineの型がConflict[]を返すため
    diffEngine: { merge3Way: (base: string, local: string, template: string) => { success: boolean; content: string; conflicts: any[] } }
    // biome-ignore lint/suspicious/noExplicitAny: DiffEngineの型がConflict[]を返すため
  ): { content: string; success: boolean; conflicts: any[] } {
    // project-privateセクションを抽出
    const localPpSections = this.processor.extractProjectPrivateSections(localContent);
    const templatePpSections = this.processor.extractProjectPrivateSections(templateContent);

    // 本文を取得（project-privateを除去）
    const localBody = this.processor.stripProjectPrivateSections(localContent);
    const templateBody = this.processor.stripProjectPrivateSections(templateContent);
    const baseBody = this.processor.stripProjectPrivateSections(baseContent);

    // 本文を3方向マージ
    const mergeResult = diffEngine.merge3Way(baseBody, localBody, templateBody);

    // ローカルにproject-privateがあればそれを保持、なければテンプレートのものをseed
    const ppToAttach = localPpSections.length > 0 ? localPpSections : templatePpSections;

    // マージ結果にproject-privateを再付加
    const finalContent = this.processor.reattachProjectPrivateSections(mergeResult.content, ppToAttach);

    return {
      content: finalContent,
      success: mergeResult.success,
      conflicts: mergeResult.conflicts,
    };
  }
}
