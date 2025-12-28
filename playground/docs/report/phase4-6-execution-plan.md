# Phase 4-6 実行計画書

**作成日**: 2025-12-27
**ステータス**: ✅ 完了
**バージョン**: v2.0（自動化プロセス検証観点で修正）
**完了日**: 2025-12-28
**最終レポート**: `phase4-6-verification-report.md`

---

## 検証の真の目的

> **重要**: この検証の主目的は「**自動化された開発プロセスの動作検証**」であり、手動実装ではない。

### 検証対象の自動化プロセス

| プロセス | 説明 | 検証ポイント |
|---------|------|-------------|
| **task-exec Skill** | 5層エージェント統合フロー | 各層が正しく動作するか |
| **QA Skill** | 品質保証自動化（7ステップ） | qa-tests/が自動生成されるか |
| **task-starter** | Issue読み込み、タスク選定 | Issue更新が正しく行われるか |
| **task-executer** | 要件定義に基づく自動実装 | コード品質は期待水準か |
| **task-reviewer** | コードレビュー | 問題検出時の差し戻しが機能するか |
| **task-qa** | QA Skill呼び出し | 7ステップが完了するか |
| **task-finisher** | 完了記録 | タスク完了が正しく記録されるか |

### 手動作業 vs 自動化の区別

| 作業 | 種別 | 理由 |
|------|------|------|
| requirements.md作成 | **手動** | 仕様は人間が定義 |
| data/todos.json初期化 | **手動** | データディレクトリ準備 |
| GitHub Issue作成 | **手動** | タスク定義は人間が行う |
| route.ts実装 | **自動** | task-executerが生成 |
| page.tsx実装 | **自動** | task-executerが生成 |
| route.test.ts実装 | **自動** | task-executerが生成 |
| qa-tests/作成 | **自動** | QA Skillが生成 |

---

## 進捗トラッキング

### Phase 4: TODO App自動実装 + QA Skill動作検証

| ステップ | 状態 | 説明 |
|---------|------|------|
| 4.0 計画ドキュメント出力 | ✅ 完了 | 本ドキュメント |
| 4.1 requirements.md作成 | ✅ 完了 | AC1.1/1.2/1.3定義済み |
| 4.2 data/todos.json初期化 | ✅ 完了 | 空配列で初期化 |
| 4.3 GitHub Issue作成 | ✅ 完了 | Issue #12作成 |
| 4.4 task-exec呼び出し | ✅ 完了 | 5層エージェント正常動作 |
| 4.5 自動実装結果検証 | ✅ 完了 | 必須テスト4/5 PASS |

### Phase 5: 5層エージェント統合フロー詳細検証

| ステップ | 状態 | 説明 |
|---------|------|------|
| 5.1 動作ログ分析 | ✅ 完了 | 5層すべて正常動作確認 |
| 5.2 エラーリカバリー検証 | ✅ 完了 | 差し戻し2回発生・正常動作 |
| 5.3 完了報告フォーマット検証 | ✅ 完了 | 100%フォーマット一致 |

### Phase 6: ドキュメント品質評価

| ステップ | 状態 | 説明 |
|---------|------|------|
| 6.1 task-exec関連ドキュメント評価 | ✅ 完了 | 96%整合性 |
| 6.2 QA Skill関連ドキュメント評価 | ✅ 完了 | 100%整合性 |
| 6.3 playground関連ドキュメント評価 | ✅ 完了 | 68%整合性（改善余地あり） |
| 6.4 整合性レポート作成 | ✅ 完了 | phase4-6-verification-report.md |

---

## Phase 4 詳細手順

### 4.1 requirements.md作成（手動）

**ファイル**: `playground/mock-data/specs/todo-app/requirements.md`

**内容要件**:
- AC1.1: POST /api/todos エンドポイント（検証レベル: Unit）
- AC1.2: GET /api/todos エンドポイント（検証レベル: Integration）
- AC1.3: /todos ページ表示（検証レベル: E2E）

**コミット**: `feat: TODO App要件定義作成`

### 4.2 data/todos.json初期化（手動）

**ファイル**: `playground/data/todos.json`

**内容**: `[]`

**コミット**: `chore: TODOデータファイル初期化`

### 4.3 GitHub Issue作成（手動）

**方法**: GitHubリポジトリで新規Issue作成

**内容**:
```markdown
# TODOアプリ実装タスク

## タスク一覧

### Phase 1: 実装フェーズ

- [ ] **1.1 TODO App基本機能実装**
  - **依存関係**: なし
  - **完了条件**: 必須自動テスト5項目すべてPASS

**仕様書**: `playground/mock-data/specs/todo-app/`
```

### 4.4 task-exec呼び出し（自動実装）

**コマンド**:
```
/task-exec #[Issue番号] 1.1
```

**期待される動作**:

1. **task-starter**: Issue取得、タスク選定、`<!-- 🔄 着手中 -->` 追加
2. **task-executer**: requirements.md読み込み、コード自動生成
3. **task-reviewer**: コードレビュー実行
4. **task-qa**: QA Skill呼び出し、7ステップ実行
5. **task-finisher**: タスク完了記録、Issue更新

**自動生成されるファイル**:
- `playground/apps/sample-app/src/app/api/todos/route.ts`
- `playground/apps/sample-app/src/app/todos/page.tsx`
- `playground/apps/sample-app/src/app/api/todos/route.test.ts`
- `playground/mock-data/specs/todo-app/qa-tests/phase1/1-1.md`

