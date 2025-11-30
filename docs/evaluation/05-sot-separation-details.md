# SOT分離戦略 実装計画・詳細設計

## 📋 概要

- **採用戦略**: 戦略4（SOT分離戦略）
- **実装期間**: 3-4週間
- **対応技術スタック**: Next.js/React（初期）、将来的に拡張可能

---

## 1. リポジトリ構成

### 1.1 claude-code-shared（新規作成 - SOT）

**役割**: Claude Code設定のマスターリポジトリ

**ディレクトリ構造**:
```
claude-code-shared/
├── agents/
│   ├── task/                    # 完全汎用（技術スタック非依存）
│   │   ├── task-starter.md
│   │   ├── task-executer.md
│   │   ├── task-reviewer.md
│   │   ├── task-qa.md
│   │   ├── task-finisher.md
│   │   └── task-modification-analyzer.md
│   ├── specs/                   # 完全汎用
│   │   ├── spec-requirements-generator.md
│   │   ├── spec-design-generator.md
│   │   ├── spec-tasks-generator.md
│   │   └── spec-qa-generator.md
│   ├── frontend-architect.md   # Next.js/React特化
│   ├── design-engineer.md      # Panda CSS特化
│   └── frontend-coder.md       # Next.js/React特化
├── commands/
│   ├── task-exec.md            # 汎用
│   ├── spec-create.md          # 汎用
│   ├── frontend-implement.md   # Next.js/React特化
│   ├── update-docs-by-task-specs.md
│   ├── start-dev.md.template   # パラメータ化版
│   ├── sync-cursor-commands.md
│   └── task-vibe-kanban-loop.md
├── settings.json               # MCP設定
├── docs-templates/             # ドキュメントテンプレート
│   ├── CLAUDE.md.template      # プレースホルダー含む
│   ├── coding-standards.mdc
│   ├── component-design.mdc
│   ├── github-workflow.mdc
│   ├── testing.mdc
│   └── code-review.mdc
├── scripts/
│   ├── install.sh              # 初回インストール
│   └── update.sh               # 更新スクリプト
├── README.md                   # SOTとしての使用方法
├── CHANGELOG.md                # バージョン履歴（詳細）
└── VERSION                     # v1.0.0形式
```

### 1.2 einja-management-template（既存 - 参考実装+PoC）

**役割**: Next.js/Reactのベストプラクティス参考実装 + claude-code-shared更新の検証環境

**構造**:
```
einja-management-template/
├── apps/                       # Next.js管理画面アプリ
├── packages/                   # 共有パッケージ
├── .claude/                    # claude-code-sharedからインストール済み
│   ├── agents/                 # 実ファイルコピー
│   ├── commands/
│   └── settings.json
├── docs/                       # Next.js特化のカスタマイズ例
├── CLAUDE.md                   # Next.js特化の指示書
├── scripts/
│   └── update-from-sot.sh      # SOTから最新版を取り込む
├── turbo.json
├── pnpm-workspace.yaml
└── .claude-version.json        # インストール済みバージョン情報
```

---

## 2. スクリプト詳細仕様

### 2.1 install.sh（claude-code-shared/scripts/）

**目的**: 各プロジェクトへの初回インストール

**機能**:
1. インタラクティブプロンプトで設定収集
2. .claude/ディレクトリの実ファイルコピー
3. CLAUDE.mdのプレースホルダー置換
4. docs/へのテンプレートコピー
5. .claude-version.jsonの生成

**実装詳細**:
```bash
#!/bin/bash
set -e

# 1. 設定収集
read -p "プロジェクト名: " PROJECT_NAME
read -p "パッケージマネージャー (pnpm/npm/yarn): " PKG_MANAGER
read -p "モノレポ構成ですか？ (yes/no): " IS_MONOREPO

# 2. 一時ディレクトリでクローン
TEMP_DIR=$(mktemp -d)
git clone https://github.com/org/claude-code-shared.git "$TEMP_DIR"

# 3. .claude/のコピー（実ファイル）
mkdir -p .claude
cp -r "$TEMP_DIR/agents" .claude/
cp -r "$TEMP_DIR/commands" .claude/
cp "$TEMP_DIR/settings.json" .claude/

# 4. CLAUDE.mdのプレースホルダー置換
sed -e "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" \
    -e "s/{{PACKAGE_MANAGER}}/$PKG_MANAGER/g" \
    -e "s/{{IS_MONOREPO}}/$IS_MONOREPO/g" \
    "$TEMP_DIR/docs-templates/CLAUDE.md.template" > CLAUDE.md

# 5. docs/のコピー
mkdir -p docs
cp "$TEMP_DIR/docs-templates/"*.mdc docs/

# 6. バージョン情報保存
cat > .claude-version.json <<EOF
{
  "version": "$(cat $TEMP_DIR/VERSION)",
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project_name": "$PROJECT_NAME",
  "package_manager": "$PKG_MANAGER",
  "is_monorepo": "$IS_MONOREPO"
}
EOF

# 7. クリーンアップ
rm -rf "$TEMP_DIR"

echo "✅ Claude Code設定のインストールが完了しました！"
echo "バージョン: $(jq -r '.version' .claude-version.json)"
```

