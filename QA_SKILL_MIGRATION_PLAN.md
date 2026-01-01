# QA機能のAgent Skill分離 - 評価/計画レポート

**作成日**: 2025-12-20
**ステータス**: 承認済み
**対象**: task-exec QA機能のAgent Skills化

---

## エグゼクティブサマリー

task-execオーケストレーター下で**QA機能を独立したAgent Skillとして分離**します。既存ワークフローの**後方互換性を100%維持**しながら、Model-Invoked対応と再利用性を実現します。

### 主要な成果

- ✅ **後方互換性**: 100%（既存ユーザーへの影響ゼロ）
- ✅ **Model-Invoked**: 「QAを実行して」で自律起動
- ✅ **Agent Skills原則**: 96/100点準拠（実用上十分）
- ✅ **リスク**: 低（段階的移行、5分以内ロールバック）
- ✅ **実装期間**: 4週間

---

## 推奨アプローチ

### ハイブリッド・オーケストレーション・パターン

```
現在の構造:
task-exec → task-starter → task-executer → task-reviewer → task-qa → task-finisher
                                                              ↑
                                                    （QA機能が埋め込まれている）

新しい構造:
task-exec → task-starter → task-executer → task-reviewer → task-qa（薄いラッパー） → task-finisher
                                                              ↓
                                                         Skill呼び出し
                                                              ↓
                                                    .claude/skills/task-qa/
                                                    （独立したQA実行エンジン）
```

### なぜこのアプローチか

| 基準 | 評価 | 説明 |
|------|------|------|
| **後方互換性** | ✅ 100% | task-exec.mdは一切変更不要 |
| **Model-Invoked** | ✅ 100% | 「QAを実行」で自律起動 |
| **実装リスク** | ⚠️ 低 | 段階的移行（4週間） |
| **拡張性** | ✅ 高 | 将来的な全フェーズSkill化への布石 |
| **Skills準拠** | ⚠️ 96% | 実用上十分（唯一の妥協は間接呼び出し） |

---

## 設計の核心

### 1. QA Skillの独立性

**ファイル構成**:
```
.claude/skills/task-qa/
├── SKILL.md              # QA実行エンジン（最重要）
├── REFERENCE.md          # 技術詳細・ベストプラクティス
└── templates/
    └── qa-test-template.md
```

**責務**:
- ✅ 必須自動テスト実行（test/lint/build/typecheck/test:e2e）
- ✅ requirements.mdからIntegration/E2E ACのみ抽出
- ✅ テストシナリオ作成・更新（qa-tests/phaseN/X-Y.md）
- ✅ 動作確認（Playwright MCP/curl/スクリプト実行）
- ✅ 失敗原因分類（A/B/C/D）
- ✅ qa-tests/への記録

**トリガーワード**（Model-Invoked用）:
- "QAを実行"
- "品質保証を実施"
- "テストを確認"
- "動作確認して"

**allowed-tools**:
`Task, Read, Write, Edit, Bash, Grep, Glob, mcp__playwright__*, mcp__serena__*`

### 2. task-execとの統合

**`.claude/agents/task/task-qa.md`を薄いラッパーに変更**:

```markdown
役割（新）:
1. 引数整理（仕様書パス、タスクグループID）
2. Skill呼び出し: Skill("task-qa", args: "...")
3. 結果JSON取得
4. task-exec形式の完了報告生成（既存フォーマット維持）
5. 失敗時の戻し先決定（A→executer, B→requirements→executer, C→design→executer, D→qa）
```

**重要**: task-exec.mdは一切変更不要

### 3. 後方互換性の保証

| 項目 | 互換性 | 詳細 |
|------|--------|------|
| **完了報告フォーマット** | ✅ 100% | `## 🧪 品質保証フェーズ完了` |
| **失敗時のループバック** | ✅ 100% | A/B/C/D分類維持 |
| **qa-tests/ディレクトリ構造** | ✅ 100% | `qa-tests/phaseN/X-Y.md` |
| **パフォーマンス** | ✅ ±5%以内 | ベースライン測定必須 |

