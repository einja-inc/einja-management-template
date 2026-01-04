# シナリオテスト

## 概要
このファイルは、複数のユーザーストーリーをまたぐ継続操作のシナリオテストを定義します。
各フェーズ完了後に、該当するシナリオテストを実行してください。

---

## シナリオ1: 初回同期からカスタマイズ、更新取り込みまでの全体フロー

### 目的
新規プロジェクトへの初回同期、ローカルカスタマイズ、テンプレート更新の取り込みという一連のワークフローが正しく動作することを確認する。

### 関連
- **受け入れ条件**: AC1.1, AC1.2, AC1.3, AC2.1, AC2.2, AC5.1, AC7.1, AC9.1
- **関連タスク**: Story 1, 2, 5, 7, 9

### 実施タイミング
- **Phase 1完了後**: 全Step実施（基本同期機能がすべて実装される）
- **Phase 2完了後**: 全Step + マーカー処理の確認（リグレッション）
- **Phase 3完了後**: 全Step（最終リグレッション）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | 新規プロジェクトディレクトリを作成 | - | - | - |
| 2 | npx @einja/cli init（初期化） | プロジェクトセットアップ | .claude/, docs/が作成される | - |
| 3 | npx @einja/cli sync 実行 | 初回同期成功 | ✅ 同期完了メッセージ、.einja-sync.json作成 | - |
| 4 | ls .claude/commands/einja/ 実行 | ファイル配置確認 | spec-create.md, task-exec.md等が存在 | - |
| 5 | cat .einja-sync.json \| jq '.' 実行 | メタデータ生成確認 | version, lastSync, filesキーが存在 | - |
| 6 | ローカルファイルをカスタマイズ (.claude/commands/einja/spec-create.md) | - | - | - |
| 7 | npx @einja/cli sync 実行 | 更新なし確認 | "すでに最新です" メッセージ | - |
| 8 | テンプレート側を更新（CLIパッケージ更新を想定） | - | - | - |
| 9 | npx @einja/cli sync --dry-run 実行 | ドライラン確認 | ファイル変更なし、差分サマリー表示 | - |
| 10 | npx @einja/cli sync 実行 | 更新取り込み | ローカル変更を保持しつつテンプレート更新が適用 | - |
| 11 | git diff HEAD~1 実行 | マージ結果確認 | 両方の変更が含まれている | - |

### 実行ログ
（実施後に記載）

---

## シナリオ2: コンフリクト発生から解消までのフロー

### 目的
3方向マージでコンフリクトが発生した場合の検出、報告、手動解消、再同期のワークフローが正しく動作することを確認する。

### 関連
- **受け入れ条件**: AC1.3, AC7.1, AC7.2, AC7.3
- **関連タスク**: Story 1, 7

### 実施タイミング
- **Phase 1完了後**: 全Step実施（コンフリクト検出機能が実装される）
- **Phase 2完了後**: 全Step（リグレッション）
- **Phase 3完了後**: 全Step（最終リグレッション）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | プロジェクトに初回同期済みの状態を準備 | - | - | - |
| 2 | ローカルファイルの特定行を編集 (.claude/commands/einja/task-exec.md) | - | - | - |
| 3 | テンプレート側も同じ行を異なる内容で編集 | - | - | - |
| 4 | npx @einja/cli sync 実行 | コンフリクト検出 | 終了コード1、コンフリクトメッセージ表示 | - |
| 5 | cat .claude/commands/einja/task-exec.md 実行 | マーカー挿入確認 | `<<<<<<< LOCAL`, `=======`, `>>>>>>> TEMPLATE`が存在 | - |
| 6 | npx @einja/cli sync 実行（再実行） | 未解決コンフリクト検出 | "未解決のコンフリクトが存在します" エラー | - |
| 7 | コンフリクトマーカーを手動編集して解消 | - | - | - |
| 8 | npx @einja/cli sync 実行 | 再同期成功 | ✅ 同期完了メッセージ | - |
| 9 | grep "<<<<<<< LOCAL" .claude/commands/einja/task-exec.md 実行 | マーカー削除確認 | マーカーが存在しない | - |

