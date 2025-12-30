# ワークフロー現状分析と改善提案

## 調査日: 2025-12-30

## 1. 現状の想定ワークフロー

```
spec-createコマンド
    │
    ├─ Phase 1: requirements.md作成
    ├─ Phase 2: design.md作成
    └─ Phase 3: GitHub Issueにタスク一覧記述

        ↓

task-vibe-kanban-loopコマンド
    │
    ├─ task-starter: 着手可能タスク選定
    ├─ Vibe-Kanbanタスク作成
    ├─ start_task_attempt: エージェント起動
    │   └─ task-executer → task-reviewer → task-qa → task-finisher
    ├─ 2分待機ループ（最大30回）
    └─ 次タスク選定へ戻る

        ↓

人間がVibe-KanbanでInReviewを確認
    │
    └─ PRマージ

        ↓

task-vibe-kanban-loopが次のタスクを自動開始
```

---

## 2. 批判的評価：現状の問題点

### 2.1 重大な問題（Critical）

#### ❌ InReviewステータスの定義・遷移条件が未定義

**現状**:
- `docs/steering/task-management.md` にInReviewステータスへの遷移条件が**明示されていない**
- GitHub Issueのステータスは「未着手」「着手中」「完了」の3状態のみ
- Vibe-Kanbanのステータスとの対応関係が不明確

**影響**:
- 人間が「いつ」「何を」確認すべきかが曖昧
- 自動化とヒューマンレビューの境界が不明確
- PRマージのトリガーが定義されていない

#### ❌ GitHub IssueとVibe-Kanbanの二重管理による状態不整合リスク

**現状**:
```
GitHub Issue: チェックボックス + HTMLコメント（着手中マーク）
Vibe-Kanban: todo / in-progress / done（推測）
```

**問題**:
- 両システムの状態が独立して管理されている
- 同期メカニズムが明確に定義されていない
- エージェント失敗時にどちらを正とするか不明確

#### ❌ エージェント実行完了の検知メカニズムが不十分

**現状**:
```
2分待機 × 最大30回 = 最大60分待機
git fetch origin で最新状態取得
```

**問題**:
- Vibe-Kanbanのタスク完了を直接監視していない
- `git fetch` のみでは実行状態を正確に把握できない
- タイムアウト後の処理が「終了」のみ（復旧策なし）

### 2.2 中程度の問題（Medium）

#### ⚠️ 待機メカニズムの非効率性

**現状**:
- 固定2分間隔（120秒）
- 最大30回の繰り返し

**問題**:
- 短いタスクでも最低2分待機
- 長いタスクでは60分で強制終了
- タスクの複雑さに応じた待機時間調整がない

#### ⚠️ 人間の介入ポイントが実装レベルで不明確

**現状**:
- タスク管理ドキュメントには「PR作成・レビュー」「QA実施」が人間の介入ポイントとして記載
- 実際のコマンド実装では自動で次タスクに進む

**問題**:
- 人間がいつ介入すべきかのシグナルがない
- 自動進行を一時停止するメカニズムがない
- InReview状態でのブロッキング機構がない

#### ⚠️ task-finisherとPRマージの関係が不明確

**現状**:
- task-finisher: GitHub Issueのチェックボックスを完了に変更
- PRマージ: 人間が実施（想定）

**問題**:
- task-finisherがPR作成まで担当するか不明確
- PRが作成されていない状態でタスクが「完了」になる可能性
- マージ前に次タスクが開始されるリスク

### 2.3 軽度の問題（Low）

#### 💡 ドキュメント間の用語・概念の不一致

- `task-exec` vs `task-vibe-kanban-loop` の使い分けが複雑
- 「タスクグループ」「タスク」「サブタスク」の定義が分散
- 各エージェントの責務境界が一部重複

#### 💡 エラーリカバリーの仕組みが限定的

- エージェント失敗時の自動リトライ回数が不明確
- 部分的な完了状態からの再開メカニズムが不明確

---

## 3. ワークフロー設計の根本的な課題

### 3.1 「自動」と「人間の承認」の境界が曖昧

```
現状の設計思想（推測）:
┌─────────────────────────────────────────────────────────┐
│ spec-create: 人間が各フェーズを承認（対話的）          │
│ task-vibe-kanban-loop: 完全自動（ループ）              │
│ 人間の介入: Vibe-Kanban UIで InReview 確認後マージ     │
└─────────────────────────────────────────────────────────┘

問題:
- InReviewへの遷移が自動なのか手動なのか不明
- マージが完了したことをシステムがどう検知するか不明
- マージ後に自動で次タスクが開始される保証がない
```

### 3.2 状態管理の一貫性がない

```
理想的な状態遷移:
Todo → In Progress → In Review → Done

現状の実装:
GitHub Issue: [ ] → [ ] + 着手中マーク → [x]
Vibe-Kanban: (create) → in-progress → (?)

欠落:
- In Review 状態の明示的な管理
- 両システム間の状態同期
```

### 3.3 フィードバックループの欠如

```
現状:
task-finisher完了 → 次タスク選定 → 実行開始

問題:
- PRレビューのフィードバックを受け取るメカニズムがない
- マージ失敗時の対処が不明確
- 品質問題の蓄積リスク
```

---

## 4. 改善提案

### 4.1 提案A: InReviewステータスの明示的な導入

**変更内容**:

1. GitHub Issue の状態を4状態に拡張:
```markdown
| 状態 | 表記 | 説明 |
|------|------|------|
| 未着手 | `- [ ]` | 未開始 |
| 着手中 | `- [ ] <!-- 🔄 着手中 -->` | 実装中 |
| レビュー中 | `- [ ] <!-- 👀 レビュー中 -->` | PR作成済み、マージ待ち |
| 完了 | `- [x]` | マージ完了 |
```