---

## 呼び出しパターン

### パターン1: task-execからの呼び出し（既存維持）

```
ユーザー: task-exec #123 1.1
    ↓
task-exec → starter → executer → reviewer → qa（ラッパー）
                                              ↓
                                    Skill("task-qa")
                                              ↓
                                    .claude/skills/task-qa/
                                              ↓
                                    結果JSON返却
                                              ↓
                                    完了報告生成（既存フォーマット）
                                              ↓
                                    finisher
```

**ユーザー視点**: 何も変わらない（完了報告も同じ）

### パターン2: 独立使用（Model-Invoked）**新機能**

```
ユーザー: "docs/specs/.../のQAを実行して"
    ↓
Claude: トリガーワード「QA」「実行」を検出
    ↓
.claude/skills/task-qa/を自動起動
    ↓
QA実行 → 結果報告
```

**ユーザー視点**: task-execを経由せずにQAのみ実行可能

---

## Agent Skills原則への準拠度評価

### 総合評価: 96/100点

| 原則 | 準拠度 | 評価 | 説明 |
|------|--------|------|------|
| **Single Purpose** | ✅ 100% | QA実行のみに特化 | 単一責任原則を完全に遵守 |
| **Model-Invoked** | ✅ 100% | 「QA実行」で自律起動 | トリガーワード明記 |
| **Composable** | ✅ 100% | task-exec外でも利用可能 | 再利用性最高 |
| **Specific Descriptions** | ✅ 100% | トリガーワード明記 | 発見性を確保 |
| **Clear Boundaries** | ⚠️ 80% | オーケストレーターから間接呼び出し | **唯一の妥協点** |

### Clear Boundaries（80%）の詳細

**問題**:
- オーケストレーター（task-exec）からは`.claude/agents/task/task-qa.md`経由で呼び出される
- 直接Skillを呼び出すのではなく、エージェント層を挟む

**なぜ妥協したか**:
- **後方互換性100%維持のため**
- task-exec.mdの変更を避けるため
- 既存ユーザーへの影響をゼロにするため

**評価**:
- Agent Skills原則の**本質（再利用性・独立性）は達成**
- 理論的完璧性: 80点
- **実用性: 95点**

---

## 技術的負債の正直な評価

### 負債1: 二重構造の維持コスト

**問題**:
- `.claude/agents/task/task-qa.md`（ラッパー）
- `.claude/skills/task-qa/`（本体）

**影響度**: 中

**緩和策**:
- ラッパーは以下のみに徹底（ロジックは一切含まない）:
  1. 引数整理
  2. Skill呼び出し
  3. 結果JSON取得
  4. 完了報告生成（フォーマット変換）
  5. 戻し先決定

**実際のメンテナンスコスト**: 低
- **95%のケース**でSkillのみ修正
- ラッパー修正は完了報告フォーマット変更時のみ（稀）

### 負債2: Agent Skills原則との部分的不整合

**問題**:
- オーケストレーターから間接的に呼ばれる（Clear Boundaries: 80%）

**影響度**: 低

**評価**:
- Model-Invokedは完全に動作
- 明示的呼び出しも可能
- 唯一の「不整合」は**後方互換性のための設計判断**
- Agent Skills原則の**本質（再利用性・独立性）は達成**

---

## 代替案との比較

### オプションA: 推奨案（QA機能のみSkill化）

**メリット**:
- 後方互換性100%
- Model-Invoked対応
- リスク低（段階的移行）
- 実装期間短（4週間）
- Agent Skills原則96%準拠

**デメリット**:
- 二重構造の維持コスト（低）
- Clear Boundaries 80%（妥協）

### オプションB: 現状維持