### 実行ログ
（実施後に記載）

---

## シナリオ3: 選択的同期とマーカー処理の組み合わせ

### 目的
--onlyオプションでの部分同期と@einja:managedマーカーによるセクション上書きが組み合わさった場合の動作を確認する。

### 関連
- **受け入れ条件**: AC3.1, AC3.2, AC3.3, AC4.1, AC4.2
- **関連タスク**: Story 3, 4

### 実施タイミング
- **Phase 2完了後**: 全Step実施（マーカー処理と選択的同期が実装される）
- **Phase 3完了後**: 全Step（リグレッション）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | プロジェクトに初回同期済みの状態を準備 | - | - | - |
| 2 | .claude/commands/einja/ファイルに@einja:managedマーカーを配置 | - | - | - |
| 3 | マーカー内セクションとマーカー外セクションを編集 | - | - | - |
| 4 | npx @einja/cli sync --only commands 実行 | commandsのみ同期 | commandsディレクトリのみ更新、agents/skills/docsはスキップ | - |
| 5 | cat .claude/commands/einja/ファイル 実行 | マーカー内上書き確認 | マーカー内はテンプレート版、マーカー外はローカル変更保持 | - |
| 6 | ls .claude/agents/einja/ 実行 | agents未同期確認 | 変更されていない（タイムスタンプ確認） | - |
| 7 | npx @einja/cli sync --only agents,skills 実行 | agents, skillsのみ同期 | 該当ディレクトリのみ更新 | - |
| 8 | cat .einja-sync.json \| jq '.files' 実行 | メタデータ更新確認 | commandsとagents/skillsのファイルハッシュが更新されている | - |

### 実行ログ
（実施後に記載）

---

## シナリオ4: 強制上書きとバックアップ

### 目的
--forceオプションでローカル変更を無視して同期する場合、バックアップが正しく作成され、復元が可能であることを確認する。

### 関連
- **受け入れ条件**: AC6.1, AC6.2, AC6.3
- **関連タスク**: Story 6

### 実施タイミング
- **Phase 3完了後**: 全Step実施（強制上書きオプションが実装される）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | プロジェクトに初回同期済み、ローカルカスタマイズあり | - | - | - |
| 2 | npx @einja/cli sync --force 実行 | 確認プロンプト表示 | "すべてのローカル変更が失われます。続けますか？" 表示 | - |
| 3 | "No" で中断 | 処理中断 | ファイル変更なし | - |
| 4 | npx @einja/cli sync --force --yes 実行 | 確認スキップ | 即座に実行開始 | - |
| 5 | ls -la .claude.backup-* 実行 | バックアップ作成確認 | バックアップディレクトリが作成されている | - |
| 6 | diff .claude.backup-*/commands/einja/spec-create.md .claude/commands/einja/spec-create.md 実行 | 上書き確認 | ローカル変更が失われ、テンプレート版になっている | - |
| 7 | cp -r .claude.backup-*/.claude . 実行 | 手動復元 | バックアップから復元可能 | - |

### 実行ログ
（実施後に記載）

---

## シナリオ5: CI/CD統合（JSON出力）

### 目的
--jsonオプションを使用してCI/CDパイプラインで同期結果を自動処理できることを確認する。

### 関連
- **受け入れ条件**: AC8.1, AC8.2, AC8.3
- **関連タスク**: Story 8

### 実施タイミング
- **Phase 3完了後**: 全Step実施（JSON出力オプションが実装される）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | プロジェクトに初回同期済みの状態を準備 | - | - | - |
| 2 | npx @einja/cli sync --json > sync-result.json 実行 | JSON出力 | 標準出力にJSON形式で結果出力 | - |
| 3 | cat sync-result.json \| jq '.' 実行 | JSON妥当性確認 | 有効なJSON形式 | - |
| 4 | cat sync-result.json \| jq '.status' 実行 | ステータス確認 | "success" または "partial_success" | - |
| 5 | cat sync-result.json \| jq '.summary' 実行 | サマリー確認 | total, changed, succeeded等のキーが存在 | - |
| 6 | コンフリクトが発生する状態を作成 | - | - | - |
| 7 | npx @einja/cli sync --json 2> stderr.log > sync-conflict.json 実行 | コンフリクトJSON出力 | JSONに"conflicts"配列が含まれる | - |
| 8 | cat stderr.log 実行 | ログ分離確認 | スピナー等のログは標準エラー出力に出力 | - |
| 9 | cat sync-conflict.json \| jq '.conflicts\[\] .path' 実行 | コンフリクト情報確認 | コンフリクトファイルパスが含まれる | - |

