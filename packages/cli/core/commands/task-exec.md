---
name: task-exec
description: GitHub Issueから着手可能なタスクグループを自動選定し、実行から完了まで一連のプロセスを管理するコマンド。
model: sonnet
color: blue
---

# タスク実行ワークフロー

このコマンドは、GitHub Issueのタスクを自動的に選定・実行・レビュー・完了処理を行います。

## ワークフロー

```
task-starter → task-executer → task-reviewer → task-qa → task-finisher
                    ↑                              |
                    └──────── (失敗時差し戻し) ─────┘
```

## 各フェーズ

### 1. タスク選定 (task-starter)
- 依存関係を考慮してタスクを選定
- 並列実行可能なタスクをグループ化

### 2. 実装 (task-executer)
- 要件・設計に基づいた実装
- テストコードの作成

### 3. レビュー (task-reviewer)
- 設計との整合性確認
- コード品質チェック

### 4. QA (task-qa)
- ビルド・テスト実行
- 受け入れ条件の検証

### 5. 完了処理 (task-finisher)
- GitHub Issue更新
- 次タスクへの引き継ぎ

## 使用方法

```
/task-exec [Issue番号] [タスクグループ番号（オプション）]
```

## 品質保証ループ

- レビューまたはQAで問題が発見された場合、task-executerに差し戻し
- 問題が解決するまでループ