2. task-finisherの責務を分離:
   - 現在: チェックボックスを完了に変更
   - 変更後: レビュー中マークを付与、PR作成まで担当

3. 新エージェント `task-merger` の追加:
   - PRマージを検知
   - マージ完了後にチェックボックスを完了に変更
   - 次タスクの選定をトリガー

**メリット**:
- 人間の介入ポイントが明確化
- 状態遷移が追跡可能

**デメリット**:
- 実装の複雑化
- 新エージェント追加のコスト

### 4.2 提案B: Vibe-Kanbanを状態管理の単一ソースに

**変更内容**:

1. Vibe-Kanbanのステータスを正とする:
```
todo → in-progress → in-review → done
```

2. GitHub Issueは参照用のみ:
   - タスク一覧の表示
   - ドキュメントへのリンク
   - チェックボックスはVibe-Kanbanと自動同期

3. task-vibe-kanban-loopの改善:
   - `mcp__vibe_kanban__get_task` でステータス確認
   - in-review状態のタスクがある場合は待機
   - done状態になったら次タスク選定

**メリット**:
- 状態管理の一元化
- Vibe-Kanban UIでの管理が直感的

**デメリット**:
- GitHub Issueとの同期コストが増加
- Vibe-Kanban依存度が高まる

### 4.3 提案C: イベント駆動型への移行

**変更内容**:

1. Webhook/イベントベースの状態変更:
```
PR作成イベント → InReviewステータスに自動変更
PRマージイベント → タスク完了 + 次タスク開始
```

2. 待機ループの廃止:
   - 2分×30回のポーリングを廃止
   - GitHub ActionsまたはWebhookでイベント駆動

3. 状態変更のトリガー:
```yaml
# .github/workflows/task-automation.yml
on:
  pull_request:
    types: [opened, closed]

jobs:
  update-task-status:
    # PR作成時: InReviewに変更
    # PRマージ時: 完了に変更 + 次タスク開始
```

**メリット**:
- リアルタイムな状態変更
- リソース効率が良い
- 拡張性が高い

**デメリット**:
- 実装の複雑さ
- GitHub Actionsの制約
- 外部依存の増加

### 4.4 提案D: 最小限の改善（推奨）

**短期的に実装可能な改善**:

1. **InReviewステータスの定義追加**（ドキュメントのみ）:
   - `docs/steering/task-management.md` に遷移条件を明記
   - 人間の介入ポイントを明確化

2. **task-finisherの改善**:
   - PR作成を必須化
   - レビュー中マーク (`<!-- 👀 レビュー中 -->`) の導入

3. **待機ロジックの改善**:
   - `mcp__vibe_kanban__get_task` でステータス確認を追加
   - in-review状態のタスクがある場合は警告メッセージ
   - ユーザーに明示的な確認を求めるオプション追加

4. **ドキュメントの整備**:
   - ワークフロー全体のシーケンス図を追加
   - 各ステータス間の遷移条件を明記

---

## 5. 推奨アクションプラン

### Phase 1: ドキュメント整備 ✅ 完了

- [x] `docs/steering/task-management.md` にInReviewステータスを追加
- [x] 状態遷移図を追加
- [x] 人間の介入ポイントを明確化
- [x] `docs/instructions/task-vibe-kanban-loop.md` シーケンス図拡充

**実装日**: 2025-12-30
**コミット**: `dbcb3ec docs: InReviewステータスの定義追加`

### Phase 2: task-finisherの改善 ⏳ 未実装

- [ ] PR作成を必須化
- [ ] レビュー中マークの導入
- [ ] GitHub Issue更新ロジックの修正

### Phase 3: 待機ロジックの改善 ⏳ 未実装

- [ ] Vibe-Kanbanステータス確認の追加
- [ ] in-review状態での警告メッセージ
- [ ] 明示的な確認オプション

### Phase 4: 長期的な改善（検討）

- [ ] イベント駆動型への移行検討
- [ ] GitHub Actionsとの連携
- [ ] 完全自動化 vs 人間の承認のバランス再検討

---

## 7. 実装進行状況

| Phase | 内容 | 状態 | PR |
|-------|------|------|-----|
| **Phase 1** | ドキュメント整備 | ✅ 完了 | [#19](https://github.com/einja-inc/einja-management-template/pull/19) |
| **Phase 2** | task-finisher改善 | ⏳ 未実装 | - |
| **Phase 3** | 待機ロジック改善 | ⏳ 未実装 | - |
| **Phase 4** | 長期的な改善 | 📋 検討中 | - |

**関連Issue**: [#18](https://github.com/einja-inc/einja-management-template/issues/18)
**作業ブランチ**: `issue/18` (from `feature/template-foundation`)

---

## 6. 結論

現状のワークフローは**概念設計は優れているが、実装レベルでの詳細が不足している**。

特に以下の点が未成熟:
1. InReviewステータスの欠如
2. GitHub IssueとVibe-Kanbanの状態同期
3. 人間の介入ポイントの明確化

**推奨**: 提案D（最小限の改善）から着手し、段階的に改善を進める。完全自動化を目指すよりも、まず「人間が介入すべきポイントを明確にする」ことを優先すべき。

---

## 関連ファイル

- `.claude/commands/spec-create.md`
- `.claude/commands/task-vibe-kanban-loop.md`
- `.claude/commands/task-exec.md`
- `.claude/agents/task/task-starter.md`
- `.claude/agents/task/task-executer.md`
- `.claude/agents/task/task-reviewer.md`
- `.claude/agents/task/task-qa.md`
- `.claude/agents/task/task-finisher.md`
- `docs/steering/task-management.md`
- `docs/instructions/task-vibe-kanban-loop.md`