### 実行ログ
（実施後に記載）

---

## シナリオ6: パフォーマンステスト（100ファイル同期）

### 目的
要件で定義された「100ファイルの同期を3秒以内に完了」というパフォーマンス要件を満たすことを確認する。

### 関連
- **受け入れ条件**: 非機能要件（パフォーマンス）
- **関連タスク**: 全Story

### 実施タイミング
- **Phase 1完了後**: 基本同期の性能測定
- **Phase 2完了後**: マーカー処理追加後の性能測定
- **Phase 3完了後**: 全機能実装後の最終性能測定

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | テスト用プロジェクトに100個のファイルを配置 | - | - | - |
| 2 | time npx @einja/cli sync 実行 | 初回同期時間 | 3秒以内（100ファイル処理） | - |
| 3 | ファイル内容を一部変更（10ファイル） | - | - | - |
| 4 | time npx @einja/cli sync 実行 | 差分同期時間 | 1秒以内（変更ファイルのみ処理） | - |
| 5 | cat .einja-sync.json \| jq '.files \| length' 実行 | メタデータファイル数確認 | 100件 | - |
| 6 | メモリ使用量確認（/usr/bin/time -v など） | メモリ使用量 | 100MB以下 | - |

### 実行ログ
（実施後に記載）

---

## シナリオ7: エラーハンドリングと復旧

### 目的
各種エラー状況（権限エラー、不正なマーカー、ネットワークエラー等）で適切にエラー処理され、復旧可能であることを確認する。

### 関連
- **受け入れ条件**: AC3.3, AC4.3, AC7.2, AC7.3
- **関連タスク**: Story 3, 4, 7

### 実施タイミング
- **Phase 2完了後**: 部分実施（マーカーエラー、カテゴリエラー）
- **Phase 3完了後**: 全Step実施

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | 不正なマーカーペアのファイルを作成（startのみ） | - | - | マーカーエラーテスト準備 |
| 2 | npx @einja/cli sync 実行 | マーカーエラー検出 | エラーメッセージ、ファイルパスと行番号表示 | - |
| 3 | マーカーを修正 | - | - | - |
| 4 | npx @einja/cli sync 実行 | 同期成功 | ✅ 同期完了メッセージ | - |
| 5 | npx @einja/cli sync --only invalid-category 実行 | 無効なカテゴリエラー | エラーメッセージ、有効なカテゴリ一覧表示 | - |
| 6 | chmod 000 .claude/commands/einja/ 実行（権限削除） | - | - | 権限エラーテスト準備 |
| 7 | npx @einja/cli sync 実行 | 権限エラー検出 | 終了コード1、権限エラーメッセージ | - |
| 8 | chmod 755 .claude/commands/einja/ 実行（権限復元） | - | - | - |
| 9 | npx @einja/cli sync 実行 | 同期成功 | ✅ 同期完了メッセージ | - |

### 実行ログ
（実施後に記載）

---

## シナリオ実施チェックリスト

各シナリオテストの実施状況を記録します：

