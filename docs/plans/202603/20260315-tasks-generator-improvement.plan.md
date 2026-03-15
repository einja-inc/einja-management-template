# タスクジェネレーター仕様改善: サブエージェント指定粒度 + UIデザイン参照フィールド追加

## Context

GitHub Issue #130（drlove_demo_app）のタスク一覧を分析したところ、以下の2つの構造的問題が発見された:

1. **サブエージェント指定の曖昧さ**: タスクグループに複数のサブエージェント（`[frontend-coder], [backend-architect]`）が指定されている場合、配下タスクへの継承が曖昧。どちらが継承されるか不定
2. **UIデザイン参照の欠如**: タスクに対応するUIデザイン（.penファイルのフレーム/Canvas）を参照するフィールドが存在しない。実装者が自力でデザインを探す必要がある

## 現状

### サブエージェント指定（現行ルール）
- タスクグループレベルで指定 → 配下全タスクに継承
- タスクレベルで指定 → グループレベルをオーバーライド
- **問題**: 複数サブエージェントをグループに指定した場合のルールが未定義

### UIデザイン参照（現行ルール）
- `**対応設計**: design.md「画面設計」` という間接参照のみ
- .penファイルのフレーム名を直接参照するフィールドなし
- フレーム命名規則は存在（`{URLパス}`, `{path}__[element]`, `{path}--[state]` 等）

## 変更内容

### 変更1: サブエージェント指定ルールの明確化

**ルール変更**:
1. タスクグループレベルでの複数サブエージェント指定を**禁止**
2. タスクレベルでの複数サブエージェント指定も**禁止**（1タスク = 1サブエージェント）
3. 単一サブエージェントのグループレベル継承は**維持**（同一専門領域のタスクが集まったグループでの省略記法として有用なため）

理由: タスクグループは `einja-task-exec` が受け取る実行単位。グループ内の各タスクが異なるサブエージェントを必要とするなら、タスクレベルで個別に明示すべき。1タスクに複数サブエージェントを指定しても `task-executer` がどちらに委託すべきか不定になる。

### 変更2: `対応UIデザイン` フィールド追加

**新しい任意メタデータ**: `**対応UIデザイン**: ui-design.pen「フレーム名」`

- UI実装を含むタスクにのみ付与（バックエンドのみのタスクには不要）
- フレーム名は .pen ファイル内のフレーム命名規則に準拠
- 複数フレームはカンマ区切り

```markdown
- 1.3.1 VoiceCallOverlayコンポーネント実装（TDD）
  - ...
  - **対応UIデザイン**: ui-design.pen「voice-call」「voice-call--ai-speaking」
```

**フォーマット仕様**:
- ファイル名は `ui-design.pen` 固定（Issue仕様書ディレクトリ内の `.pen` ファイル）
- フレーム名は全角鍵括弧 `「」` で囲む（`対応設計` の `design.md「セクション名」` と書式統一）
- 複数フレームは連続記載: `ui-design.pen「frame1」「frame2」`
- バリデーター正規表現: `ui-design\.pen(「[\w-]+」)+`

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `docs/einja/steering/task-management.md` | ① 任意メタデータに`対応UIデザイン`追加 ② サブエージェント複数指定禁止ルール追加（グループ・タスク両方） |
| `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md` | ① 任意メタデータに`対応UIデザイン`追加 ② サブエージェント割り当てルール更新 ③ テンプレート更新 |
| `.claude/skills/_einja-issue-spec-tasks-validator/SKILL.md` | ① `対応UIデザイン`形式検証追加 ② 複数サブエージェント検出→エラー ③ エラー種別追加 |
| `.claude/agents/einja/issue-specs/tasks-generator.md` | ① サンプルコード更新（グループレベル複数指定→タスクレベル個別指定） ② `対応UIデザイン`をサンプルに追加 ③ 割り当てルールセクション更新 |
| `.claude/agents/einja/issue-specs/tasks-validator.md` | ① 任意メタデータ検証セクション更新（複数指定禁止ルール追加） |

## タスク概要

- **0-0**: TaskCreate でタスク登録 [TaskCreate]
- **0-1**: Planファイルを `docs/plans/202603/20260315-tasks-generator-improvement.plan.md` にリネーム [Bash]
- **1-1**: `docs/einja/steering/task-management.md` の更新 [general-purpose]
  - 任意メタデータセクションに `対応UIデザイン` フィールド追加
  - サブエージェント複数指定禁止ルール追加（グループ・タスク両方）
  - サンプルコード更新
- **1-2**: `_einja-issue-spec-tasks-generator/SKILL.md` の更新 [general-purpose]
  - 任意メタデータに `対応UIデザイン` 追加
  - サブエージェント割り当てセクション更新（複数指定禁止）
  - TDDテンプレートに `対応UIデザイン` 追加
- **1-3**: `_einja-issue-spec-tasks-validator/SKILL.md` の更新 [general-purpose]
  - 検証項目7に `対応UIデザイン` 形式チェック追加（正規表現: `ui-design\.pen(「[\w-]+」)+`）
  - 新検証項目: 複数サブエージェント検出（グループ・タスク両方）
  - エラー種別に `multiple_subagents` 追加
- **1-4**: `.claude/agents/einja/issue-specs/tasks-generator.md` の更新 [general-purpose]
  - L.174-175のサンプルコード更新（グループレベル複数指定削除）
  - L.288-310のメタデータ記載例に `対応UIデザイン` 追加
  - L.640-643の割り当てルール更新（複数指定禁止）
- **1-5**: `.claude/agents/einja/issue-specs/tasks-validator.md` の更新 [general-purpose]
  - L.146-155の任意メタデータ検証に複数サブエージェント禁止ルール追加

### 並列実行計画
- 1-1, 1-2, 1-3, 1-4, 1-5 は独立したファイルへの変更のため**全て並列実行可能**

## リスク・不明点

- **下流影響**: task-management.md はマネージドディレクトリだが、このリポジトリがSingle Source of Truthのため編集可。ビルド時に `presets/default/` へ自動コピーされる
- **既存Issue互換**: 既存Issueのタスク一覧は新フォーマットに自動更新されない（再生成or手動修正が必要）

## 検証・動作確認方法

1. **5ファイル間の整合性確認**: フィールド名・書式・ルールが全ファイルで一致していること
   - `対応UIデザイン` の書式が task-management.md / generator SKILL / generator agent / validator SKILL / validator agent で統一されているか
   - サブエージェント複数指定禁止ルールが同様に全ファイルで統一されているか
2. **サンプルタスクによる机上テスト**: 以下のケースで validator の期待動作を確認
   - ✅ PASS: タスクレベルに `[frontend-coder]` 単一指定 → OK
   - ✅ PASS: グループレベルに `[backend-architect]` 単一指定、タスクは省略（継承） → OK
   - ❌ FAIL: グループレベルに `[frontend-coder], [backend-architect]` 複数指定 → `multiple_subagents` エラー
   - ❌ FAIL: タスクレベルに `[frontend-coder], [design-engineer]` 複数指定 → `multiple_subagents` エラー
   - ✅ PASS: `**対応UIデザイン**: ui-design.pen「voice-call」「voice-call--ai-speaking」` → OK
   - ❌ FAIL: `**対応UIデザイン**: voice-call` → `invalid_optional_metadata_format` エラー
3. **`pnpm prepush`** でlint通過確認
