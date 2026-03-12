# issue-spec-create: タスクのSkill/サブエージェント明記 & 仕様書への実装参考情報追加

## Context

`einja-issue-spec-create` Skillに以下の課題がある:

1. **タスク一覧にSkill/サブエージェント指定がない**: task-exec実行時にどのSkill・サブエージェントを使うべきかが不明
2. **サブエージェント呼び出し時のSkill読み込み指示がない**: 各サブエージェントは自律的にsteering参照を持つが、issue-spec-createからの明示的指示がない
3. **仕様書にSkill/参考リソース情報がない**: requirements.mdやdesign.mdに、実装時に使うべきSkillや参考になる過去のPlan/Issueの情報が含まれていない

**記法の由来**: CLAUDE.mdの「TaskCreate タスク概要の記述ルール」で定義されている `[Skill名]` 形式（例: `「過去Plan検索 [Grep/Glob]」`）を踏襲し、タスク一覧でも同じ `[]` 記法で統一する。

## 現状

### タスクフォーマット（メタデータ5項目 + 実装AC）

task-management.md（SSoT）では5項目が必須:
- 要件、依存関係、完了条件、対応設計、シナリオテスト

tasks-generator（agent）は6項目（`実装AC` を追加）で生成。tasks-validator は5項目のみ検証。

### サブエージェントのSkill読み込み状況

| サブエージェント | skills:セクション | 自律的steering参照 |
|---|---|---|
| requirements-generator | `_einja-subagent-question-protocol` | acceptance-criteria-and-qa-guide, testing-strategy |
| design-generator | `_einja-subagent-question-protocol` | backend-architecture, frontend-development, api-development, testing-strategy, acceptance-criteria-and-qa-guide |
| ui-design-generator | `_einja-subagent-question-protocol` | pencil-design-management |
| qa-generator | `_einja-subagent-question-protocol` | acceptance-criteria-and-qa-guide, testing-strategy, backend-architecture, frontend-development, api-development |
| tasks-generator | `_einja-subagent-question-protocol` | `_einja-issue-spec-tasks-generator` Skill |
| tasks-validator | なし | `_einja-issue-spec-tasks-validator` Skill |

### 仕様書の現状

requirements.md / design.md に「実装時に使うべきSkill」「参考リソース」のセクションは存在しない。

## 変更内容

### A. タスク一覧フォーマット: 2項目追加（`実行サブエージェント` / `使用Skill`）

タスクグループレベル・タスクレベルの両方で指定可能。タスクグループで指定 → 配下タスクに継承。タスクで指定 → オーバーライド。

```markdown
- [ ] 1.1 ユーザー作成機能
  **実行サブエージェント**: [frontend-coder]
  **使用Skill**: [einja-pencil-design-manager], [steering:api-development]

  - 1.1.1 ユーザー作成フォームの実装（TDD）
    - サブタスク内容
    - **要件**: Story 1
    - **実装AC**: AC1.1, AC1.2
    - **依存関係**: なし
    - **完了条件**: ...（AC1.1〜AC1.2を満たす）
    - **対応設計**: design.md「ユーザー作成」セクション
    - **シナリオテスト**: シナリオ1 Step 1-3

  - 1.1.2 ユーザー作成APIの実装（TDD）
    - **実行サブエージェント**: [backend-architect]  ← タスクレベルでオーバーライド
    - **使用Skill**: [steering:backend-architecture]  ← タスクレベルでオーバーライド
    - **要件**: Story 1
    - ...
```

**指定ルール**:

| 項目 | 記載形式 | 例 |
|------|---------|-----|
| `**実行サブエージェント**` | `[エージェント名]` | `[frontend-coder]`, `[design-engineer]`, `[backend-architect]` |
| `**使用Skill**` | `[Skill名]` or `[steering:ファイル名]` | `[einja-pencil-design-manager]`, `[steering:api-development]` |

