# task-exec: タスク単位並列実行 + TodoWrite進捗管理

## Context

現在の `task-exec` コマンドはタスクグループ（X.Y）全体を1つの `task-executer` に丸投げし、内部で順次実装している。この方式では：
- 依存関係のない独立タスクも直列実行されるため非効率
- task-executerが自分でIssue/spec読み込みを行うため、並列時にN回重複読み込みが発生
- task-executerがIssue構造に依存しており、汎用性が低い

**目的**:
1. task-exec（親）がIssue解析・AC抽出・specパス特定を一括で行い、ハイブリッド方式でタスクごとに渡す
2. TodoWriteで進捗管理しつつ、依存関係に基づいた並列実行を実現
3. task-executerをIssue非依存の汎用実装エージェントにする

**情報渡し方式: ハイブリッド**
- AC（受け入れ基準）→ 親が抽出してpromptに直接埋め込む（小さい・重要・~100トークン/AC）
- 設計（design.md）→ ファイルパス + セクション名のみ渡す（大きい・executerが自分でRead）
- フォールバック: ファイルパスも併記し、executerが追加情報を自由に読める

## 新フロー

```
task-exec（親）
  1. Issueフェッチ → タスクグループ内タスク(X.Y.Z)を解析
  2. spec存在チェック + requirements.mdからAC抽出 + design.mdパス特定
  3. TaskCreate で各タスクを登録（依存関係 + AC + 設計参照パス付き）
  4. 依存関係ベース並列実行ループ:
      - ブロックなしタスク → 並列で task-executer 起動
        （各executerに「AC直接埋込 + 設計パス参照 + タスク指示」を渡す）
      - 完了後、新たにブロック解除されたタスク → 次バッチで並列起動
      - 全タスク完了まで繰り返し
  5. task-reviewer（グループ全体で1回）
  6. task-qa（グループ全体で1回）
  7. einja-task-commit
```

## 変更ファイル

### 1. `.claude/commands/einja/task-exec.md`（主要変更）

#### allowed-tools に追加
- `Skill` ツールを追加（必要時のspec-context-loader呼び出し用）

#### 処理フローの書き換え

##### Step 0: 入力解析（現行通り）
- Issue番号とタスクグループ番号を$ARGUMENTSから解析

##### Step 1: Issueフェッチ + タスク解析（新規）

1. `gh issue view` でIssue本文を取得
2. 指定タスクグループ（X.Y）配下のタスク（X.Y.Z）をパース
3. 各タスクのメタデータを抽出:
   - タスク名
   - 要件（Story番号）
   - 依存関係（なし / X.Y.Z形式）
   - 完了条件
   - 対応設計セクション名
   - シナリオテスト

##### Step 2: spec読み込み + AC抽出（新規 - task-executerから移管）

1. specディレクトリを探索: `docs/specs/issues/*/issue{N}-*/`
2. 存在チェック:
   - 完全なspec → 次へ
   - 部分的spec → エラー終了
   - specなし → general-context-loader Skill呼び出し
3. requirements.mdを読み込み、各タスクのメタデータ（`**要件**: Story X`）に基づいてACを抽出
   - ACはGiven/When/Then形式で小さい（~50-100トークン/AC）ので直接保持
4. design.mdは**パスのみ特定**（内容は読み込まない）
   - 各タスクの`**対応設計**: design.md「セクション名」`からセクション名を記録

##### Step 3: TodoWrite登録（新規）

各タスクを `TaskCreate` で登録:
```
TaskCreate:
  subject: "X.Y.Z タスク名"
  description: |
    ## 受け入れ基準（抽出済み）
    - AC1.2: Given: DBスキーマ定義済 When: マイグレーション実行 Then: テーブル作成
    - AC1.3: Given: アプリ起動 When: DB接続 Then: 正常接続
    ## 設計参照
    {specパス}/design.md → 「3. DB設計」セクション
    ## 完了条件
    DBに接続できること（AC1.2〜AC1.3を満たす）
    ## 参考（追加情報が必要な場合）
    - requirements.md: {specパス}/requirements.md
    - design.md: {specパス}/design.md
  activeForm: "タスクX.Y.Zを実装中"
```

依存関係を `TaskUpdate` の `addBlockedBy` で設定:
- `**依存関係**: 1.1.1` → 対応するTodoタスクIDを `addBlockedBy` に設定
- `**依存関係**: なし` → ブロックなし
- `**依存関係**: 1.1` (タスクグループ依存) → グループ外依存のため事前に完了済みと想定

##### Step 4: 依存関係ベース並列実行ループ（新規）

```
while (未完了タスクが存在):
  1. TaskList で未完了タスクを確認
  2. blockedBy が空かつ pending のタスクを収集
  3. 収集したタスクを TaskUpdate で in_progress に設定
  4. Task ツールで複数の task-executer を並列起動:
     - 各 task-executer のpromptに以下を含める（ハイブリッド方式）:
       a. タスクID + タスク名 + 実装指示（Issueから抽出したサブタスク内容）
       b. AC（受け入れ基準）→ 直接埋め込み（親が抽出済み）
       c. 設計 → design.mdパス + セクション名（executerが自分でRead）
       d. 完了条件
       e. フォールバック用specファイルパス（追加情報が必要な場合）
     - run_in_background: true で非同期起動（2タスク以上の場合）
  5. 各エージェントの完了を待機
  6. 完了したタスクを TaskUpdate で completed に設定
  7. ループ先頭に戻る
```

