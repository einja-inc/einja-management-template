# QAテスト結果ディレクトリ構造

## 概要
このディレクトリは、Issue #21「sync コマンド実装」のQAテスト結果を記録するためのものです。
CLIツールの特性上、手動実行とコマンド出力の確認が中心となります。

## ディレクトリ構造
```
qa-tests/
├── README.md           # このファイル（QAテストガイド）
├── scenarios.md        # シナリオテスト仕様（複数フェーズをまたぐフロー）
├── phase1/             # Phase 1: 基本同期機能
│   ├── 1-1.md         # Story 1, 2, 5, 7, 9のテスト結果
│   └── evidence/       # コマンド出力ログ、スクリーンショット等
├── phase2/             # Phase 2: 高度な機能
│   ├── 2-1.md         # Story 3, 4のテスト結果
│   └── evidence/
├── phase3/             # Phase 3: 最適化とオプション機能
│   ├── 3-1.md         # Story 6, 8のテスト結果
│   └── evidence/
└── phase4/             # Phase 4: プリセット更新機能
    ├── 4-1.md         # Story 10, 11のテスト結果
    └── evidence/
```

## QAテストファイルの記載内容

各QAテストファイル（例：`phase1/1-1.md`）には以下を記載：

1. **ヘッダー情報**: テスト対象ユーザーストーリー、実装日、テスト実施日
2. **各ストーリーのテスト内容**: 受け入れ条件（AC番号）、テストシナリオ（表形式）、全体ステータス、主な問題点、対応策、エビデンス
3. **統合テスト結果サマリー**: フェーズ全体の結果サマリー、次フェーズへの引き継ぎ事項、改善提案
4. **報告と対応**: 失敗原因分類、差し戻し情報、修正優先度

## テスト結果の更新方針

- **上書き更新**: 実施結果セクションは最新の結果のみを記載。過去の履歴は保持しない（Gitで管理）。更新日時を必ず記載。
- **ステータス定義**:
  - ✅ PASS（すべての受け入れ条件を満たす）
  - ❌ FAIL（要修正）
  - ⚠️ PARTIAL（軽微な問題あり）
  - 🔄 未実施（テスト未実施）
- **エビデンスの保存**: `qa-tests/phase*/evidence/` 配下にログファイル、コマンド出力、スクリーンショット等を保存。命名規則: `{ストーリー番号}-{内容}.{拡張子}`
- **実施タイミング**: ユーザーストーリー完了時（個別テスト）、フェーズ完了時（統合テスト）、リリース前（回帰テスト）

## テストシナリオの記載形式

### CLIコマンドテスト（簡潔な表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | プロジェクトルートに移動 | - | - | - | テスト環境準備 |
| 2 | npx @einja/cli sync 実行 | コマンドが成功 | 終了コード0 | - | - |
| 3 | - | ファイル同期完了メッセージ | "✅ 同期完了!" が表示される | - | - |
| 4 | ls .claude/commands/einja/ 実行 | ファイルが作成されている | spec-create.md, task-exec.md が存在 | - | - |

**重要**:
- 手順は自然言語で簡潔に記述（例: 「npx @einja/cli sync 実行」「ファイル内容確認」）
- 「-」は手順のみで確認項目がない場合に使用
- 備考欄はテストの区切りや注意事項を記載

### ファイル内容確認テスト（表形式 + コマンド例）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | cat .claude/commands/einja/spec-create.md 実行 | ファイル内容 | テンプレートの内容が含まれる | - | - |
| 2 | grep "@einja:managed" ファイル名 実行 | マーカー検出 | マーカーが正しく配置されている | - | - |
| 3 | diff 既存ファイル 新ファイル 実行 | 差分確認 | 差分が適切にマージされている | - | - |

**実行例**:
```bash
# ファイル内容確認
cat .claude/commands/einja/spec-create.md

# マーカー検出
grep -n "@einja:managed" .claude/commands/einja/spec-create.md

# 差分確認
diff .claude/commands/my-custom.md.backup .claude/commands/my-custom.md
```

### コンフリクト検出テスト（表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ローカルファイルを編集 | - | - | - | テストデータ準備 |
| 2 | テンプレート側も同じ箇所を編集 | - | - | - | コンフリクト条件作成 |
| 3 | npx @einja/cli sync 実行 | コンフリクト検出 | 終了コード1、コンフリクトメッセージ表示 | - | - |
| 4 | cat コンフリクトファイル 実行 | マーカー挿入 | `<<<<<<< LOCAL`, `=======`, `>>>>>>> TEMPLATE` が挿入されている | - | - |

