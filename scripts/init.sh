#!/bin/bash
#
# init.sh - 初回セットアップ（mise/Node/pnpm導入）
#
# 使い方:
#   ./scripts/init.sh
#
# ※ 初回のみ実行。2回目以降は不要です。
#

set -e

# 色定義
BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
GRAY='\033[90m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_step() { echo -e "\n${BLUE}Step $1:${NC} $2"; }

# スクリプトのディレクトリに移動
cd "$(dirname "$0")/.."

echo -e "${BLUE}"
echo "=========================================="
echo "  初回セットアップ"
echo "=========================================="
echo -e "${NC}"

# Step 1: miseの確認とインストール
log_step 1 "miseのインストール..."

if ! command -v mise &> /dev/null; then
    curl -fsSL https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
    log_success "miseをインストールしました"
else
    log_success "miseは既にインストール済み"
fi

# mise PATHを設定
export PATH="$HOME/.local/bin:$PATH"

# Step 2: シェル設定
log_step 2 "シェル設定..."

SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash) RC_FILE="$HOME/.bashrc" ;;
    *)    RC_FILE="" ;;
esac

if [ -n "$RC_FILE" ] && ! grep -q "mise activate" "$RC_FILE" 2>/dev/null; then
    echo -e "\n# mise\neval \"\$(mise activate $SHELL_NAME)\"" >> "$RC_FILE"
    log_success "シェル設定を追加しました"
else
    log_success "シェル設定は既に完了"
fi

# Step 3: Node.js/pnpmインストール
log_step 3 "Node.js/pnpmのインストール..."

mise trust
mise install
log_success "mise.tomlに基づきNode.js/pnpmをインストールしました"

# Step 4: direnv allow（direnvが利用可能な場合）
log_step 4 "direnv設定..."

if command -v direnv &> /dev/null; then
    direnv allow
    log_success "direnv allow を実行しました"
else
    log_warn "direnvが見つかりません（スキップ）"
    echo -e "  ${GRAY}direnvインストール後に 'direnv allow' を実行してください${NC}"
fi

# 完了
echo ""
echo -e "${GREEN}=========================================="
echo -e "✅ 初回セットアップ完了！"
echo -e "==========================================${NC}"
echo ""
echo "次のステップ:"
echo -e "  1. ターミナルを再起動: ${BLUE}exec \$SHELL${NC}"
echo -e "  2. 依存関係インストール: ${BLUE}pnpm install${NC}"
echo -e "  3. 環境セットアップ:  ${BLUE}pnpm dev:setup${NC}"
echo ""
