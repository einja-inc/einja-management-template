/**
 * 横切り分割検出モジュール
 *
 * Phase内のタスクグループ名を分析し、アーキテクチャレイヤー（Domain/Infra/Application/Presentation/UI）で
 * 横断的に分割されている場合に検出する
 */

import type { Phase } from "./types.js";

/** レイヤーマッチ結果 */
export interface LayerMatch {
  taskGroupId: string;
  name: string;
  order: number;
  layerName: string;
}

/** 横切り検出結果 */
export interface HorizontalSplitResult {
  isHorizontalSplit: true;
  phaseNumber: number;
  matchedTaskGroups: LayerMatch[];
  reason: string;
  suggestion: string;
}

/** アーキテクチャレイヤー定義 */
const ARCHITECTURE_LAYERS = [
  { order: 1, name: "Domain", keywords: ["Domain", "ドメイン", "Entity", "エンティティ"] },
  {
    order: 2,
    name: "Infrastructure",
    keywords: [
      "Infra",
      "Infrastructure",
      "インフラ",
      "インフラストラクチャ",
      "Repository実装",
      "Mapper",
    ],
  },
  {
    order: 3,
    name: "Application",
    keywords: ["UseCase", "Application", "アプリケーション", "ユースケース"],
  },
  {
    order: 4,
    name: "Presentation",
    keywords: ["API実装", "Presentation", "プレゼンテーション", "エンドポイント"],
  },
  { order: 5, name: "UI", keywords: ["UI実装", "フロントエンド実装", "画面実装"] },
] as const;

/** 横切り検出の例外パターン（偽陽性回避） */
const EXCEPTION_PATTERNS = [
  /Domain[〜～~]UI/i, // フルスタック示唆
  /フルスタック/i,
  /API連携/i, // 外部連携
  /外部API/i,
  /ドメイン(知識|理解|モデリング)/i, // 技術レイヤーではない
  /(作成|登録)[・、](編集|更新)/, // 複合操作
  /CRUD/i,
];

/** タスクグループ名がどのレイヤーに該当するか判定 */
function matchLayer(taskGroupName: string): { order: number; layerName: string } | null {
  // 例外パターンに該当する場合はスキップ
  if (EXCEPTION_PATTERNS.some((pattern) => pattern.test(taskGroupName))) {
    return null;
  }

  for (const layer of ARCHITECTURE_LAYERS) {
    for (const keyword of layer.keywords) {
      // 単語境界を考慮（前に日本語・英数字がない場合のみマッチ）
      const patterns = [
        new RegExp(
          `(?:^|[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff])${keyword}(層|レイヤー)?の?(実装|構築|設計)?(\\s|$|\\(|\\[|\\-|\\/|・|、)`,
          "i"
        ),
        new RegExp(`^${keyword}(層|レイヤー)`, "i"),
      ];
      if (patterns.some((p) => p.test(taskGroupName))) {
        return { order: layer.order, layerName: layer.name };
      }
    }
  }
  return null;
}

/** Phase内の横切り分割を検出 */
export function detectHorizontalSplit(phase: Phase): HorizontalSplitResult | null {
  const layerMatches: LayerMatch[] = [];

  for (const taskGroup of phase.taskGroups) {
    const match = matchLayer(taskGroup.name);
    if (match) {
      layerMatches.push({
        taskGroupId: taskGroup.id,
        name: taskGroup.name,
        order: match.order,
        layerName: match.layerName,
      });
    }
  }

  // 3つ以上の異なるレイヤーがマッチした場合のみ横切りと判定
  const uniqueLayers = new Set(layerMatches.map((m) => m.order));
  if (uniqueLayers.size < 3) {
    return null;
  }

  return {
    isHorizontalSplit: true,
    phaseNumber: phase.number,
    matchedTaskGroups: layerMatches,
    reason: `Phase ${phase.number} に ${uniqueLayers.size} 個のレイヤー名が含まれています`,
    suggestion: "縦切り（機能単位）で再分割してください。例：「収入登録機能（Domain〜UI）」",
  };
}