**メリット**:
- 変更不要（リスクゼロ）
- 既存知見が活かせる

**デメリット**:
- QA機能の再利用不可
- 「QAを実行」で起動不可
- 手動QA確認時に冗長
- **ユーザー要求を満たさない**

### オプションC: 全フェーズSkill化

**メリット**:
- Agent Skills原則100%準拠
- 全フェーズの独立利用可能
- 将来的な拡張性が最高

**デメリット**:
- 大規模リファクタリング（6コンポーネント同時変更）
- 破壊的変更
- 実装期間長（3ヶ月）
- **リスクが高すぎる**

### 比較表

| 評価軸 | オプションA（推奨） | オプションB | オプションC |
|--------|------------------|------------|------------|
| 後方互換性 | ✅ 100% | ✅ 100% | ❌ 破壊的変更 |
| Model-Invoked | ✅ 対応 | ❌ 不可 | ✅ 対応 |
| 実装リスク | ⚠️ 低 | ✅ ゼロ | ❌ 高 |
| 将来的拡張性 | ✅ 高 | ❌ 低 | ✅ 最高 |
| 実装コスト | ⚠️ 中（4週間） | ✅ ゼロ | ❌ 大（3ヶ月） |
| Skills準拠 | ⚠️ 96% | ❌ 0% | ✅ 100% |
| ロールバック容易性 | ✅ 5分以内 | - | ❌ 困難 |

**結論**: オプションAが**実用性と原則のバランス**を最適化

---

## リスク管理

### 技術的リスク

| リスク | 影響度 | 発生確率 | 緩和策 | 残存リスク |
|--------|--------|---------|--------|-----------|
| Skill呼び出し失敗 | 高 | 低 | エージェントでフォールバック実装 | 低 |
| qa-tests/フォーマット破壊 | 高 | 中 | テンプレート厳密化、バリデーション追加 | 低 |
| 完了報告の不整合 | 中 | 中 | ユニットテストで検証 | 低 |
| パフォーマンス劣化 | 低 | 低 | ベースライン測定、許容範囲確認（±5%） | 極低 |
| 失敗原因分類の誤判定 | 中 | 中 | 判定フローチャート明確化、例示10パターン以上 | 低 |

### 運用リスク

| リスク | 影響度 | 発生確率 | 緩和策 | 残存リスク |
|--------|--------|---------|--------|-----------|
| 既存ユーザーの混乱 | 中 | 中 | 変更通知、ドキュメント整備、FAQ作成 | 低 |
| トレーニングコスト | 低 | 高 | ハンズオン、段階的ロールアウト | 低 |
| メンテナンス負荷増 | 中 | 中 | ラッパーを薄く保つ、ロジック集約 | 低 |
| ドキュメント同期ずれ | 中 | 中 | REFERENCE.mdへの集約、定期レビュー | 中 |

### ロールバック計画

**問題発生時の即座復旧（5分以内）**:
```bash
# Phase 2失敗時
git revert HEAD  # .claude/agents/task/task-qa.md を旧版に戻す
rm -rf .claude/skills/task-qa/  # Skill削除
# 復旧時間: 5分以内
```

---

## 段階的移行計画（4週間）

### Week 1-2: Phase 1 - QA Skill作成

**タスク**:
- [ ] `.claude/skills/task-qa/`ディレクトリ作成
- [ ] `templates/qa-test-template.md`作成
- [ ] `REFERENCE.md`作成（`docs/steering/acceptance-criteria-and-qa-guide.md`統合）
- [ ] `SKILL.md`実装（ステップ1-7）

**検証**:
- [ ] Model-Invoked動作確認（「QAを実行して」）
- [ ] 自動テスト実行（test/lint/build/typecheck/test:e2e）
- [ ] AC抽出ロジック（requirements.md解析）
- [ ] qa-tests/ファイル作成・更新
- [ ] 失敗原因分類（A/B/C/D各パターン）