### 2.2 update.sh（claude-code-shared/scripts/）

**目的**: 既存プロジェクトへの更新配信

**機能**:
1. 現在のバージョンと最新版の比較
2. 更新内容の表示（CHANGELOG.mdから抽出）
3. バックアップ作成
4. コアエージェント・コマンドの更新
5. .claude-version.jsonの更新

**実装詳細**:
```bash
#!/bin/bash
set -e

# 1. バージョン確認
CURRENT_VERSION=$(jq -r '.version' .claude-version.json)
TEMP_DIR=$(mktemp -d)
git clone https://github.com/org/claude-code-shared.git "$TEMP_DIR"
LATEST_VERSION=$(cat "$TEMP_DIR/VERSION")

if [ "$CURRENT_VERSION" == "$LATEST_VERSION" ]; then
  echo "✅ すでに最新バージョンです（$LATEST_VERSION）"
  exit 0
fi

# 2. 更新内容表示
echo "📋 更新内容（$CURRENT_VERSION → $LATEST_VERSION）:"
# CHANGELOG.mdから該当バージョンの変更内容を抽出
sed -n "/## \[$LATEST_VERSION\]/,/## \[/p" "$TEMP_DIR/CHANGELOG.md" | head -n -1

# 3. 確認プロンプト
read -p "更新しますか？ (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "更新をキャンセルしました"
  exit 0
fi

# 4. バックアップ
BACKUP_DIR=".claude-backup-$(date +%Y%m%d-%H%M%S)"
cp -r .claude "$BACKUP_DIR"

# 5. 汎用エージェント・コマンドの更新
cp -r "$TEMP_DIR/agents/task" .claude/agents/
cp -r "$TEMP_DIR/agents/specs" .claude/agents/
cp "$TEMP_DIR/commands/task-exec.md" .claude/commands/
cp "$TEMP_DIR/commands/spec-create.md" .claude/commands/

# 6. バージョン情報更新
jq ".version = \"$LATEST_VERSION\" | .updated_at = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" \
  .claude-version.json > .claude-version.json.tmp
mv .claude-version.json.tmp .claude-version.json

# 7. クリーンアップ
rm -rf "$TEMP_DIR"

echo "✅ 更新完了！"
echo "バックアップ: $BACKUP_DIR"
```

### 2.3 update-from-sot.sh（einja-management-template/scripts/）

**目的**: 検証環境でSOTの最新版を取り込む

**実装詳細**:
```bash
#!/bin/bash
set -e

# claude-code-sharedの最新版を取得
CLAUDE_CODE_SHARED="../claude-code-shared"

if [ ! -d "$CLAUDE_CODE_SHARED" ]; then
  echo "❌ claude-code-sharedが見つかりません"
  echo "パス: $CLAUDE_CODE_SHARED"
  exit 1
fi

# .claude/を実ファイルで上書き
rm -rf .claude
mkdir -p .claude
cp -r "$CLAUDE_CODE_SHARED/agents" .claude/
cp -r "$CLAUDE_CODE_SHARED/commands" .claude/
cp "$CLAUDE_CODE_SHARED/settings.json" .claude/

# バージョン情報更新
cat > .claude-version.json <<EOF
{
  "version": "$(cat $CLAUDE_CODE_SHARED/VERSION)",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "local-sot"
}
EOF

echo "✅ SOTから最新版を取り込みました"
echo "バージョン: $(cat $CLAUDE_CODE_SHARED/VERSION)"
```

---

## 3. バージョン管理戦略（完全性重視）

### 3.1 セマンティックバージョニング

**形式**: `MAJOR.MINOR.PATCH`（例: v1.2.3）

**定義**:
- **MAJOR**: 破壊的変更（エージェント引数の変更、削除など）
- **MINOR**: 後方互換性のある機能追加・改善
- **PATCH**: バグ修正

### 3.2 更新タイプ別のバージョニング

| 更新内容 | バージョン | 例 |
|---------|----------|-----|
| 汎用エージェントのみ更新 | MINOR | v1.1.0 → v1.2.0 |
| 技術スタック特化エージェントのみ更新 | MINOR | v1.1.0 → v1.2.0 |
| 両方更新 | MINOR | v1.1.0 → v1.2.0 |
| エージェント引数変更 | MAJOR | v1.2.0 → v2.0.0 |
| エージェント削除 | MAJOR | v1.2.0 → v2.0.0 |
| バグ修正 | PATCH | v1.2.0 → v1.2.1 |