##### Step 5-7: レビュー・QA・コミット（現行と同様）
- task-reviewer: グループ全体で1回
- task-qa: グループ全体で1回
- einja-task-commit: QA合格後に実行

##### フロー図

```
┌─────────────────────────────────────────────────────────┐
│                    品質保証ループ                        │
│                                                         │
│  Issueパース → specパス特定 → TodoWrite登録            │
│       ↓                                                 │
│  依存関係ベース並列実行:                                │
│       task-executer × N（独立タスク並列）               │
│       ↓ 全タスク完了                                    │
│  task-reviewer → task-qa                                │
│       ↑              │                                  │
│       └──────────────┘                                  │
│          （MAJOR/テスト失敗時は該当タスクのみ再実行）    │
│                                                         │
│  QA合格後 ↓                                             │
│  einja-task-commit Skill                                │
└─────────────────────────────────────────────────────────┘
```

### 2. `.claude/agents/einja/task/task-executer.md`（中規模変更）

#### A. Issue/spec自動読み込み機能の削除

以下を削除:
- `skills:` セクションから `spec-context-loader`, `general-context-loader` を削除
- セクション「1.0 spec 存在チェック」を削除
- セクション「1.2 コンテキスト収集モードの決定」（1.2A, 1.2B, 1.2C）を削除
- spec関連エラー処理を削除

#### B. 入力形式の変更

新しい入力形式をセクション冒頭に追記:

```markdown
## 入力（ハイブリッド方式）

task-exec（親）からpromptで以下の情報を受け取ります:
- **タスクID**: X.Y.Z形式
- **タスク名・実装指示**: Issueから抽出した具体的な作業内容
- **AC（直接埋込）**: Given/When/Then形式の受け入れ基準テキスト（親が抽出済み）
- **設計参照**: design.mdのファイルパス + セクション名（自分でReadする）
- **完了条件**: ACを含む具体的な完了条件
- **フォールバックパス**: requirements.md / design.md のフルパス（追加情報が必要な場合）

ACはpromptに直接含まれるので即座に参照可能。
設計情報は指定されたパス+セクションをRead toolで読み込む。
```

#### C. 実行フローの簡素化

現行のセクション1（コンテキスト収集）を以下に置換:
```markdown
### 1. コンテキスト確認
1.1 promptに埋め込まれたAC（受け入れ基準）を確認
1.2 設計参照パス + セクション名に基づき、design.mdの該当セクションをReadで読み込む
1.3 実装種別に応じたドキュメント参照（現行の1.3と同等）
1.4 既存実装の分析（Serena MCPで関連コード調査 - 現行の1.1と同等）
```

#### D. 並列実行時の注意事項（新規追加）

```markdown
#### 4.0 並列実行モードの注意事項

task-execから個別タスク（X.Y.Z）として呼び出された場合:
- 指定されたタスクのみを実装する（他のタスクには触れない）
- git操作はCLAUDE.mdのサブエージェント安全ルールに従う
- コミットは行わない（task-exec完了後にまとめて実行）
```

#### E. 修正記録パスの調整

```
- **タスクグループ単位実行**: `modifications/task-{X}-{Y}.md`（従来互換）
- **個別タスク実行**: `modifications/task-{X}-{Y}-{Z}.md`
```

## 変更しないファイル

- `task-reviewer.md` - グループ全体レビューは現行通り
- `task-qa.md` - グループ全体QAは現行通り
- `task-management.md` - read-only（マネージドディレクトリ）
- `CLAUDE.md` - git安全ルールは既に十分

## リスクと対策

| リスク | 対策 |
|--------|------|
| 並列task-executerのファイル衝突 | 設計書のセクション分割から変更対象を推定。重複懸念時は直列化 |
| TodoWrite IDと依存関係のマッピング | タスク番号→TodoID のマッピングテーブルを保持 |
| 失敗タスクのリカバリー | 失敗タスクとそれにブロックされるタスクを特定し再実行 |
| AC抽出精度 | ACはGiven/When/Then定型なので抽出は機械的。フォールバックパスも併記 |

## 検証方法

1. **構文確認**: 変更後のtask-exec.md、task-executer.mdをReadで確認
2. **実際のIssueでテスト**: 既存のGitHub Issue（タスクグループ付き）に対して `/einja:task-exec` を実行
3. **TodoWrite動作確認**: TaskList でタスクが正しく登録・依存関係設定されていることを確認
4. **並列実行確認**: 独立タスクが実際に並列dispatchされることを確認
5. **QAループ確認**: 全タスク完了後にreviewer→qaが正常に動作することを確認
