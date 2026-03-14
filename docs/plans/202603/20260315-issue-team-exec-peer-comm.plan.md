# einja-issue-team-exec ピア間通信再設計

## Context

現状の `einja-issue-team-exec` はLeadが全ゲートチェック（Fast Gate / Risk Gate）を担当し、Director間の通信がゼロという「ハブ&スポーク型」設計。Agent Teamsの最大の差別化要素であるピア間SendMessage能力を全く活用しておらず、通常のサブエージェント（Task API）でほぼ同等の動作が実現できてしまう。

本改修により、Director間のピアレビュー・変更通知・コンフリクト予防を追加し、Agent Teamsの本来の価値（対等なピア間協調）を活かした設計に移行する。

## 現状

### SKILL.md の構造
- Step A-C: 入力解析
- Step 0: 環境準備
- Step 1: Issue パース
- Step 2: ブランチ作成
- Step 3: 共有TaskList作成
- Step 4: TeamCreate + Directorプール spawn
- Step 5: 監視ループ（Lead側：SendMessage受信 + ゲートチェック + マージ検知）
- Step 6-8: Phase完了処理、最終PR、クリーンアップ

### 通信パターン（現行）
```
Lead ← Director（進捗報告、PR作成報告、エラー報告、idle通知）
Lead → Director（修正指示、shutdown_request）
Director ↔ Director（なし）← 問題
```

### Agent Teams SendMessage仕様（確認済み）
- **Teammate間直接メッセージ**: 可能（message: 1対1）
- **broadcast**: 可能（全Teammate宛一斉送信、コストはTeamサイズに比例）
- **Mailboxシステム**: `~/.claude/teams/{team-name}/inboxes/{name}.json` で配信

## 変更内容

### 設計原則

1. **Leadの既存責務は一切削らない** — ゲートチェック（Fast Gate / Risk Gate）、CI監視、リスク判定は全て従来通りLeadが実行
2. **ピアレビューは非同期・非ブロッキング** — 自タスクを中断しない。アイドル時のベストエフォート
3. **ステータス遷移は変更しない** — `pending → in_progress → awaiting_review → completed` を維持
4. **issue-exec-protocol.md は変更しない** — Agent Teams固有の拡張はSKILL.md内に閉じる
5. **Leadとピアレビューは補完関係**（二重チェックではない）

### 役割分担（改善後）

| チェック観点 | ピアレビュー（Director間） | Leadゲートチェック |
|------------|------------------------|------------------|
| 共有リソース重複・コンフリクト予防 | **担当** | 俯瞰チェック（バックアップ） |
| 設計横断的整合性（API形式統一等） | **担当** | 担当しない |
| 成果物存在（qa-tests, modifications） | 担当しない | **担当** |
| CI結果・危険シグナル | 担当しない | **担当** |
| Risk Gate（重要領域・大差分） | 担当しない | **担当** |

### 通信パターン（改善後）
```
Lead ←→ Director（Phase管理 + ゲートチェック + CI監視）← 従来通り
Director ↔ Director（ピアレビュー + 変更通知 + コンフリクト調整）← 新規
```

### 変更箇所

#### 1. Directorプロンプトテンプレート拡張（Step 4）

現行プロンプト（SKILL.md 209-239行）に3つの責務を追加:

**1-a. タスク開始宣言（task-claim時）**
- claimしたタスクと主要編集予定ファイルをbroadcast
- 受信側は自分の編集予定ファイルと重複がないかチェック → 重複時は `[conflict-alert]` で事前調整
- **宛先解決**: `[task-claim]` broadcastにより、各Directorは「誰がどのタスク・どのファイルを担当しているか」のマップを自身のコンテキスト内に保持する。これがピアレビューやconflict-alertの宛先特定に使われる

**1-b. 変更通知（タスク完了時）**
- 共有リソースの変化に絞ったbroadcast
- **共有リソースの定義**: 以下のいずれかに該当するもの
  - `shared/`, `packages/*/src/` 配下の型定義・ユーティリティ関数
  - APIエンドポイント（追加・変更）
  - DBスキーマ（テーブル・カラム追加・変更）
  - 複数タスクグループから参照されるコンポーネント
- **メッセージスキーマ**:
  ```
  [change-summary] Task {X.Y}: {タスク名}
  PR: #{PR番号}
  Changed shared: {shared/配下の変更ファイル or "なし"}
  New API: {エンドポイント or "なし"}
  New types: {型名 or "なし"}
  DB changes: {テーブル/カラム or "なし"}
  Note: {申し送り事項 or "なし"}
  ```

**1-c. ピアレビュー（アイドル時）**
- 自タスク完了後、次タスクがclaimableでない場合に実施
- CI待ち・マージ待ちのアイドル時間にも実施
- **中断条件**: claimableタスクが出現したらレビューを即中断し、claim優先
- レビュー観点: 重複実装、型/utilの共有化提案、API形式整合性、コンフリクト予防
- 提案は対象Directorに直接message（broadcastではない）
- 宛先はtask-claimで保持したDirector-タスクマップから特定
- 採用/却下は受信側が判断、迷う場合はLeadにエスカレーション

**1-d. コンフリクト予防プロトコル**
- `[conflict-alert]` 受信時の調整フロー
- タイムアウト: 初期値5分（実運用で調整。Directorがタスク実装中はメッセージ確認が遅延する可能性があるため）
- タイムアウト時はLeadエスカレーション

#### 2. Lead監視ループ拡張（Step 5）

Step 5-1のSendMessage受信テーブルに以下を追加:

| メッセージ種別 | 対応 |
|--------------|------|
| `[task-claim]`（broadcast） | ログ記録 + Director-ファイルマップ更新 |
| `[change-summary]`（broadcast） | ログ記録 + ファイル競合俯瞰チェック |
| `[conflict-resolved]` | ログ記録 + 調整内容の妥当性簡易確認 |
| `[conflict-alert]`（タイムアウト時） | Leadが調整方針を決定し両Directorに指示 |
| `[ci-failure]`（Lead → Director） | CI失敗検知時、原因DirectorのPRを特定し修正指示を送信 |
| ピアレビューエスカレーション | Leadが最終判断 |

新規 Step 5-6「ファイル競合俯瞰チェック」を追加:
- Director別の変更ファイルマップをメモリ保持
- 重複ファイル検出時に関係Directorに `[conflict-alert]` を送信
- Director自身のチェックのバックアップとして機能

#### 3. 新規セクション追加

**メッセージプレフィックス規約**:

| プレフィックス | 方向 | 用途 | 送信方式 |
|--------------|------|------|---------|
| `[progress]` | Director → Lead | タスク進捗報告 | message |
| `[task-claim]` | Director → All | タスク開始宣言 | broadcast |
| `[change-summary]` | Director → All | タスク完了時の変更サマリ | broadcast |
| `[conflict-alert]` | Director ↔ Director | ファイル競合警告 | message（当事者間） |
| `[conflict-resolved]` | Director → Lead | コンフリクト調整完了報告 | message |
| `[peer-review]` | Director → Director | ピアレビュー提案 | message（対象者のみ） |
| `[peer-review-ack]` | Director → Director | ピアレビュー応答 | message（提案元のみ） |
| `[ci-failure]` | Lead → Director | CI失敗通知・修正指示 | message |
| `[error]` | Director → Lead | エラー報告 | message |
| `[idle]` | Director → Lead | アイドル通知 | message |

**broadcastコスト管理**:
- broadcast許可: `[task-claim]`, `[change-summary]` のみ
- それ以外は全てmessage（当事者間のみ）

#### 4. tmux版との違いテーブル更新

通信パターンの差分を反映:

| 項目 | tmux版 | Agent Teams版（本Skill） |
|------|--------|------------------------|
| 通信 | ステータスファイルポーリング | SendMessage + broadcast + 自動idle通知 |
| **ピアレビュー** | **なし** | **Director間の非同期レビュー** |
| **変更通知** | **なし** | **broadcast による変更サマリ共有** |
| **コンフリクト予防** | **なし（事後対応のみ）** | **事前宣言 + 自動検知 + ピア調整** |

## タスク概要

| ID | タスク | 依存 | 使用Skill/サブエージェント |
|----|--------|------|--------------------------|
| 0-0 | TaskCreate一括登録 | - | [TaskCreate] |
| 0-1 | Planファイルを `docs/plans/202603/20260315-issue-team-exec-peer-comm.plan.md` にリネーム | - | [Bash] |
| 1-1 | SKILL.md Step 4: Directorプロンプトテンプレート拡張（ピアレビュー + 変更通知 + コンフリクト予防 + 宛先解決 + 共有リソース定義） | 0-1 | [general-purpose] |
| 1-2 | SKILL.md Step 5: Lead監視ループ拡張（受信テーブル拡張 + ファイル競合俯瞰チェック + CI失敗通知） | 1-1 | [general-purpose] |
| 1-3 | SKILL.md 新規セクション追加（メッセージプレフィックス規約 + broadcastコスト管理 + メッセージスキーマ） | 1-1 | [general-purpose] |
| 1-4 | SKILL.md tmux版との違いテーブル更新 | 1-1, 1-2, 1-3 | [general-purpose] |
| 99-1 | 観点別並列コードレビュー | 1-1〜1-4 | [einja-review-code] |
| 99-G | コミット承認ゲート | 99-1 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

```
Phase 0: 準備
  0-0（TaskCreate）→ 0-1（Planリネーム）

Phase 1: 実装（1-1完了後、1-2と1-3は並列可。1-4は全完了後）
  1-1 → 1-2 ──┐
       → 1-3 ──┼→ 1-4

Phase 99: 検証
  99-1 → 99-G → 99-3
```

※ 全タスクが `.claude/skills/einja-issue-team-exec/SKILL.md` の異なるセクションを編集するが、1ファイルのため並列編集はコンフリクトリスクあり。順次実行が安全。

## リスク・不明点

| リスク | 影響度 | 対策 |
|--------|--------|------|
| broadcastのコンテキスト消費 | 中 | broadcast対象を `[task-claim]` と `[change-summary]` の2種に限定 |
| ピアレビューの品質（形骸化） | 低 | Leadのゲートチェックが最終品質保証。ピアレビューは補完的位置づけ |
| プロンプト長の増大 | 中 | 現行プロンプト約30行、追加約40行（計70行）。Teammateは1Mトークンの独立context windowを持つため余裕あり。簡潔な記述 + セクション参照で間接化 |
| タスクグループ間のファイル重複が少ない場合に効果薄 | 低 | コスト（broadcast 2種 + アイドル時レビュー）も低いためROIは維持 |

### 不明点（実装前に確認不要）
- broadcastのコスト特性の実測値 — 実運用で調整可能なため事前検証不要
- GitHub API rate limit — 通常の使用範囲では問題にならない

## 検証・動作確認方法

1. **静的検証**: SKILL.md の各セクション間の整合性確認
   - DirectorプロンプトのメッセージプレフィックスとLead受信テーブルの整合
   - メッセージプレフィックス規約テーブルの網羅性
   - issue-exec-protocol.md が未変更であることの確認
2. **差分確認**: `git diff --stat` で変更がSKILL.mdのみであることを確認