### ドライランテスト（表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | npx @einja/cli sync --dry-run 実行 | コマンド成功 | 終了コード0 | - | - |
| 2 | - | ファイル変更なし | ファイルシステムに変更がない | - | - |
| 3 | - | 差分サマリー表示 | 変更予定のファイル一覧が表示される | - | - |

## テストツール使用例

### Bashコマンド（CLI実行）

```bash
# === sync コマンド ===

# 基本的な同期
npx @einja/cli sync

# ドライラン
npx @einja/cli sync --dry-run

# 選択的同期
npx @einja/cli sync --only commands,agents

# 強制上書き
npx @einja/cli sync --force --yes

# JSON出力
npx @einja/cli sync --json > sync-result.json

# ファイル確認
ls -la .claude/commands/einja/
cat .claude/commands/einja/spec-create.md

# 差分確認
diff original.md updated.md

# コンフリクト確認
grep -n "<<<<<<< LOCAL" .claude/commands/einja/task-exec.md

# メタデータ確認
cat .einja-sync.json | jq '.'

# === update-preset コマンド（CLIリポジトリ内で実行） ===

# 基本的なプリセット更新
npx @einja/cli update-preset

# ドライラン（差分確認のみ）
npx @einja/cli update-preset --dry-run

# 特定プリセットのみ更新
npx @einja/cli update-preset --preset turborepo-pandacss

# 強制上書き（確認スキップ）
npx @einja/cli update-preset --force

# JSON出力
npx @einja/cli update-preset --json > update-result.json

# プリセットディレクトリ確認
ls -la packages/cli/presets/turborepo-pandacss/.claude/commands/einja/
ls -la packages/cli/presets/minimal/.claude/commands/einja/

# プリセットファイル内容確認
cat packages/cli/presets/turborepo-pandacss/.claude/commands/einja/spec-create.md
```

### 自動テスト実行

```bash
# ユニットテスト
pnpm test

# 型チェック
pnpm typecheck

# Lintチェック
pnpm lint

# ビルドチェック
pnpm build
```

### エビデンス保存

```bash
# コマンド出力をログファイルに保存
npx @einja/cli sync 2>&1 | tee qa-tests/phase1/evidence/1-1-sync-output.log

# JSON出力を保存
npx @einja/cli sync --json > qa-tests/phase1/evidence/1-1-sync-result.json

# ファイル内容を保存
cat .claude/commands/einja/spec-create.md > qa-tests/phase1/evidence/1-1-spec-create.md
```

## 必須自動テスト

各フェーズのテスト実施前に、以下の自動テストを必ず実行してください：

### 実行コマンド
```bash
# 1. ユニットテスト
pnpm test

# 2. 型チェック（TypeScript）
pnpm typecheck

# 3. Lintチェック
pnpm lint

# 4. ビルドチェック
pnpm build
```

### 結果記録
各フェーズのテストファイルに「必須自動テスト結果」セクションを設け、以下の表形式で記録：

| テスト項目 | ステータス | 備考 |
|----------|----------|------|
| ユニットテスト | ✅/❌ | - |
| 型チェック | ✅/❌ | - |
| Lintチェック | ✅/❌ | - |
| ビルドチェック | ✅/❌ | - |

**重要**: 上記のいずれか1つでも失敗した場合、全体ステータスは**❌ FAIL**となります。

## 受け入れ基準とACマッピング

各ユーザーストーリーの受け入れ基準（AC番号）とテストシナリオの対応は以下の通り：

### Phase 1: 基本同期機能（P0）
- **Story 1**: 基本的なテンプレート同期
  - AC1.1: 既存プロジェクトへの同期成功
  - AC1.2: 更新がない場合のメッセージ表示
  - AC1.3: 3方向マージの実行
- **Story 2**: ディレクトリ分離
  - AC2.1: einja/サブディレクトリへの配置
  - AC2.2: _プレフィックスファイルのスキップ
  - AC2.3: einja/外のファイルのスキップ
- **Story 5**: ドライラン機能
  - AC5.1: ファイル変更なしでの差分表示
  - AC5.2: JSON形式での差分出力
  - AC5.3: コンフリクト箇所のハイライト
- **Story 7**: コンフリクト検出
  - AC7.1: コンフリクトマーカーの挿入
  - AC7.2: 終了コード1とヘルプメッセージ
  - AC7.3: 未解決コンフリクトの検出
- **Story 9**: パッケージ名変更
  - AC9.1: @einja/cliでの実行
  - AC9.2: package.jsonのname変更
  - AC9.3: 旧パッケージ名の非推奨警告