**重要**: 汎用と特化で**別々のバージョンを持たない**（claude-code-shared全体で単一バージョン）

### 3.3 破壊的変更の判定基準

**以下は必ずMAJOR更新**:
1. エージェントのプロンプト引数変更（既存プロジェクトが動かなくなる）
2. エージェントの削除
3. settings.jsonの構造変更（MCPサーバー名変更など）
4. CLAUDE.md.templateのプレースホルダー変更

**MINOR更新でOK**:
1. 新規エージェント追加
2. エージェント内部ロジック改善（引数は不変）
3. ドキュメントテンプレートの追加・改善

### 3.4 タグ管理とCHANGELOG

**リリースフロー**:
```bash
# 1. VERSIONファイル更新
echo "1.2.0" > VERSION

# 2. CHANGELOG.md更新
cat >> CHANGELOG.md <<EOF
## [1.2.0] - $(date +%Y-%m-%d)
### Added
- task-qaエージェントに受け入れ条件の自動検出機能を追加

### Fixed
- task-executerのバグ修正（#123）

### Changed
- spec-design-generatorの出力形式を改善
EOF

# 3. コミット
git add VERSION CHANGELOG.md
git commit -m "chore: bump version to v1.2.0"

# 4. タグ作成
git tag -a v1.2.0 -m "v1.2.0: task-qa改善とバグ修正"

# 5. プッシュ
git push origin main --tags
```

---

## 4. 開発フロー

### 4.1 新機能開発（claude-code-sharedの更新）

```bash
# 1. claude-code-sharedで新機能開発
cd claude-code-shared
vi agents/task/task-qa.md

# 2. einja-management-templateで検証
cd ../einja-management-template
./scripts/update-from-sot.sh

# 3. Claude Codeで動作確認（本番同様）
claude "/task-exec #123"

# 4. 問題なければSOTにコミット
cd ../claude-code-shared
git add agents/task/task-qa.md
git commit -m "feat(task-qa): 受け入れ条件の自動検出機能を追加"

# 5. バージョンアップとタグ作成（セクション3.4参照）
echo "1.2.0" > VERSION
# ... CHANGELOG.md更新
git add VERSION CHANGELOG.md
git commit -m "chore: bump version to v1.2.0"
git tag -a v1.2.0 -m "v1.2.0: task-qa改善"
git push origin main --tags
```

### 4.2 各プロジェクトへの配信

**推奨タイミング**:
- **即座に更新**: バグ修正（PATCH）
- **計画的に更新**: 機能追加（MINOR） - 1-2週間以内
- **慎重に更新**: 破壊的変更（MAJOR） - 事前テスト必須

**更新コマンド**:
```bash
# 最新版に更新
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/main/scripts/update.sh | bash

# 特定バージョンに更新（タグ指定）
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/v1.2.0/scripts/update.sh | bash
```

**ロールバック**:
```bash
# バックアップから復元
cp -r .claude-backup-20251201-143022/.claude ./

# または特定バージョンに戻す
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/v1.1.0/scripts/update.sh | bash
```

---

## 5. 技術スタック拡張戦略（完全性重視）

### 5.1 将来的な拡張（claude-code-vue等）

**パターン1: 独立リポジトリ方式**
```
claude-code-shared/      # 汎用部分のみ
├── agents/
│   ├── task/            # Next.js/Vueで共通
│   └── specs/           # Next.js/Vueで共通
└── commands/
    ├── task-exec.md
    └── spec-create.md

claude-code-nextjs/      # Next.js/React特化
├── agents/
│   ├── frontend-architect.md
│   ├── design-engineer.md
│   └── frontend-coder.md
└── commands/
    └── frontend-implement.md

claude-code-vue/         # Vue/Nuxt特化（将来）
├── agents/
│   ├── frontend-architect-vue.md
│   └── frontend-coder-vue.md
└── commands/
    └── frontend-implement-vue.md
```

**インストール方法**:
```bash
# 汎用部分
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/main/scripts/install.sh | bash

# Next.js特化（追加インストール）
curl -sSL https://raw.githubusercontent.com/org/claude-code-nextjs/main/scripts/install.sh | bash
```

**パターン2: 統合リポジトリ方式（初期採用）**
```
claude-code-shared/
├── agents/
│   ├── task/                    # 汎用
│   ├── specs/                   # 汎用
│   ├── nextjs/                  # Next.js特化
│   │   ├── frontend-architect.md
│   │   └── frontend-coder.md
│   └── vue/                     # Vue特化（将来）
│       └── frontend-architect.md
└── scripts/
    └── install.sh               # 技術スタック選択機能付き
```

