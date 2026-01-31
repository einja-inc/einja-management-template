import { describe, it, expect } from "vitest";
import { detectHorizontalSplit } from "./horizontal-split-detector.js";
import type { Phase } from "./types.js";

describe("横切り分割検出", () => {
  describe("横切りパターンを検出する", () => {
    it("Issue #80パターンを渡すと、横切りとして検出され、マッチしたタスクグループの詳細が返される", () => {
      // Given: 横切り分割のPhase
      const phase: Phase = {
        number: 1,
        name: "基盤構築と収入管理機能",
        taskGroups: [
          { id: "1.1", name: "データモデル設計と基盤構築", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "ドメイン層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "インフラストラクチャ層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.4", name: "アプリケーション層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.5", name: "収入API実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.6", name: "フロントエンド実装 - 収入管理", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 検出結果の詳細を検証
      expect(result).not.toBeNull();
      expect(result?.isHorizontalSplit).toBe(true);
      expect(result?.phaseNumber).toBe(1);
      expect(result?.matchedTaskGroups.length).toBeGreaterThanOrEqual(3);

      // マッチしたレイヤー名を検証
      const layerNames = result?.matchedTaskGroups.map(m => m.layerName);
      expect(layerNames).toContain("Domain");
      expect(layerNames).toContain("Infrastructure");
      expect(layerNames).toContain("Application");

      // reason, suggestionの検証
      expect(result?.reason).toContain("レイヤー名が含まれています");
      expect(result?.suggestion).toContain("縦切り");
    });

    it("「インフラストラクチャ層実装」を含むPhaseを渡すと、Infrastructureレイヤーとして検出される", () => {
      // Given: インフラストラクチャ層を含むPhase
      const phase: Phase = {
        number: 1,
        name: "機能実装",
        taskGroups: [
          { id: "1.1", name: "ドメイン層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "インフラストラクチャ層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "アプリケーション層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 横切りとして検出され、Infrastructureが含まれる
      expect(result).not.toBeNull();
      const layerNames = result?.matchedTaskGroups.map(m => m.layerName);
      expect(layerNames).toContain("Infrastructure");
    });

    it("レイヤー名の後に機能名が続くパターンを渡すと、横切りとして検出される", () => {
      // Given: レイヤー名＋機能名の後置パターン
      const phase: Phase = {
        number: 1,
        name: "機能実装",
        taskGroups: [
          { id: "1.1", name: "ドメイン層実装（収入登録）", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "インフラ層実装 - 収入管理", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "アプリケーション層[収入]", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 横切りとして検出される
      expect(result).not.toBeNull();
      expect(result?.matchedTaskGroups.length).toBe(3);
    });
  });

  describe("縦切りパターンは検出しない", () => {
    it("機能単位で分割されたPhaseを渡すと、横切りとして検出されない", () => {
      // Given: 縦切り分割のPhase
      const phase: Phase = {
        number: 1,
        name: "収入管理機能",
        taskGroups: [
          { id: "1.1", name: "DB基盤構築", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "収入登録機能（Domain〜UIフルスタック）", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "収入編集・削除機能（Domain〜UIフルスタック）", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.4", name: "収入一覧・KPI表示機能", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 検出されない
      expect(result).toBeNull();
    });
  });

  describe("偽陽性を回避する", () => {
    it("「API連携機能」を渡すと、横切りとして検出されない", () => {
      // Given: API連携を含むPhase
      const phase: Phase = {
        number: 1,
        name: "外部連携機能",
        taskGroups: [
          { id: "1.1", name: "API連携機能", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "外部API統合", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "データ同期機能", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 検出されない
      expect(result).toBeNull();
    });

    it("「ドメイン知識の活用」を渡すと、横切りとして検出されない", () => {
      // Given: ドメイン知識を含むPhase
      const phase: Phase = {
        number: 1,
        name: "ビジネス分析",
        taskGroups: [
          { id: "1.1", name: "ドメイン知識の整理", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "ドメインモデリング", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "ドメイン理解の共有", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 検出されない
      expect(result).toBeNull();
    });

    it("「GUI実装」を渡すと、UI実装として誤検出しない", () => {
      // Given: GUI実装を含むPhase（UIの前に文字がある）
      const phase: Phase = {
        number: 1,
        name: "機能実装",
        taskGroups: [
          { id: "1.1", name: "GUI実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "Subdomain設計", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "データ処理", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: GUI実装はUI実装としてマッチせず、Subdomainも検出しない
      expect(result).toBeNull();
    });
  });

  describe("閾値チェック", () => {
    it("2つのレイヤーのみの場合を渡すと、横切りとして検出されない", () => {
      // Given: 2つのレイヤーのみを含むPhase
      const phase: Phase = {
        number: 1,
        name: "機能実装",
        taskGroups: [
          { id: "1.1", name: "基盤構築", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "ドメイン層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "UI実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 2つのレイヤー（Domain, UI）のみなので検出されない
      expect(result).toBeNull();
    });

    it("3つ以上のレイヤーを含むPhaseを渡すと、横切りとして検出される", () => {
      // Given: 3つのレイヤーを含むPhase
      const phase: Phase = {
        number: 1,
        name: "機能実装",
        taskGroups: [
          { id: "1.1", name: "基盤構築", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.2", name: "ドメイン層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.3", name: "インフラ層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
          { id: "1.4", name: "アプリケーション層実装", phaseNumber: 1, status: "pending", dependencies: [], completionCriteria: "", tasks: [] },
        ],
      };

      // When: 横切り検出を実行
      const result = detectHorizontalSplit(phase);

      // Then: 3つのレイヤー（Domain, Infrastructure, Application）なので検出される
      expect(result).not.toBeNull();
      expect(result?.isHorizontalSplit).toBe(true);
    });
  });
});
