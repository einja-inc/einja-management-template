# ブランチ運用戦略

## 概要

このドキュメントでは、タスク実行時のブランチ運用戦略を定義します。

## ブランチ階層構造

```
{default_branch} (リモートのデフォルトブランチ)
  └─ feat/{ディレクトリ}/{タスク名} (タスクファイルごとのブランチ)
       ├─ feat/{ディレクトリ}/{タスク名}/phase1 (フェーズ1ブランチ)
       ├─ feat/{ディレクトリ}/{タスク名}/phase2 (フェーズ2ブランチ)
       └─ feat/{ディレクトリ}/{タスク名}/phase3 (フェーズ3ブランチ)
```

**デフォルトブランチの取得**:
```bash
# リモートのデフォルトブランチを取得
git remote show origin | grep 'HEAD branch' | awk '{print $NF}'
```

## ブランチ命名規則

### 1. タスクファイルごとのブランチ

**命名規則**: `feat/{ディレクトリ}/{タスク名}`

**例**:
- `feat/monorepo/turborepo-setup`
- `feat/auth/magic-link-auth`
- `feat/user/profile-management`

**作成元**: リモートのデフォルトブランチ（`git remote show origin`で取得）

**目的**:
- タスクファイル全体の作業を統合する親ブランチ
- すべてのフェーズブランチはこのブランチから派生

### 2. フェーズごとのブランチ

**命名規則**: `feat/{ディレクトリ}/{タスク名}/phase{N}`

**例**:
- `feat/monorepo/turborepo-setup/phase1`
- `feat/auth/magic-link-auth/phase2`
- `feat/user/profile-management/phase1`

**作成元**: タスクファイルごとのブランチ

**目的**:
- フェーズ単位での作業を分離
- Vibe-Kanbanタスクの実行ベースブランチとして使用
- フェーズ完了後、親ブランチにマージ

## ブランチ作成フロー

### 1. 初回実行時

```bash
# 0. デフォルトブランチを取得
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')

# 1. タスクファイルごとのブランチを作成（デフォルトブランチから）
git checkout $DEFAULT_BRANCH
git pull origin $DEFAULT_BRANCH
git checkout -b feat/monorepo/turborepo-setup

# 2. フェーズ1ブランチを作成（タスクブランチから）
git checkout -b feat/monorepo/turborepo-setup/phase1

# 3. リモートにプッシュ
git push -u origin feat/monorepo/turborepo-setup/phase1
```

### 2. 次のフェーズへ移行時

```bash
# 1. 親ブランチに戻る
git checkout feat/monorepo/turborepo-setup

# 2. 前フェーズの完了内容をマージ
git merge feat/monorepo/turborepo-setup/phase1

# 3. 次のフェーズブランチを作成
git checkout -b feat/monorepo/turborepo-setup/phase2

# 4. リモートにプッシュ
git push -u origin feat/monorepo/turborepo-setup/phase2
```

### 3. 全フェーズ完了後

```bash
# 0. デフォルトブランチを取得
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')

# 1. タスクブランチに最終フェーズをマージ
git checkout feat/monorepo/turborepo-setup
git merge feat/monorepo/turborepo-setup/phase3

# 2. デフォルトブランチにPRを作成
gh pr create --base $DEFAULT_BRANCH --head feat/monorepo/turborepo-setup \
  --title "feat: Monorepo Turborepoセットアップ完了" \
  --body "全フェーズ完了。Phase 1-3の統合PR。"
```

## Vibe-Kanbanタスク実行時のブランチ運用

### ベースブランチの決定

Vibe-Kanbanでタスクを実行する際、**フェーズごとのブランチ**をベースブランチとして使用します。

**例**:
- Phase 1のタスク → `feat/monorepo/turborepo-setup/phase1`
- Phase 2のタスク → `feat/monorepo/turborepo-setup/phase2`

### 自動ブランチ作成ルール

`/task-vibe-kanban-loop` コマンドは以下のルールでブランチを自動作成します：

1. **タスクファイルパスからディレクトリとタスク名を抽出**
   - 例: `docs/specs/tasks/monorepo/20251104-turborepo-setup/tasks.md`
   - ディレクトリ: `monorepo`
   - タスク名: `turborepo-setup`

2. **タスクファイルごとのブランチを確認**
   - ブランチ名: `feat/monorepo/turborepo-setup`
   - 存在しない場合 → リモートのデフォルトブランチから作成

3. **フェーズブランチを確認**
   - ブランチ名: `feat/monorepo/turborepo-setup/phase1`
   - 存在しない場合 → タスクブランチから作成

4. **フェーズブランチをベースブランチとして使用**
   - Vibe-Kanbanタスクの実行時に指定

## ブランチマージ戦略

### フェーズ完了時

```bash
# フェーズブランチを親ブランチにマージ
git checkout feat/monorepo/turborepo-setup
git merge --no-ff feat/monorepo/turborepo-setup/phase1
git push origin feat/monorepo/turborepo-setup
```

### タスク完了時

```bash
# デフォルトブランチを取得
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')

# タスクブランチをデフォルトブランチにPRとしてマージ
gh pr create --base $DEFAULT_BRANCH --head feat/monorepo/turborepo-setup \
  --title "feat: Monorepo Turborepoセットアップ" \
  --body "..."
```

## ブランチ削除ポリシー

### フェーズブランチ

- 親ブランチにマージ後、削除可能
- ただし、トレーサビリティのため残しておくことを推奨

### タスクブランチ

- デフォルトブランチにマージ後、PRクローズと同時に削除

## ブランチ命名例

| タスクファイルパス | タスクブランチ | Phase 1ブランチ | Phase 2ブランチ |
|------------------|---------------|----------------|----------------|
| `docs/specs/tasks/monorepo/20251104-turborepo-setup/tasks.md` | `feat/monorepo/turborepo-setup` | `feat/monorepo/turborepo-setup/phase1` | `feat/monorepo/turborepo-setup/phase2` |
| `docs/specs/tasks/auth/20251105-magic-link/tasks.md` | `feat/auth/magic-link` | `feat/auth/magic-link/phase1` | `feat/auth/magic-link/phase2` |
| `docs/specs/tasks/user/20251106-profile/tasks.md` | `feat/user/profile` | `feat/user/profile/phase1` | `feat/user/profile/phase2` |

## 注意事項

1. **ブランチ名の一貫性**: すべてのブランチは命名規則に従うこと
2. **フェーズ番号の明示**: フェーズ番号は必ず数字で明示（phase1, phase2, ...）
3. **親ブランチの更新**: フェーズ完了時は必ず親ブランチにマージすること
4. **リモート同期**: ブランチ作成後は必ずリモートにプッシュすること

## トラブルシューティング

### ブランチが存在しない場合

```bash
# リモートから最新情報を取得
git fetch origin

# ブランチ一覧を確認
git branch -a
```

### ブランチ名を間違えた場合

```bash
# ブランチ名を変更
git branch -m 旧ブランチ名 新ブランチ名

# リモートのブランチ名も更新
git push origin :旧ブランチ名 新ブランチ名
git push origin -u 新ブランチ名
```

### マージコンフリクト発生時

```bash
# コンフリクトを解決後、マージを完了
git add .
git commit -m "Merge phase1 into task branch"
git push origin タスクブランチ名
```