- **両方とも任意項目**（省略時 = task-executerがデフォルトで処理）
- タスクグループレベル: タスクグループ名行の直下（2スペースインデント）、最初のタスクより前
- タスクレベル: タスクのメタデータとして他の項目と同列（4スペースインデント）
- 複数指定はカンマ区切り

### B. 仕様書アウトプットへの「実装参考情報」セクション追加

requirements.md と design.md に、下流（設計→タスク生成→実装）で活用できるSkill/参考リソース情報を追加する。

#### requirements.md に追加するセクション

requirements-generator が要件分析時に、既存コードベース・過去Plan/Issue・steering文書を調査した結果を「実装参考情報」セクションとして出力する。

```markdown
## 実装参考情報

### 推奨Skill/サブエージェント
| 対象領域 | 推奨 | 理由 |
|---------|------|------|
| UI実装 | [frontend-coder] | フォーム・ダッシュボード画面あり |
| デザイン実装 | [design-engineer] | ui-design.penからの実装 |
| API設計 | [steering:api-development] | RPC APIの新規追加 |

### 参考リソース
- 類似Issue: #42（認証機能） - 同じ認証パターンを使用
- 類似Plan: docs/plans/202602/20250215-auth-flow.plan.md
- 参考steering: backend-architecture.md（4層アーキテクチャ）
- 既存実装: src/features/users/ （類似のCRUD実装）
```

#### design.md に追加するセクション

design-generator が技術設計時に、この機能の実装で参照すべき関連ドキュメントと関連Skill/サブエージェントを出力する。タスクグループ別の割り当ては**行わない**（tasks-generatorの責務）。

```markdown
## 関連ドキュメント

### 参照すべきsteering文書
- backend-architecture.md: 4層アーキテクチャ、Repository/Mapper パターン
- api-development.md: RPC APIルーティング規約
- frontend-development.md: Server Components / Client Components使い分け
- testing-strategy.md: テストレベル・テスト対象の判断

### 参考リソース
- 類似Issue: #42（認証機能） - 同じ認証パターンを使用
- 類似Plan: docs/plans/202602/20250215-auth-flow.plan.md
- 既存実装: src/features/users/ （類似のCRUD実装）

## 関連Skill・サブエージェント

### この機能で使用が想定されるサブエージェント
| サブエージェント | 用途 |
|----------------|------|
| [frontend-coder] | フォーム・ダッシュボード等のUI実装 |
| [design-engineer] | ui-design.penからのデザイン実装 |

### この機能で使用が想定されるSkill
| Skill | 用途 |
|-------|------|
| [steering:api-development] | RPC APIの新規追加時に参照 |
| [steering:backend-architecture] | 4層アーキテクチャに従った実装 |
| [einja-pencil-design-manager] | デザインマスターとの同期（UI変更時） |
```

**役割分担**: requirements.mdの「実装参考情報」は要件分析観点からの推奨Skill/参考リソース、design.mdの「関連ドキュメント」「関連Skill・サブエージェント」は技術設計観点からの参照先。tasks-generatorは両方を参照して各タスクに `実行サブエージェント` / `使用Skill` を割り当てる。

### C. 各サブエージェント呼び出し時のSkill読み込み指示

issue-spec-createが各サブエージェントを呼び出す際に、読み込むべきSkillを明示的に指示する。