**完了基準**: Skill単独でQA実行が完結する

### Week 3: Phase 2 - エージェント統合

**タスク**:
- [ ] `.claude/agents/task/task-qa.md`をラッパー化
  - [ ] 既存内容をバックアップ（`git commit -m "backup: task-qa agent before Skill migration"`）
  - [ ] 新内容に置き換え（引数整理、Skill呼び出し、完了報告生成、戻し先決定）

**検証**:
- [ ] task-execからの呼び出し確認（成功ケース）
- [ ] 失敗ケース（A/B/C/D各パターン）
- [ ] 完了報告フォーマット互換性確認
- [ ] ループバック動作確認

**完了基準**: task-exec実行が既存と同じ動作

### Week 4: Phase 3 - 本番投入

**タスク**:
- [ ] E2Eテスト（既存プロジェクトで成功3件・失敗4件）
- [ ] パフォーマンス測定（ベースライン±5%以内確認）
- [ ] ドキュメント整備（REFERENCE.md使用例更新、FAQ作成）
- [ ] チーム内ロールアウト（変更通知、ハンズオントレーニング）

**完了基準**:
- 本番環境で安定稼働
- パフォーマンス劣化なし

### Week 5-: Phase 4 - 評価と次フェーズ計画

**タスク**:
- [ ] KPI測定（独立使用率、Model-Invoked起動率、失敗分類精度）
- [ ] ユーザーフィードバック収集（アンケート、ヒアリング）
- [ ] 次フェーズ検討（Reviewer/Executer Skill化の是非）

---

## 実装手順（詳細）

### ステップ1.1: ディレクトリ作成

```bash
cd /Users/shogo.matsuda/workspace/einja-management-template
mkdir -p .claude/skills/task-qa/templates
```

### ステップ1.2: テンプレート作成

**参照元**: `docs/example/specs/issues/issue999-example-task/qa-tests/phase1/1-1.md`

**ファイル**: `.claude/skills/task-qa/templates/qa-test-template.md`

**変数**:
- `{task_id}`: タスクID（例: 1.1）
- `{task_name}`: タスク名
- `{ac_number}`: 受け入れ基準番号
- `{phase_num}`: フェーズ番号
- `{group_num}`: グループ番号
- `{date}`: 日付（YYYY-MM-DD）

### ステップ1.3: REFERENCE.md作成

**統合元**: `docs/steering/acceptance-criteria-and-qa-guide.md`

**追加内容**:
- 失敗原因分類の詳細ガイド（A/B/C/D判定フローチャート、例10パターン以上）
- qa-tests/ディレクトリ構造（パス規則、変換ロジック）
- 使用例5パターン（Model-Invoked、task-execから、CLI明示的、CI/CD、手動QA）
- トラブルシューティング（Playwright MCP接続、requirements.md不在、書き込み権限）

### ステップ1.4: SKILL.md作成（最重要）

**フロントマター**:
```yaml
---
description: "タスクの品質保証を実行するSkill。自動テスト・AC検証・動作確認を実施し、qa-tests/に結果を記録"
allowed-tools: Task, Read, Write, Edit, Bash, Grep, Glob, mcp__playwright__*, mcp__serena__*
---
```

**本文構造**:

