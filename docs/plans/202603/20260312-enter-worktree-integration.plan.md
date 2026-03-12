# issue-spec-create Phase 2/3 並列化

## Context
`einja-issue-spec-create` の Phase 2（ui-design.pen）と Phase 3（design.md）は両方とも requirements.md のみに依存しており、並列生成可能。現状は直列実行でユーザー待ち時間が長い。design.md は ui-design.pen を「存在すれば参照」するオプショナル依存なので、並列化しても品質への影響は軽微。

## 現状
- Phase 1（requirements.md）→ 承認 → Phase 2（ui-design.pen）→ 承認 → Phase 3（design.md）→ 承認 → Phase 4（QA）→ Phase 5（Tasks）
- Phase 2 → 3 が直列。design.md は ui-design.pen の UI セクション（9-11）を参照するが必須ではない

## 変更内容

### 変更後フロー
```
Phase 1 (requirements.md) → 承認
  ↓
Phase 2+3 並列生成（UI要件ありの場合）
  ├─ ui-design-generator → ui-design.pen
  └─ design-generator → design.md（UI参照なしで生成）
  ↓
ui-design.pen 承認 → コミット
design.md 承認 → コミット
  ↓
Phase 4 (QA) → Phase 5 (Tasks)
```

**UI要件なしの場合**: Phase 2 スキップ、Phase 3 のみ実行（現行と同じ）

### 変更ポイント
1. Phase 2 スキップ判定を Phase 2+3 開始前に移動
2. UI要件ありの場合、`ui-design-generator` と `design-generator` を並列 Task 呼び出し
3. design-generator へのプロンプトに「ui-design.pen は並列生成中のため参照不可。UIセクションは ui-design.pen のファイルパスを参照先として記載」を追加
4. 両方完了後、順番にユーザー承認・コミット
5. 承認フローの変更: 2つまとめて提示し、個別に承認

### 対象ファイル
- `.claude/skills/einja-issue-spec-create/SKILL.md`（L127-165）

## タスク概要

| # | タスク | Skill/エージェント |
|---|--------|-------------------|
| 0 | Planファイルを `docs/plans/202603/20260312-issue-spec-create-parallel.plan.md` にリネーム | [Bash] |
| 1 | SKILL.md の Phase 2+3 セクションを並列実行に書き換え | [general-purpose] |

## 並列実行計画
- タスク1は単一ファイルの編集のみ。並列化不要。

## リスク・不明点
- design.md の UI セクション（9-11）が ui-design.pen を参照できないため、若干情報不足になる可能性
  - 対策: design.md 承認時にユーザーが UI デザインを踏まえて修正指示可能
- 承認フローの UX: 2つ同時に提示すると確認負荷が上がる
  - 対策: ui-design.pen → design.md の順で個別承認（生成は並列、承認は直列）

## 検証・動作確認方法
- SKILL.md の diff 確認: Phase 2+3 が並列呼び出しになっていること
- フロー整合性: UI要件なし時は従来通り Phase 3 のみ実行されること
- 承認ゲート: 両方の承認後に Phase 4 へ進む記述があること