| Phase | サブエージェント | 呼び出し時に追加する指示 |
|-------|----------------|----------------------|
| Phase 1 | requirements-generator | 「以下のSkillを事前に読み込んでから作業: `steering:acceptance-criteria-and-qa-guide`, `steering:testing-strategy`。また、過去Planを `docs/plans/` から検索し、類似Issueがあれば参考情報として記載すること」 |
| Phase 2 | ui-design-generator | 「以下のSkillを事前に読み込んでから作業: `steering:pencil-design-management`」 |
| Phase 3 | design-generator | 「以下のSkillを事前に読み込んでから作業: `steering:backend-architecture`, `steering:frontend-development`, `steering:api-development`, `steering:testing-strategy`, `steering:acceptance-criteria-and-qa-guide`。requirements.mdの『実装参考情報』セクションを参照し、design.mdに『関連ドキュメント』『関連Skill・サブエージェント』セクションを出力すること」 |
| Phase 4 | qa-generator | 「以下のSkillを事前に読み込んでから作業: `steering:acceptance-criteria-and-qa-guide`, `steering:testing-strategy`」 |
| Phase 5 | tasks-generator | 「requirements.mdの『実装参考情報』とdesign.mdの『関連ドキュメント』『関連Skill・サブエージェント』セクションを参照し、各タスクグループ/タスクに `**実行サブエージェント**` と `**使用Skill**` を付与すること」+ 委託ルール対応表 |

**注**: エージェント定義ファイルに既にsteering参照があるため重複するが、呼び出し時の明示的指示により「確実に読み込む」ことを保証する。エージェント定義側の記述はフォールバックとして残す。

### D. task-exec Skill の変更（メタデータ消費側）

task-exec が `実行サブエージェント` / `使用Skill` メタデータを実際に活用するよう変更する。

#### Step 1（Issueフェッチ + タスク解析）の変更

既存のメタデータ6項目に加え、以下2項目を抽出対象に追加:
- `実行サブエージェント`（タスクグループレベル / タスクレベル）
- `使用Skill`（タスクグループレベル / タスクレベル）

**継承ルール**: タスクグループレベルで指定 → 配下タスクに継承。タスクレベルで指定 → オーバーライド。

#### Step 4（依存関係ベース並列実行ループ）の変更

task-executerへのpromptに以下を追加:

1. **`実行サブエージェント` が指定されている場合**:
   - task-executerのpromptに「このタスクは `[エージェント名]` サブエージェントに委託して実装すること」を追加
   - task-executer自身がTask APIでそのサブエージェントを起動する（task-exec側でエージェント選択はしない。task-executerに委任する）

2. **`使用Skill` が指定されている場合**:
   - task-executerのpromptに「以下のSkillを事前に読み込んでから作業すること: `[Skill名]`」を追加

**注**: task-exec自体がサブエージェント起動ロジックを変更するのではなく、task-executerへの指示として渡す。これにより既存フローへの影響を最小限に抑える。

### E. task-management.md（SSoT）の更新

メタデータセクションに `実行サブエージェント`（任意）と `使用Skill`（任意）を追加。テンプレート例にも反映。

## タスク概要

| # | タスク | 対象ファイル |
|---|--------|------------|
| 0 | Planファイルを `docs/plans/202603/20260312-issue-spec-skill-metadata.plan.md` にリネーム | - |
| 1 | task-management.md にメタデータ2項目の仕様追加 | `docs/einja/steering/task-management.md` |
| 2 | tasks-generator Skill にフォーマット・メタデータ追加 | `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md` |
| 3 | tasks-generator agent にテンプレート・委託ルール・実装コンテキスト参照指示追加 | `.claude/agents/einja/issue-specs/tasks-generator.md` |
| 4 | tasks-validator Skill に検証項目追加（任意項目の形式違反はFAILURE扱い） | `.claude/skills/_einja-issue-spec-tasks-validator/SKILL.md` |
| 5 | tasks-validator agent に検証項目追加 | `.claude/agents/einja/issue-specs/tasks-validator.md` |
| 6 | requirements-generator agent に「実装参考情報」セクション出力指示追加 | `.claude/agents/einja/issue-specs/requirements-generator.md` |
| 7 | design-generator agent に「関連ドキュメント」「関連Skill・サブエージェント」セクション出力指示追加 | `.claude/agents/einja/issue-specs/design-generator.md` |
| 8 | issue-spec-create Skill に全Phase のSkill読み込み指示を追加 | `.claude/skills/einja-issue-spec-create/SKILL.md` |
| 9 | task-exec Skill にメタデータ2項目の抽出・活用ロジック追加 | `.claude/skills/einja-task-exec/SKILL.md` |
| 10 | exampleタスクの更新（新フォーマット反映: requirements.md, design.md, tasks.md） | `docs/einja/example/specs/issues/issue999-example-task/` |