### Phase 2: 高度な機能（P1）
- **Story 3**: @einja:managedマーカー
  - AC3.1: マーカー内セクションの上書き
  - AC3.2: マーカー外セクションの3方向マージ
  - AC3.3: 不正なマーカーペアのエラー検出
- **Story 4**: 選択的同期
  - AC4.1: --only commands,agentsでの部分同期
  - AC4.2: --only skillsでの部分同期
  - AC4.3: 無効なカテゴリのエラー表示

### Phase 3: 最適化とオプション機能（P2）
- **Story 6**: 強制上書き
  - AC6.1: --forceでの完全上書き
  - AC6.2: 確認プロンプトの表示
  - AC6.3: --force --yesでの確認スキップ
- **Story 8**: JSON出力
  - AC8.1: --jsonでのJSON形式出力
  - AC8.2: コンフリクト情報のJSON出力
  - AC8.3: ログとJSONの分離出力

### Phase 4: プリセット更新機能（P1）
- **Story 10**: プリセット更新コマンド
  - AC10.1: CLIリポジトリ検出と実行
  - AC10.2: 全プリセットへの一括更新
  - AC10.3: .claude/ディレクトリの同期
  - AC10.4: docs/steering, docs/templatesの同期
  - AC10.5: _プレフィックスファイルのスキップ
  - AC10.6: --presetオプションでの選択的更新
  - AC10.7: CLIリポジトリ外での実行エラー
  - AC10.8: --dry-runでの差分確認
- **Story 11**: プリセット更新のJSON出力
  - AC11.1: --jsonでのJSON形式出力
  - AC11.2: 更新されたファイル一覧の出力

## テスト優先度

各テストケースには優先度を設定します：

- **P0（最優先）**: 基本機能・クリティカルパス（Phase 1）
- **P1（高優先）**: 重要な機能・主要なエッジケース（Phase 2, Phase 4）
- **P2（通常）**: オプション機能・拡張機能（Phase 3）

## 失敗原因分類（A/B/C/D）

QAテスト失敗時、以下の4分類のいずれかに分類し、適切な戻し先を決定します。

### 分類フローチャート
```
QAテスト失敗
    ↓
質問1: 実装コードに問題があるか？
  YES → 【A: 実装ミス】 → task-executer
  NO → 質問2へ
    ↓
質問2: requirements.md の受け入れ条件が不正確・不完全か？
  YES → 【B: 要件齟齬】 → requirements.md修正 → task-executer
  NO → 質問3へ
    ↓
質問3: design.md の設計・アーキテクチャに問題があるか？
  YES → 【C: 設計不備】 → design.md修正 → task-executer
  NO → 質問4へ
    ↓
質問4: 環境・インフラ・テストツールに問題があるか？
  YES → 【D: 環境問題】 → qa再実行
  NO → デフォルトで【A: 実装ミス】として扱う
```

### 各分類の定義

| 分類 | 定義 | 判定基準例 | 戻し先 |
|-----|------|----------|-------|
| **A: 実装ミス** | コードの論理エラー、バグ、実装漏れ | TypeScriptエラー、ランタイムエラー、ロジック不具合 | task-executer |
| **B: 要件齟齬** | requirements.md の受け入れ条件が実際の要求と異なる | ACの期待結果が曖昧、ビジネスルール未記載 | requirements.md修正 → task-executer |
| **C: 設計不備** | design.md のアーキテクチャ・設計方針に問題 | アルゴリズム設計ミス、インターフェース不備 | design.md修正 → task-executer |
| **D: 環境問題** | テスト環境、インフラ、ツールの問題 | Node.jsバージョン不一致、パッケージ未インストール | qa再実行 |

## 注意事項

### CLIツール特有の考慮事項
1. **出力フォーマットの一貫性**: ターミナル出力、JSON出力の両方で検証
2. **終了コードの確認**: 成功時は0、失敗時は1を返すことを確認
3. **エラーメッセージの明確性**: ユーザーフレンドリーなメッセージが表示されることを確認
4. **ファイルシステムの副作用**: 意図しないファイルの作成・削除がないことを確認
5. **オフライン動作**: ネットワーク接続なしでも動作することを確認

### テスト環境の準備
- Node.js >= 20.0.0
- pnpm インストール済み
- テスト用プロジェクトディレクトリ（.claude/, docs/ディレクトリ含む）
- GitHub Packages認証設定（einja-inc orgメンバー）

### エビデンスの品質基準
- コマンド出力ログは完全な形式で保存（ヘッダー、本文、フッター含む）
- JSON出力は整形して保存（`jq '.'`でフォーマット）
- ファイル内容の比較は`diff`コマンドの出力を保存
- スクリーンショットはターミナル全体を含める
