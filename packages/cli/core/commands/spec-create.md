---
name: spec-create
description: タスクの仕様書（requirements.md、design.md、tasks.md）を段階的に作成・修正するワークフローを実行します。
model: sonnet
color: pink
---

# 仕様書作成ワークフロー

このコマンドは、ATDD（受け入れテスト駆動開発）に基づいた仕様書を段階的に作成します。

## ワークフロー

### Phase 1: 要件定義
spec-requirements-generatorエージェントを使用してrequirements.mdを作成

### Phase 2: 設計
spec-design-generatorエージェントを使用してdesign.mdを作成

### Phase 3: タスク分解
spec-tasks-generatorエージェントを使用してGitHub Issueにタスク一覧を記述

## 使用方法

```
/spec-create [タスク説明] [既存仕様書パス（オプション）]
```

## 実行フロー

1. ユーザーからタスク説明を受け取る
2. 既存仕様書があれば読み込み
3. 各フェーズを順次実行
4. 各フェーズ完了後にユーザー確認
5. 全フェーズ完了後にサマリーを表示