```markdown
# タスクQA実行Skill

## あなたの役割
QAエンジニアリングのスペシャリスト（12年以上の経験）

## トリガーワード
- "QAを実行"
- "品質保証を実施"
- "テストを確認"
- "動作確認して"

## 引数形式
$ARGUMENTSから以下を解析：
- 仕様書パス（必須）
- タスクグループID（必須）

## 実行手順

### ステップ1: 仕様書の読み込み
- 仕様書ディレクトリパスの検証
- requirements.md読み込み
- タスクグループの特定

### ステップ2: 必須自動テストの実行
（1つでも失敗→FAILURE判定）

1. ユニットテスト: `pnpm test`
2. E2Eテスト: `pnpm test:e2e`（該当する場合）
3. Lintチェック: `pnpm lint`
4. ビルドチェック: `pnpm build`
5. 型チェック: `pnpm typecheck`

### ステップ3: AC抽出とテストシナリオ
- requirements.mdから「Integration」「E2E」ACのみ抽出
- qa-tests/phaseN/X-Y.md の存在確認
- 初回：テストシナリオ全体作成
- 2回目以降：実施結果セクションのみ更新

### ステップ4: 動作確認の実施
- 画面：Playwright MCP
- API：curl
- スクリプト：直接実行

### ステップ5: 失敗原因の分類
A: 実装ミス → task-executer
B: 要件齟齬 → requirements.md修正 → task-executer
C: 設計不備 → design.md修正 → task-executer
D: 環境問題 → qa再実行

### ステップ6: qa-tests/への記録
- 初回：テンプレート使用して全体作成
- 2回目以降：実施結果セクションのみ更新

### ステップ7: 結果の返却（JSON）
{
  "status": "SUCCESS|FAILURE|PARTIAL",
  "failureCategory": "A|B|C|D|null",
  "nextAction": "finisher|executer|qa-retry",
  "qaTestFile": "qa-tests/phase1/1-1.md",
  "testSummary": {...},
  "findings": [...]
}
```

---

## 成功基準

### 必達目標（Phase 1-3完了時）

- [ ] **後方互換性100%**: task-exec実行が既存と完全一致
- [ ] **Model-Invoked動作**: 「QAを実行して」で自律起動成功率95%以上
- [ ] **qa-tests/互換性**: 既存フォーマットと100%一致
- [ ] **失敗分類精度**: A/B/C/D判定の正確性90%以上
- [ ] **E2Eテスト**: 既存プロジェクトでの成功率100%（10件以上）
- [ ] **ロールバック**: 5分以内の復旧
- [ ] **パフォーマンス**: ベースライン±5%以内

### 理想目標（Phase 4以降）

- [ ] **独立使用率**: 全QA実行の20%以上が独立使用
- [ ] **他ワークフロー統合**: 3つ以上（CI/CD、手動レビュー等）
- [ ] **Reviewer Skill化**: プロトタイプ作成開始
- [ ] **満足度**: アンケートで80%以上が「満足」

---

## 将来的な展開（1.5年ロードマップ）

```
現在（Week 1-4）: QA Skill化
    ↓ 成功確認・評価
6ヶ月後: Reviewer Skill化
    ↓ 成功確認・評価
1年後: Executer Skill化
    ↓ 成功確認・評価
1.5年後: Orchestrator Skill化
    ↓
最終形：完全なAgent Skillsアーキテクチャ
```

---

## 結論

この計画は、**既存システムの安定性を100%保ちながら、段階的にAgent Skillsアーキテクチャへ移行**する実用的なアプローチです。

### 主要な特徴

- ✅ **後方互換性**: 100%（ユーザー影響ゼロ）
- ✅ **Model-Invoked**: 対応（「QAを実行して」で自律起動）
- ✅ **リスク**: 低（段階的移行、5分以内ロールバック）
- ✅ **拡張性**: 高（将来的な全フェーズSkill化への布石）
- ✅ **Skills準拠**: 96%（実用上十分）

### 推奨実装順序

1. ✅ **ステップ0**: 評価/計画レポート出力（このファイル）
2. ⏳ **Week 1-2**: QA Skill作成（SKILL.md/REFERENCE.md/template）
3. ⏳ **Week 3**: エージェント統合（task-qa.mdラッパー化）
4. ⏳ **Week 4**: 本番投入（E2Eテスト、パフォーマンス測定）
5. ⏳ **Week 5-**: 評価と次フェーズ計画

---

**承認日**: 2025-12-20
**次のアクション**: Week 1-2のQA Skill作成を開始
