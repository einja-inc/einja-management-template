#!/bin/bash
#
# init.sh - 初回セットアップ（Volta/Node/pnpm導入）
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

# Step 1: Voltaの確認とインストール
log_step 1 "Voltaのインストール..."

if ! command -v volta &> /dev/null; then
    curl -fsSL https://get.volta.sh | bash -s -- --skip-setup
    export VOLTA_HOME="$HOME/.volta"
    export PATH="$VOLTA_HOME/bin:$PATH"
    log_success "Voltaをインストールしました"
else
    log_success "Voltaは既にインストール済み"
fi

# Volta PATHを設定
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
export VOLTA_FEATURE_PNPM=1

# Step 2: シェル設定
log_step 2 "シェル設定..."

SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash) RC_FILE="$HOME/.bashrc" ;;
    *)    RC_FILE="" ;;
esac

if [ -n "$RC_FILE" ] && ! grep -q "VOLTA_FEATURE_PNPM" "$RC_FILE" 2>/dev/null; then
    echo -e "\n# Volta - pnpm support\nexport VOLTA_FEATURE_PNPM=1" >> "$RC_FILE"
    log_success "シェル設定を追加しました"
else
    log_success "シェル設定は既に完了"
fi

# Step 3: Node.js/pnpmインストール
log_step 3 "Node.js/pnpmのインストール..."

NODE_VERSION=$(grep -o '"node": *"[^"]*"' package.json | grep -o '[0-9.]*')
PNPM_VERSION=$(grep -o '"pnpm": *"[^"]*"' package.json | grep -o '[0-9.]*')

volta install node@"$NODE_VERSION"
volta install pnpm@"$PNPM_VERSION"
log_success "Node.js $NODE_VERSION, pnpm $PNPM_VERSION をインストールしました"

# Step 4: 依存関係インストール
log_step 4 "依存関係のインストール..."

pnpm install
log_success "依存関係をインストールしました"

# 完了
echo ""
echo -e "${GREEN}=========================================="
echo -e "✅ 初回セットアップ完了！"
echo -e "==========================================${NC}"
echo ""
echo "次のステップ:"
echo -e "  1. ターミナルを再起動: ${BLUE}exec \$SHELL${NC}"
echo -e "  2. 環境セットアップ:  ${BLUE}pnpm dev:setup${NC}"
echo ""