| シナリオ | Phase 1 | Phase 2 | Phase 3 | 備考 |
|---------|---------|---------|---------|------|
| シナリオ1: 初回同期からカスタマイズ、更新取り込みまでの全体フロー | 🔄 | 🔄 | 🔄 | - |
| シナリオ2: コンフリクト発生から解消までのフロー | 🔄 | 🔄 | 🔄 | - |
| シナリオ3: 選択的同期とマーカー処理の組み合わせ | - | 🔄 | 🔄 | Phase 2以降 |
| シナリオ4: 強制上書きとバックアップ | - | - | 🔄 | Phase 3のみ |
| シナリオ5: CI/CD統合（JSON出力） | - | - | 🔄 | Phase 3のみ |
| シナリオ6: パフォーマンステスト（100ファイル同期） | 🔄 | 🔄 | 🔄 | - |
| シナリオ7: エラーハンドリングと復旧 | - | 🔄 | 🔄 | Phase 2以降 |

**凡例**: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / 🔄 未実施

---

## シナリオ8: プリセット更新の基本フロー

### 目的
CLIリポジトリ内でupdate-presetコマンドを実行し、プロジェクトの.claude/やdocs/の内容がプリセットに正しく反映されることを確認する。

### 関連
- **受け入れ条件**: AC10.1, AC10.2, AC10.3, AC10.4, AC10.5
- **関連タスク**: Story 10

### 実施タイミング
- **Phase 4完了後**: 全Step実施（プリセット更新機能が実装される）

### 前提条件
- einja/cliリポジトリをクローンしていること
- CLIリポジトリのルートディレクトリで実行すること

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | CLIリポジトリのルートに移動 | - | - | - |
| 2 | .claude/commands/einja/test-file.md を新規作成 | - | - | テストデータ準備 |
| 3 | npx @einja/cli update-preset --dry-run 実行 | ドライラン確認 | 変更予定ファイル一覧表示、実際のファイル変更なし | - |
| 4 | npx @einja/cli update-preset 実行 | プリセット更新成功 | ✅ 更新完了メッセージ | - |
| 5 | ls packages/cli/presets/turborepo-pandacss/.claude/commands/einja/ 実行 | ファイルコピー確認 | test-file.md が存在 | - |
| 6 | ls packages/cli/presets/minimal/.claude/commands/einja/ 実行 | 全プリセット更新確認 | test-file.md が存在 | - |
| 7 | diff .claude/commands/einja/test-file.md packages/cli/presets/turborepo-pandacss/.claude/commands/einja/test-file.md 実行 | 内容一致確認 | 差分なし | - |

### 実行ログ
（実施後に記載）

---

## シナリオ9: プリセット更新のディレクトリマッピング

### 目的
各同期対象ディレクトリ（commands, agents, skills, docs/steering, docs/templates）が正しいマッピングでプリセットに反映されることを確認する。

### 関連
- **受け入れ条件**: AC10.3, AC10.4, AC10.5
- **関連タスク**: Story 10

### 実施タイミング
- **Phase 4完了後**: 全Step実施

