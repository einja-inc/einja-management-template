import { describe, expect, it } from "vitest";
import type { Conflict } from "../../types/sync.js";
import { ConflictReporter } from "./conflict-reporter.js";
import { DiffEngine } from "./diff-engine.js";

/**
 * タスクグループ1.3: 3方向マージエンジンとコンフリクト検出の統合テスト
 *
 * 受け入れ基準:
 * - AC7.1: コンフリクトマーカーが正しく挿入される（Integration）
 * - AC7.2: コンフリクト解消方法のヘルプメッセージが生成される（Unit - task-executerで検証済み）
 * - AC7.3: コンフリクトマーカーを検出できる（Integration）
 */
describe("DiffEngine と ConflictReporter の統合テスト", () => {
  const diffEngine = new DiffEngine();
  const conflictReporter = new ConflictReporter();

  describe("AC7.1: コンフリクトマーカーの挿入", () => {
    it("同じ行を異なる内容で変更した場合、コンフリクトマーカーが挿入される", () => {
      // Given: ローカルとテンプレートで同じ行を異なる内容で変更
      const base = "Hello World\nThis is a test\nEnd of file";
      const local = "Hello World\nThis is LOCAL change\nEnd of file";
      const template = "Hello World\nThis is TEMPLATE change\nEnd of file";

      // When: DiffEngine.merge3Wayを実行
      const result = diffEngine.merge3Way(base, local, template);

      // Then: コンフリクトマーカーが挿入される
      expect(result.success).toBe(false);
      expect(result.content).toContain("<<<<<<< LOCAL (your changes)");
      expect(result.content).toContain("This is LOCAL change");
      expect(result.content).toContain("=======");
      expect(result.content).toContain("This is TEMPLATE change");
      expect(result.content).toContain(">>>>>>> TEMPLATE (from @einja/cli)");

      // Then: conflicts配列にコンフリクト情報が含まれる
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        line: expect.any(Number),
        localContent: "This is LOCAL change",
        templateContent: "This is TEMPLATE change",
      });
    });

    it("複数箇所でコンフリクトが発生した場合、すべてマーカーが挿入される", () => {
      // Given: 複数箇所で変更
      const base = "Line 1\nLine 2\nLine 3\nLine 4";
      const local = "Line 1 LOCAL\nLine 2\nLine 3 LOCAL\nLine 4";
      const template = "Line 1 TEMPLATE\nLine 2\nLine 3 TEMPLATE\nLine 4";

      // When: マージを実行
      const result = diffEngine.merge3Way(base, local, template);

      // Then: 2つのコンフリクトが検出される
      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(2);

      // Then: 両方のコンフリクトにマーカーが挿入される
      const markerCount = (result.content.match(/<<<<<<< LOCAL/g) || []).length;
      expect(markerCount).toBe(2);
    });

    it("コンフリクトがない場合、マーカーは挿入されない", () => {
      // Given: ローカルのみ変更
      const base = "Hello World\nThis is a test\nEnd of file";
      const local = "Hello World\nThis is LOCAL change\nEnd of file";
      const template = base; // テンプレートは変更なし

      // When: マージを実行
      const result = diffEngine.merge3Way(base, local, template);

      // Then: コンフリクトなし
      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.content).not.toContain("<<<<<<< LOCAL");
      expect(result.content).toContain("This is LOCAL change");
    });
  });

  describe("AC7.2: コンフリクト解消方法のヘルプメッセージ", () => {
    it("formatExitMessageでコンフリクト情報とヘルプが含まれる", () => {
      // Given: コンフリクトが検出された
      const conflicts = new Map<string, Conflict[]>();
      conflicts.set(".claude/commands/einja/test.md", [
        {
          line: 10,
          localContent: "local content",
          templateContent: "template content",
        },
      ]);

      const report = conflictReporter.createReport(conflicts);

      // When: 終了メッセージを生成
      const message = conflictReporter.formatExitMessage(report);

      // Then: コンフリクト情報が含まれる
      expect(message).toContain("1件のコンフリクトが検出されました");
      expect(message).toContain(".claude/commands/einja/test.md");
      expect(message).toContain("行10");

      // Then: ヘルプメッセージが含まれる
      expect(message).toContain("💡 コンフリクト解消方法:");
      expect(message).toContain("<<<<<<< LOCAL と >>>>>>> TEMPLATE の間を手動編集");
      expect(message).toContain("コンフリクトマーカーを削除");
      expect(message).toContain("再度 sync を実行");

      // Then: 警告メッセージが含まれる
      expect(message).toContain("同期処理は部分的に完了しましたが、コンフリクトの解消が必要です");
    });

    it("formatHelpMessageが正しいフォーマットで生成される", () => {
      // When: ヘルプメッセージを生成
      const helpMessage = conflictReporter.formatHelpMessage();

      // Then: 必要な情報が含まれる
      expect(helpMessage).toContain("💡 コンフリクト解消方法:");
      expect(helpMessage).toContain("1. 上記ファイルを開く");
      expect(helpMessage).toContain("2. <<<<<<< LOCAL と >>>>>>> TEMPLATE の間を手動編集");
      expect(helpMessage).toContain("3. コンフリクトマーカーを削除");
      expect(helpMessage).toContain("4. 再度 sync を実行");
    });
  });

  describe("AC7.3: 未解決コンフリクトの検出", () => {
    it("hasConflictMarkersがコンフリクトマーカーを検出する", () => {
      // Given: コンフリクトファイルが存在
      const contentWithConflict = `Line 1
<<<<<<< LOCAL (your changes)
Local change
=======
Template change
>>>>>>> TEMPLATE (from @einja/cli)
Line 2`;

      // When: コンフリクトマーカーをチェック
      const hasConflict = diffEngine.hasConflictMarkers(contentWithConflict);

      // Then: trueを返す
      expect(hasConflict).toBe(true);
    });

    it("hasConflictMarkersがコンフリクトなしファイルをfalseと判定する", () => {
      // Given: 通常のファイル
      const contentWithoutConflict = "Line 1\nLine 2\nLine 3";

      // When: コンフリクトマーカーをチェック
      const hasConflict = diffEngine.hasConflictMarkers(contentWithoutConflict);

      // Then: falseを返す
      expect(hasConflict).toBe(false);
    });

    it("formatUnresolvedConflictErrorが適切なエラーメッセージを生成する", () => {
      // Given: 未解決のコンフリクトが存在
      const filePath = ".claude/commands/einja/test.md";

      // When: エラーメッセージを生成
      const errorMessage = conflictReporter.formatUnresolvedConflictError(filePath);

      // Then: "未解決のコンフリクトが存在します"メッセージが生成される
      expect(errorMessage).toContain("❌ 未解決のコンフリクトが存在します");
      expect(errorMessage).toContain(filePath);
      expect(errorMessage).toContain(
        "コンフリクトマーカー（<<<<<<< LOCAL, =======, >>>>>>> TEMPLATE）を解消してから再度実行してください"
      );
    });

    it("ConflictReporter.hasUnresolvedConflictsがマーカーを検出する", () => {
      // Given: コンフリクトマーカーを含むファイル
      const contentWithConflict = `Line 1
<<<<<<< LOCAL (your changes)
Local change
=======
Template change
>>>>>>> TEMPLATE (from @einja/cli)
Line 2`;

      // When: hasUnresolvedConflictsでチェック
      const hasConflict = conflictReporter.hasUnresolvedConflicts(contentWithConflict);

      // Then: trueを返す
      expect(hasConflict).toBe(true);
    });
  });

  describe("DiffEngine.parseConflictMarkers", () => {
    it("コンフリクトマーカーからコンフリクト情報を抽出できる", () => {
      // Given: コンフリクトマーカーを含むファイル
      const contentWithConflict = `Line 1
<<<<<<< LOCAL (your changes)
Local change 1
Local change 2
=======
Template change 1
Template change 2
>>>>>>> TEMPLATE (from @einja/cli)
Line 2`;

      // When: コンフリクトマーカーをパース
      const conflicts = diffEngine.parseConflictMarkers(contentWithConflict);

      // Then: コンフリクト情報が抽出される
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        line: 2,
        localContent: "Local change 1\nLocal change 2",
        templateContent: "Template change 1\nTemplate change 2",
      });
    });

    it("複数のコンフリクトマーカーをパースできる", () => {
      // Given: 複数のコンフリクトマーカー
      const contentWithConflicts = `Line 1
<<<<<<< LOCAL (your changes)
Local A
=======
Template A
>>>>>>> TEMPLATE (from @einja/cli)
Line 2
<<<<<<< LOCAL (your changes)
Local B
=======
Template B
>>>>>>> TEMPLATE (from @einja/cli)
Line 3`;

      // When: パース
      const conflicts = diffEngine.parseConflictMarkers(contentWithConflicts);

      // Then: 2つのコンフリクトが抽出される
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].localContent).toBe("Local A");
      expect(conflicts[1].localContent).toBe("Local B");
    });
  });

  describe("ConflictReporter.createReport", () => {
    it("複数ファイルのコンフリクトをレポートにまとめる", () => {
      // Given: 複数ファイルにコンフリクトが存在
      const conflicts = new Map<string, Conflict[]>();
      conflicts.set("file1.md", [
        { line: 10, localContent: "local1", templateContent: "template1" },
        { line: 20, localContent: "local2", templateContent: "template2" },
      ]);
      conflicts.set("file2.md", [
        { line: 5, localContent: "local3", templateContent: "template3" },
      ]);

      // When: レポートを作成
      const report = conflictReporter.createReport(conflicts);

      // Then: 総コンフリクト数が正しい
      expect(report.totalConflicts).toBe(3);
      expect(report.hasConflicts).toBe(true);
      expect(report.files).toHaveLength(2);

      // Then: ファイル情報が含まれる
      expect(report.files[0].path).toBe("file1.md");
      expect(report.files[0].conflicts).toHaveLength(2);
      expect(report.files[1].path).toBe("file2.md");
      expect(report.files[1].conflicts).toHaveLength(1);
    });

    it("コンフリクトがない場合、hasConflictsがfalse", () => {
      // Given: コンフリクトなし
      const conflicts = new Map<string, Conflict[]>();

      // When: レポートを作成
      const report = conflictReporter.createReport(conflicts);

      // Then: hasConflictsがfalse
      expect(report.hasConflicts).toBe(false);
      expect(report.totalConflicts).toBe(0);
      expect(report.files).toHaveLength(0);
    });

    it("formatReportが人間が読みやすい形式で出力する", () => {
      // Given: コンフリクトレポート
      const conflicts = new Map<string, Conflict[]>();
      conflicts.set(".claude/agents/einja/test.md", [
        { line: 15, localContent: "local", templateContent: "template" },
      ]);
      const report = conflictReporter.createReport(conflicts);

      // When: フォーマット
      const formatted = conflictReporter.formatReport(report);

      // Then: 適切にフォーマットされる
      expect(formatted).toContain("⚠️  1件のコンフリクトが検出されました");
      expect(formatted).toContain("📄 .claude/agents/einja/test.md (1箇所)");
      expect(formatted).toContain("- 行15");
    });
  });

  describe("AC5.3: ドライラン時のコンフリクト表示（統合）", () => {
    it("DiffEngine + ConflictReporterでコンフリクト検出とレポート生成が連携する", () => {
      // Given: コンフリクトが発生する状況
      const base = "Line 1\nLine 2\nLine 3";
      const local = "Line 1\nLocal Line 2\nLine 3";
      const template = "Line 1\nTemplate Line 2\nLine 3";

      // When: DiffEngineでマージを試行
      const mergeResult = diffEngine.merge3Way(base, local, template);

      // Then: マージが失敗し、コンフリクト情報が含まれる
      expect(mergeResult.success).toBe(false);
      expect(mergeResult.conflicts).toHaveLength(1);

      // When: ConflictReporterでレポート作成
      const conflicts = new Map<string, Conflict[]>();
      conflicts.set("test.md", mergeResult.conflicts);
      const report = conflictReporter.createReport(conflicts);

      // Then: レポートにコンフリクト情報が含まれる
      expect(report.hasConflicts).toBe(true);
      expect(report.totalConflicts).toBe(1);
      expect(report.files[0].path).toBe("test.md");

      // Then: フォーマット済みレポートに行番号とファイルパスが含まれる
      const formattedReport = conflictReporter.formatReport(report);
      expect(formattedReport).toContain("test.md");
      expect(formattedReport).toContain("行");
    });

    it("複数ファイルのコンフリクトをまとめてレポート生成できる", () => {
      // Given: 複数ファイルでコンフリクトが発生
      const base = "Content";
      const local1 = "Local Content 1";
      const template1 = "Template Content 1";
      const local2 = "Local Content 2";
      const template2 = "Template Content 2";

      // When: 各ファイルでマージを試行
      const result1 = diffEngine.merge3Way(base, local1, template1);
      const result2 = diffEngine.merge3Way(base, local2, template2);

      // When: ConflictReporterでレポート作成
      const conflicts = new Map<string, Conflict[]>();
      conflicts.set("file1.md", result1.conflicts);
      conflicts.set("file2.md", result2.conflicts);
      const report = conflictReporter.createReport(conflicts);

      // Then: 両ファイルのコンフリクトが含まれる
      expect(report.totalConflicts).toBe(2);
      expect(report.files).toHaveLength(2);

      // Then: フォーマット済みレポートに両ファイルの情報が含まれる
      const formattedReport = conflictReporter.formatReport(report);
      expect(formattedReport).toContain("file1.md");
      expect(formattedReport).toContain("file2.md");
      expect(formattedReport).toContain("2件のコンフリクトが検出されました");
    });

    it("コンフリクトがない場合、成功メッセージが返る", () => {
      // Given: コンフリクトが発生しない状況（異なる行を変更）
      const base = "Line 1\nLine 2\nLine 3\nLine 4";
      const local = "Line 1 - Local\nLine 2\nLine 3\nLine 4"; // Line 1を変更
      const template = "Line 1\nLine 2\nLine 3\nLine 4 - Template"; // Line 4を変更

      // When: マージを試行
      const mergeResult = diffEngine.merge3Way(base, local, template);

      // Then: マージが成功（異なる行を変更しているのでコンフリクトなし）
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.conflicts).toHaveLength(0);
      expect(mergeResult.content).toContain("Line 1 - Local");
      expect(mergeResult.content).toContain("Line 4 - Template");

      // When: ConflictReporterでレポート作成
      const conflicts = new Map<string, Conflict[]>();
      const report = conflictReporter.createReport(conflicts);

      // Then: コンフリクトなしのレポート
      expect(report.hasConflicts).toBe(false);
      expect(report.totalConflicts).toBe(0);

      // Then: フォーマット済みレポートでコンフリクトなしメッセージ
      const formattedReport = conflictReporter.formatReport(report);
      expect(formattedReport).toBe("コンフリクトは検出されませんでした。");
    });
  });
});