## 並列実行計画

```
[並列-1] タスク1 + タスク2 + タスク3 + タスク6 + タスク7
    ↓ (タスク1完了待ち)
[並列-2] タスク4 + タスク5 + タスク9
    ↓
[並列-3] タスク8 + タスク10
```

- タスク1-3, 6-7: 相互依存なし（SSoT、generator、requirements、design の各変更は独立）
- タスク4-5: タスク1（SSoT定義）に依存
- タスク9: タスク1（SSoT定義）に依存（メタデータ仕様を参照してtask-execに反映）
- タスク8: 全タスクの変更内容を統合する指示のためラスト
- タスク10: 新フォーマットのexample更新

## 対象ファイル

| ファイル | 変更概要 |
|---------|---------|
| `docs/einja/steering/task-management.md` | `実行サブエージェント`・`使用Skill` メタデータ仕様追加、テンプレート更新 |
| `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md` | クイックリファレンスに2項目追加、design.mdの「関連Skill・サブエージェント」参照指示 |
| `.claude/agents/einja/issue-specs/tasks-generator.md` | Issue本文テンプレートに2項目追加、委託ルール対応表、関連ドキュメント/Skill参照 |
| `.claude/skills/_einja-issue-spec-tasks-validator/SKILL.md` | 2項目の形式検証追加（任意項目、`[名前]` 形式チェック） |
| `.claude/agents/einja/issue-specs/tasks-validator.md` | 検証項目に2項目の形式チェック追加 |
| `.claude/agents/einja/issue-specs/requirements-generator.md` | 「実装参考情報」セクション出力指示、過去Plan/Issue検索指示追加 |
| `.claude/agents/einja/issue-specs/design-generator.md` | 「関連ドキュメント」「関連Skill・サブエージェント」セクション出力指示追加 |
| `.claude/skills/einja-issue-spec-create/SKILL.md` | 全PhaseのSkill読み込み指示、Phase 5 の委託ルール情報追加 |
| `.claude/skills/einja-task-exec/SKILL.md` | Step 1にメタデータ2項目抽出追加、Step 4にtask-executerへの指示追加 |
| `docs/einja/example/specs/issues/issue999-example-task/` | 新フォーマットのexample反映（requirements.md, design.md, tasks.md） |

## リスク・不明点

1. **task-exec変更の影響範囲**: task-exec自体のエージェント起動ロジックは変更せず、task-executerへのpromptに指示を追加する方式のため、既存フローへの影響は最小限。ただしtask-executerが指示通りにサブエージェント委託できるかは実行時の検証が必要
2. **実装ACの不整合拡大**: task-management.md（5項目）とtasks-generator（6項目）で`実装AC`の扱いが異なる。今回2項目追加でさらに乖離拡大。後続タスクとして`実装AC`のSSoT反映を対応すべき
3. **steering参照の重複**: エージェント定義と呼び出し時指示で同じsteering参照が重複するが、「確実な読み込み保証」として許容。エージェント定義側はフォールバック
4. **過去Plan/Issue検索の精度**: requirements-generatorが適切な類似リソースを見つけられるかは検索精度に依存

## 検証・動作確認方法

1. 各ファイルの変更がディスク上に正しく反映されていることをRead/Grepで確認
2. テンプレート例が新フォーマットと整合していることを目視確認
3. tasks-validator Skillの検証項目リストに `実行サブエージェント`・`使用Skill` が含まれていることを確認
4. exampleのrequirements.md/design.mdに新セクションが含まれていることを確認
5. `pnpm prepush` でlint/typecheck/testが通ることを確認（ドキュメントのみの変更なので影響なし）