### 前提条件
- einja/cliリポジトリをクローンしていること
- CLIリポジトリのルートディレクトリで実行すること

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | CLIリポジトリのルートに移動 | - | - | - |
| 2 | テスト用ファイルを各ディレクトリに作成 | - | - | テストデータ準備 |
| - | .claude/commands/einja/cmd-test.md 作成 | - | - | - |
| - | .claude/agents/einja/agent-test.md 作成 | - | - | - |
| - | .claude/skills/einja/skill-test.md 作成 | - | - | - |
| - | docs/steering/steer-test.md 作成 | - | - | - |
| - | docs/templates/tmpl-test.md 作成 | - | - | - |
| 3 | npx @einja/cli update-preset 実行 | 全ディレクトリ更新成功 | ✅ 更新完了メッセージ | - |
| 4 | 各プリセットディレクトリを確認 | マッピング確認 | 下記期待値を満たす | - |
| - | ls packages/cli/presets/*/\`.claude/commands/einja/\` | cmd-test.md 存在 | - |
| - | ls packages/cli/presets/*/\`.claude/agents/einja/\` | agent-test.md 存在 | - |
| - | ls packages/cli/presets/*/\`.claude/skills/einja/\` | skill-test.md 存在 | - |
| - | ls packages/cli/presets/*/\`docs/einja/steering/\` | steer-test.md 存在 | - |
| - | ls packages/cli/presets/*/\`docs/einja/templates/\` | tmpl-test.md 存在 | - |
| 5 | _プレフィックスファイルを作成 (.claude/commands/einja/_private.md) | - | - | - |
| 6 | npx @einja/cli update-preset 実行 | _ ファイルスキップ | _private.md がプリセットに存在しない | - |
| 7 | ls packages/cli/presets/turborepo-pandacss/.claude/commands/einja/_private.md 実行 | ファイル不在確認 | "No such file or directory" | - |

### 実行ログ
（実施後に記載）

---

## シナリオ10: 選択的プリセット更新

### 目的
--presetオプションで特定のプリセットのみを更新できることを確認する。

### 関連
- **受け入れ条件**: AC10.6
- **関連タスク**: Story 10

### 実施タイミング
- **Phase 4完了後**: 全Step実施

### 前提条件
- einja/cliリポジトリをクローンしていること
- CLIリポジトリのルートディレクトリで実行すること

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | CLIリポジトリのルートに移動 | - | - | - |
| 2 | .claude/commands/einja/selective-test.md を新規作成 | - | - | テストデータ準備 |
| 3 | npx @einja/cli update-preset --preset turborepo-pandacss 実行 | 選択的更新成功 | ✅ 更新完了メッセージ | - |
| 4 | ls packages/cli/presets/turborepo-pandacss/.claude/commands/einja/ 実行 | turborepo-pandacss更新確認 | selective-test.md が存在 | - |
| 5 | ls packages/cli/presets/minimal/.claude/commands/einja/ 実行 | minimal未更新確認 | selective-test.md が存在しない | - |
| 6 | npx @einja/cli update-preset --preset invalid-preset 実行 | 無効プリセットエラー | エラーメッセージ、有効なプリセット一覧表示 | - |

### 実行ログ
（実施後に記載）

---

## シナリオ11: CLIリポジトリ外での実行エラー

### 目的
update-presetコマンドをCLIリポジトリ外で実行した場合、適切なエラーメッセージが表示されることを確認する。

### 関連
- **受け入れ条件**: AC10.7
- **関連タスク**: Story 10

### 実施タイミング
- **Phase 4完了後**: 全Step実施

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | 任意の非CLIリポジトリプロジェクトに移動 | - | - | - |
| 2 | npx @einja/cli update-preset 実行 | CLIリポジトリ外エラー | 終了コード1、"CLIリポジトリ内で実行してください"エラーメッセージ | - |
| 3 | npx @einja/cli update-preset --json 実行 | エラーJSON出力 | {"status": "error", "error": {...}} 形式 | - |

### 実行ログ
（実施後に記載）

---

## シナリオ12: プリセット更新のJSON出力

### 目的
--jsonオプションを使用してプリセット更新結果をJSON形式で出力できることを確認する。

### 関連
- **受け入れ条件**: AC11.1, AC11.2
- **関連タスク**: Story 11

### 実施タイミング
- **Phase 4完了後**: 全Step実施

### 前提条件
- einja/cliリポジトリをクローンしていること
- CLIリポジトリのルートディレクトリで実行すること

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | CLIリポジトリのルートに移動 | - | - | - |
| 2 | .claude/commands/einja/json-test.md を新規作成 | - | - | テストデータ準備 |
| 3 | npx @einja/cli update-preset --json > update-result.json 実行 | JSON出力 | 標準出力にJSON形式で結果出力 | - |
| 4 | cat update-result.json \| jq '.' 実行 | JSON妥当性確認 | 有効なJSON形式 | - |
| 5 | cat update-result.json \| jq '.status' 実行 | ステータス確認 | "success" | - |
| 6 | cat update-result.json \| jq '.summary' 実行 | サマリー確認 | total, copied, skipped等のキーが存在 | - |
| 7 | cat update-result.json \| jq '.presets' 実行 | プリセット情報確認 | 更新されたプリセット名のリスト | - |
| 8 | cat update-result.json \| jq '.files' 実行 | ファイル情報確認 | コピーされたファイルパスのリスト | - |

### 実行ログ
（実施後に記載）

---

## シナリオ13: sync→update-preset→sync の双方向ワークフロー

### 目的
CLIの変更をプリセットに反映（update-preset）し、その後別のプロジェクトでsyncコマンドを実行して変更が正しく伝播することを確認する。

### 関連
- **受け入れ条件**: AC10.1, AC10.2, AC1.1, AC1.3
- **関連タスク**: Story 1, 10

### 実施タイミング
- **Phase 4完了後**: 全Step実施（sync + update-preset両方が実装される）

### 前提条件
- einja/cliリポジトリをクローンしていること
- テスト用のユーザープロジェクトディレクトリが存在すること

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | CLIリポジトリのルートに移動 | - | - | - |
| 2 | .claude/commands/einja/new-feature.md を新規作成（内容: "Version 1.0"） | - | - | 新機能追加を想定 |
| 3 | npx @einja/cli update-preset 実行 | プリセット更新成功 | ✅ 更新完了メッセージ | - |
| 4 | cat packages/cli/presets/turborepo-pandacss/.claude/commands/einja/new-feature.md 実行 | プリセット内容確認 | "Version 1.0" が含まれる | - |
| 5 | テスト用ユーザープロジェクトに移動 | - | - | - |
| 6 | npx @einja/cli sync 実行（ローカルCLIパッケージから） | sync実行 | ✅ 同期完了メッセージ | - |
| 7 | cat .claude/commands/einja/new-feature.md 実行 | ユーザープロジェクト内容確認 | "Version 1.0" が含まれる | - |
| 8 | CLIリポジトリに戻り、new-feature.md を更新（内容: "Version 2.0"） | - | - | バージョンアップを想定 |
| 9 | npx @einja/cli update-preset 実行 | プリセット再更新成功 | ✅ 更新完了メッセージ | - |
| 10 | テスト用ユーザープロジェクトに移動 | - | - | - |
| 11 | npx @einja/cli sync 実行 | 更新取り込み | ✅ 同期完了メッセージ | - |
| 12 | cat .claude/commands/einja/new-feature.md 実行 | 更新内容確認 | "Version 2.0" が含まれる | - |

### 実行ログ
（実施後に記載）

---

## シナリオ実施チェックリスト（更新版）

各シナリオテストの実施状況を記録します：

| シナリオ | Phase 1 | Phase 2 | Phase 3 | Phase 4 | 備考 |
|---------|---------|---------|---------|---------|------|
| シナリオ1: 初回同期からカスタマイズ、更新取り込みまでの全体フロー | 🔄 | 🔄 | 🔄 | 🔄 | - |
| シナリオ2: コンフリクト発生から解消までのフロー | 🔄 | 🔄 | 🔄 | 🔄 | - |
| シナリオ3: 選択的同期とマーカー処理の組み合わせ | - | 🔄 | 🔄 | 🔄 | Phase 2以降 |
| シナリオ4: 強制上書きとバックアップ | - | - | 🔄 | 🔄 | Phase 3以降 |
| シナリオ5: CI/CD統合（JSON出力） | - | - | 🔄 | 🔄 | Phase 3以降 |
| シナリオ6: パフォーマンステスト（100ファイル同期） | 🔄 | 🔄 | 🔄 | 🔄 | - |
| シナリオ7: エラーハンドリングと復旧 | - | 🔄 | 🔄 | 🔄 | Phase 2以降 |
| シナリオ8: プリセット更新の基本フロー | - | - | - | 🔄 | Phase 4のみ |
| シナリオ9: プリセット更新のディレクトリマッピング | - | - | - | 🔄 | Phase 4のみ |
| シナリオ10: 選択的プリセット更新 | - | - | - | 🔄 | Phase 4のみ |
| シナリオ11: CLIリポジトリ外での実行エラー | - | - | - | 🔄 | Phase 4のみ |
| シナリオ12: プリセット更新のJSON出力 | - | - | - | 🔄 | Phase 4のみ |
| シナリオ13: sync→update-preset→sync の双方向ワークフロー | - | - | - | 🔄 | Phase 4のみ |

**凡例**: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / 🔄 未実施