**推奨**: 初期は**パターン2（統合）**、複数スタック対応後に**パターン1（独立）**へ移行

### 5.2 技術スタック選択機能

**install.shの拡張**:
```bash
# 技術スタック選択
echo "対応技術スタック:"
echo "1. Next.js + React"
echo "2. Vue + Nuxt（将来対応）"
read -p "選択してください (1-2): " TECH_STACK

case $TECH_STACK in
  1)
    cp -r "$TEMP_DIR/agents/nextjs/"* .claude/agents/
    ;;
  2)
    cp -r "$TEMP_DIR/agents/vue/"* .claude/agents/
    ;;
esac
```

---

## 6. トラブルシューティング

### 6.1 update.shが失敗する場合

**症状**: `fatal: destination path already exists`

**原因**: 一時ディレクトリのクリーンアップ失敗

**対処**:
```bash
# 一時ディレクトリを手動削除
rm -rf /tmp/tmp.*

# 再実行
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/main/scripts/update.sh | bash
```

### 6.2 バージョン不整合が発生した場合

**症状**: `.claude-version.json`のバージョンと実際のファイルが不一致

**対処**:
```bash
# 強制再インストール
rm -rf .claude .claude-version.json
curl -sSL https://raw.githubusercontent.com/org/claude-code-shared/main/scripts/install.sh | bash
```

### 6.3 カスタマイズ内容が上書きされた場合

**症状**: update.sh実行後、カスタマイズしたエージェントが標準版に戻った

**原因**: update.shは汎用エージェント・コマンドのみ更新するが、誤ってカスタマイズファイルを配置していた

**対処**:
```bash
# バックアップから復元
cp .claude-backup-YYYYMMDD-HHMMSS/.claude/agents/custom-agent.md .claude/agents/

# 推奨: カスタムエージェントは.claude/agents/custom/に配置
mkdir -p .claude/agents/custom
mv .claude/agents/custom-agent.md .claude/agents/custom/
```

---

## 7. 実装スケジュール（3-4週間）

### Week 1: claude-code-sharedリポジトリ作成

**Day 1-2: リポジトリ初期化**
- GitHub新規リポジトリ作成
- 基本ディレクトリ構造作成
- README.md、LICENSE、.gitignoreの作成

**Day 3-4: エージェント・コマンド移行**
- einja-management-templateの.claude/からコピー
- 汎用/特化の分類確認
- settings.jsonの調整

**Day 5: ドキュメントテンプレート作成**
- docs-templates/の整備
- CLAUDE.md.templateのプレースホルダー埋め込み

### Week 2: スクリプト開発

**Day 1-2: install.sh開発**
- インタラクティブプロンプト実装
- プレースホルダー置換ロジック
- エラーハンドリング

**Day 3-4: update.sh開発**
- バージョン比較ロジック
- CHANGELOG.md解析
- バックアップ機能

**Day 5: テスト**
- 複数プロジェクトでの動作確認
- Mac/Linux環境でのテスト

### Week 3: einja-management-template再定義

**Day 1-2: 参考実装+PoC環境として再定義**
- READMEの更新（役割明記）
- update-from-sot.shの作成

**Day 3-4: 検証フロー確立**
- 新機能開発→検証のフロー確認
- ドキュメント整備（開発者向け）

**Day 5: ドキュメント整備**
- claude-code-sharedのREADME詳細化
- einja-management-templateのREADME更新

### Week 4: リリース準備

**Day 1-2: CI/CD構築**
- GitHub ActionsでのValidation
- スクリプトの自動テスト

**Day 3: v1.0.0準備**
- VERSION、CHANGELOG.md作成
- タグ作成

**Day 4-5: 組織内展開**
- 初回リリース
- ドキュメント配布
- 質疑応答対応

---

## 8. 成功指標（KPI）

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| 新規プロジェクトでの採用率 | 90%以上 | 新規プロジェクト数 / claude-code-shared導入数 |
| インストール時間 | 3分以内 | install.sh実行から完了まで |
| 更新適用率 | 80%以上 | 更新リリース後1ヶ月以内の適用プロジェクト数 |
| バージョン管理の活用 | 70%以上 | バージョン指定でのインストール率 |
| トラブル発生率 | 5%未満 | 更新失敗・ロールバック発生率 |

---

## 9. 参考: 削除された03との差分

**03（戦略2）との主な違い**:
1. **リポジトリ構成**: 単一リポジトリ → 2リポジトリ（claude-code-shared + einja-management-template）
2. **検証環境**: シンボリックリンク → 実ファイルコピー（update-from-sot.sh）
3. **配布方法**: git submodule → install.sh/update.sh
4. **バージョン管理**: 未定義 → セマンティックバージョニング（詳細）
5. **技術スタック拡張**: 困難 → 明確な拡張戦略