### 4.5 自動実装結果検証

**検証コマンド**:
```bash
cd playground
pnpm --filter sample-app test
pnpm --filter sample-app test:e2e
pnpm lint
pnpm build
pnpm --filter sample-app typecheck
```

**成功基準**: 5項目すべてPASS

---

## Phase 5 詳細手順

### 5.1 動作ログ分析

**検証対象**: Phase 4で出力された5層エージェントの完了報告

**各層の検証項目**:

| 層 | 検証項目 |
|----|---------|
| task-starter | Issue番号認識、タスクグループID抽出、Issue更新 |
| task-executer | AC読み取り、コード品質、modifications作成 |
| task-reviewer | レビュー実行、差し戻しフロー |
| task-qa | 7ステップ実行、qa-tests生成 |
| task-finisher | 完了記録、Issue更新 |

### 5.2 エラーリカバリー検証

**失敗原因分類の精度確認**:

| 分類 | 原因 | 差し戻し先 |
|-----|------|-----------|
| A | 実装ミス | task-executer |
| B | 要件齟齬 | requirements.md修正 |
| C | 設計不備 | design.md修正 |
| D | 環境問題 | qa-retry |

### 5.3 完了報告フォーマット検証

**期待フォーマット**:
```markdown
## 🧪 品質保証フェーズ完了

### タスク: 1.1 - TODO App基本機能実装
### テスト結果: ✅ SUCCESS

### テストサマリー
- 実施項目: 3件
- 成功: 3件
- 失敗: 0件

### 必須自動テスト結果

| テスト項目 | ステータス | 備考 |
|-----------|----------|-----|
| Unit Test | ✅ PASS | |
| E2E Test | ✅ PASS | |
| Lint | ✅ PASS | |
| Build | ✅ PASS | |
| Type Check | ✅ PASS | |
```

---

## Phase 6 詳細手順

### 6.1 task-exec関連ドキュメント評価

**対象ファイル**:
- `.claude/skills/task-exec/SKILL.md`
- `.claude/agents/task/task-starter.md`
- `.claude/agents/task/task-executer.md`
- `.claude/agents/task/task-reviewer.md`
- `.claude/agents/task/task-qa.md`
- `.claude/agents/task/task-finisher.md`

### 6.2 QA Skill関連ドキュメント評価

**対象ファイル**:
- `.claude/skills/task-qa/SKILL.md`
- `.claude/skills/task-qa/REFERENCE.md`

**評価観点**:
- 7ステップの説明が実装と一致するか
- 必須自動テスト5項目の定義が正確か
- AC抽出ロジック（Unit除外）の説明が正確か

### 6.3 playground関連ドキュメント評価

**対象ファイル**:
- `playground/README.md`
- `playground/00-quick-start/README.md`

### 6.4 整合性レポート作成

**出力ファイル**: `playground/docs/report/phase4-6-verification-report.md`

**評価基準**:

| 評価項目 | 目標スコア |
|---------|----------|
| task-exec整合性 | 8/10以上 |
| QA Skill整合性 | 8/10以上 |
| playground整合性 | 8/10以上 |
| **総合** | 24/30（80%）以上 |

---

## コミット戦略

### 手動コミット（事前準備）

1. `feat: TODO App要件定義作成` - requirements.md
2. `chore: TODOデータファイル初期化` - data/todos.json

### 自動コミット（task-exec経由）

- task-executerによる自動コミットを検証
- コミット分割ルール準拠を確認

### 検証レポートコミット

3. `docs: Phase 4-6検証レポート作成` - verification-report.md

---

## 成功基準

### Phase 4

- [ ] requirements.md作成完了
- [ ] data/todos.json初期化完了
- [ ] GitHub Issue作成完了
- [ ] task-exec呼び出し成功
- [ ] 5層エージェントが順次実行される
- [ ] route.ts, page.tsx, route.test.tsが自動生成される
- [ ] 必須自動テスト5項目すべてPASS
- [ ] qa-tests/phase1/1-1.md作成完了
- [ ] AC1.1（Unit）が除外されている

### Phase 5

- [ ] 5層エージェントの完了報告フォーマットが一致
- [ ] エージェント間データ受け渡しが正確
- [ ] GitHub Issue更新が正常
- [ ] task-qa完了報告が期待フォーマットと一致

### Phase 6

- [ ] task-exec関連ドキュメントが実装と一致
- [ ] QA Skill関連ドキュメントが実装と一致
- [ ] playground関連ドキュメントが正確
- [ ] 総合評価24/30（80%）以上
- [ ] 改善提案の優先順位付け完了

---

## 注意事項

### 禁止事項

- ❌ route.ts, page.tsx, route.test.tsの手動実装
- ❌ task-executerの代わりに人間がコードを書く
- ❌ QA Skillの代わりに手動でテスト結果を記録する
- ❌ 構造確認テスト（toBeDefined()のみ）の生成

### 必須事項

- ✅ requirements.md（手動）→ task-exec（自動）→ 結果検証（手動）
- ✅ 自動化プロセスが期待通りに動作するかを観察・評価
- ✅ 失敗した場合は「なぜ自動化が失敗したか」を分析

---

**最終更新**: 2025-12-27
