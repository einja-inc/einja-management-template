# Claude Code MCP サーバー共有方法の調査レポート

## 調査概要

Claude Codeで複数インスタンス間でMCPサーバーを共有する方法について調査しました。現在のプロジェクトでは7つのMCPサーバー（vibe_kanban, codex, context7, playwright, serena, github, drawio）がすべてstdio/http方式で設定されています。

## 1. Claude Code の `.mcp.json` 設定形式

### サポートされるトランスポートタイプ

Claude Codeは以下の3つのトランスポートタイプをサポートしています：

#### 1.1 HTTP（推奨）

**2026年現在、最も推奨される方式**。Streamable HTTP transportはSSEに代わる新標準です。

**設定例：**
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

**CLI経由の追加：**
```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

#### 1.2 SSE（非推奨だが現在も動作）

**注意：** SSEトランスポートは非推奨とされており、HTTPが利用可能な場合はそちらを使用すべきです。

**設定例：**
```json
{
  "mcpServers": {
    "knowledgeforge-rag": {
      "type": "sse",
      "url": "http://localhost:8090/sse"
    }
  }
}
```

**CLI経由の追加：**
```bash
claude mcp add --transport sse asana https://mcp.asana.com/sse
```

#### 1.3 Stdio（ローカル専用）

**ローカルプロセスとして起動**。複数インスタンスで共有不可（各インスタンスが独立したプロセスを起動）。

**設定例：**
```json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```

### 設定スコープ

| スコープ | 保存場所 | 用途 |
|----------|----------|------|
| **local**（デフォルト） | `~/.claude.json` | 個人用・実験的設定 |
| **project** | `.mcp.json`（プロジェクトルート） | **チーム共有**・バージョン管理対象 |
| **user** | `~/.claude.json` | 全プロジェクト共通の個人用設定 |

**重要：** `.mcp.json` をgitにコミットすることで、**チーム全員が同じMCPツールにアクセス可能**になります。ただし、これはstdioサーバーの場合、各メンバーのマシンで個別にプロセスが起動されます。

### 環境変数の展開

`.mcp.json` では環境変数を使用できます：

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

## 2. Stdio→SSE/HTTP変換ツール

### 2.1 Supergateway（推奨）

**機能：** Stdio MCPサーバーをSSE/WebSocket/HTTPとして公開、または逆変換も可能。

**インストール：**
```bash
npx -y supergateway --stdio "uvx mcp-server-git"
```

**Stdioサーバーをネットワーク公開：**
```bash
# Playwrightサーバーをポート8000でSSE公開
npx -y supergateway --port 8000 \
  --stdio "npx -y @playwright/mcp --isolated"

# アクセスURL: http://localhost:8000/sse
```

**リモートSSEサーバーをローカルstdioとして利用：**
```bash
npx -y supergateway --sse "https://mcp-server-example.app"
```

**Claude Desktop連携（リモートサーバーをローカルstdioとして使用）：**
```json
{
  "mcpServers": {
    "remoteServer": {
      "command": "npx",
      "args": ["-y", "supergateway", "--sse", "https://server-url.app"]
    }
  }
}
```

**主要オプション：**
- `--port 8000` - リスニングポート
- `--ssePath /sse` - SSEエンドポイント（デフォルト）
- `--messagePath /message` - メッセージ投稿エンドポイント
- `--cors` - CORS有効化
- `--logLevel info|none` - ログレベル

**Docker対応：**
```bash
docker run -it --rm -p 8000:8000 supercorp/supergateway \
  --stdio "npx -y @modelcontextprotocol/server-filesystem /" \
  --port 8000
```

### 2.2 mcp-proxy

**機能：** Stdio↔SSE/StreamableHTTP双方向変換プロキシ。

**インストール：**
```bash
uv tool install mcp-proxy
# or
pipx install mcp-proxy
```

**リモートSSEサーバーへの接続（stdio→SSEクライアント）：**
```bash
mcp-proxy http://example.io/sse

# 認証ヘッダー付き
mcp-proxy --headers Authorization 'Bearer YOUR_TOKEN' http://example.io/sse
```

**ローカルサーバーをSSE公開（SSE→stdioサーバー）：**
```bash
mcp-proxy --port=8080 uvx mcp-server-fetch
```

**複数の名前付きサーバー：**
```bash
mcp-proxy --port=8080 \
  --named-server fetch 'uvx mcp-server-fetch' \
  --named-server github 'npx @modelcontextprotocol/server-github'

# アクセス: http://localhost:8080/servers/fetch/sse
```

**Claude Desktop設定例：**
```json
{
  "mcpServers": {
    "mcp-proxy": {
      "command": "mcp-proxy",
      "args": ["http://example.io/sse"],
      "env": {
        "API_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

**主要オプション：**
- `--port / --host` - リスニングアドレス
- `--transport {sse|streamablehttp}` - リモート接続プロトコル
- `--headers` - 認証・カスタムヘッダー
- `--env` - 環境変数渡し
- `--allow-origin` - CORS有効化
- `--named-server NAME 'command'` - 複数サーバー管理

### 2.3 ツール比較

| 特徴 | Supergateway | mcp-proxy |
|------|-------------|-----------|
| **Stdio→SSE/HTTP** | ✅ | ✅ |
| **SSE→Stdio** | ✅ | ✅ |
| **複数サーバー管理** | ❌ | ✅（named-server） |
| **インストール** | npx実行のみ | uv/pipx必須 |
| **Docker対応** | ✅ | ✅ |
| **ライセンス** | MIT | 不明 |

## 3. 複数インスタンス間でMCPサーバーを共有する方法

### 方法1: プロジェクトスコープ（`.mcp.json`）- チーム共有

**適用シーン：** チーム全員が同じMCPツールを使用したい場合。

**制限事項：** Stdioサーバーは各メンバーのマシンで**個別にプロセスが起動**されます。真の「共有」ではなく、「設定の共有」です。

**手順：**
```bash
# プロジェクトスコープで追加
claude mcp add --scope project --transport http github \
  https://api.githubcopilot.com/mcp/

# .mcp.json をgitコミット
git add .mcp.json
git commit -m "Add GitHub MCP server"
```

**`.mcp.json` 例：**
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 方法2: Supergatewayで中央集約サーバー化（真の共有）

**適用シーン：** 複数のClaude Codeインスタンス（異なるマシン・ユーザー）が**同一のMCPサーバープロセス**を共有したい場合。

**メリット：**
- サーバープロセスは1つだけ（リソース効率的）
- 状態の共有（例：セッション情報、キャッシュ）
- 中央でのログ・監査・RBAC管理

**構成例：**

#### 3.1 中央サーバー設定（例：jumpbox / 専用サーバー）

**Serenaサーバーを中央で起動：**
```bash
# ポート8001でSerenaを公開
npx -y supergateway --port 8001 \
  --stdio "uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --open-web-dashboard false"
```

**Codexサーバーを中央で起動：**
```bash
# ポート8002でCodexを公開
npx -y supergateway --port 8002 \
  --stdio "codex mcp-server"
```

**Playwrightサーバーを中央で起動：**
```bash
# ポート8003でPlaywrightを公開
npx -y supergateway --port 8003 \
  --stdio "npx -y @playwright/mcp --isolated"
```

#### 3.2 各クライアント（Claude Codeインスタンス）の設定

**`.mcp.json` で中央サーバーに接続：**
```json
{
  "mcpServers": {
    "serena": {
      "type": "sse",
      "url": "http://central-server:8001/sse"
    },
    "codex": {
      "type": "sse",
      "url": "http://central-server:8002/sse"
    },
    "playwright": {
      "type": "sse",
      "url": "http://central-server:8003/sse"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

**または、mcp-proxyで複数サーバーを1ポートに集約：**

中央サーバーで：
```bash
mcp-proxy --port=8000 \
  --named-server serena 'uvx --from git+https://github.com/oraios/serena serena start-mcp-server' \
  --named-server codex 'codex mcp-server' \
  --named-server playwright 'npx -y @playwright/mcp --isolated'
```

クライアント側：
```json
{
  "mcpServers": {
    "serena": {
      "type": "sse",
      "url": "http://central-server:8000/servers/serena/sse"
    },
    "codex": {
      "type": "sse",
      "url": "http://central-server:8000/servers/codex/sse"
    },
    "playwright": {
      "type": "sse",
      "url": "http://central-server:8000/servers/playwright/sse"
    }
  }
}
```

### 方法3: AWS/クラウドデプロイ（エンタープライズ）

**適用シーン：** 大規模組織での標準化・RBAC・監査要件がある場合。

AWSが公式に「Guidance for Deploying Model Context Protocol Servers on AWS」を提供しています。

**特徴：**
- 複数MCPサーバーが共通インフラ（VPC、NAT Gateway、ALB）を共有
- 中央集約的なログ・監査・RBAC
- カーボン効率の向上（リソース共有）

**参考：** [AWS MCP Server Guidance](https://aws.amazon.com/solutions/guidance/deploying-model-context-protocol-servers-on-aws/)

### 方法4: Claude.aiアカウント連携（自動共有）

**適用シーン：** Claude.aiのTeam/Enterpriseプランを使用している場合。

**手順：**
1. [claude.ai/settings/connectors](https://claude.ai/settings/connectors) でMCPサーバーを追加（管理者のみ）
2. Claude Codeでログインすると、自動的にClaude.aiのMCPサーバーが利用可能

**メリット：**
- 設定ファイル不要
- チーム全体で自動共有
- OAuth認証統合

## 4. 現在のプロジェクト設定の分析

### 現状の `.mcp.json`

```json
{
  "mcpServers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    },
    "codex": {
      "type": "stdio",
      "command": "codex",
      "args": ["mcp-server"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp", "--isolated"]
    },
    "serena": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "--from", "git+https://github.com/oraios/serena",
        "serena", "start-mcp-server",
        "--context", "claude-code",
        "--open-web-dashboard", "false"
      ]
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "drawio": {
      "command": "npx",
      "args": ["-y", "@drawio/mcp@latest"]
    }
  }
}
```

### 問題点

| サーバー | 現状 | 問題 |
|---------|------|------|
| **vibe_kanban** | stdio | 各Claude Codeインスタンスで個別プロセス起動 |
| **codex** | stdio | 同上 |
| **context7** | stdio | 同上 |
| **playwright** | stdio（isolated） | 同上 + isolatedモードで独立ブラウザインスタンス |
| **serena** | stdio | 同上 + LSPサーバー起動（重い） |
| **github** | http（リモート） | ✅ すでに共有可能 |
| **drawio** | stdio | 各インスタンスで個別プロセス起動 |

**結論：** GitHub以外はすべてstdioで、複数インスタンス起動時に**リソースが重複消費**されます。

## 5. 推奨される改善策

### オプションA: 中央Supergatewayサーバー（jumpbox）

**手順：**

1. **中央サーバーで各MCPサーバーを起動：**

```bash
# serena (port 8001)
npx -y supergateway --port 8001 --cors \
  --stdio "uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --open-web-dashboard false" &

# codex (port 8002)
npx -y supergateway --port 8002 --cors \
  --stdio "codex mcp-server" &

# playwright (port 8003)
npx -y supergateway --port 8003 --cors \
  --stdio "npx -y @playwright/mcp --isolated" &

# vibe_kanban (port 8004)
npx -y supergateway --port 8004 --cors \
  --stdio "npx -y vibe-kanban@latest --mcp" &

# context7 (port 8005)
npx -y supergateway --port 8005 --cors \
  --stdio "npx -y @upstash/context7-mcp" &

# drawio (port 8006)
npx -y supergateway --port 8006 --cors \
  --stdio "npx -y @drawio/mcp@latest" &
```

2. **`.mcp.json` を更新：**

```json
{
  "mcpServers": {
    "serena": {
      "type": "sse",
      "url": "http://jumpbox.internal:8001/sse"
    },
    "codex": {
      "type": "sse",
      "url": "http://jumpbox.internal:8002/sse"
    },
    "playwright": {
      "type": "sse",
      "url": "http://jumpbox.internal:8003/sse"
    },
    "vibe_kanban": {
      "type": "sse",
      "url": "http://jumpbox.internal:8004/sse"
    },
    "context7": {
      "type": "sse",
      "url": "http://jumpbox.internal:8005/sse"
    },
    "drawio": {
      "type": "sse",
      "url": "http://jumpbox.internal:8006/sse"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

### オプションB: mcp-proxyで統合（1ポートに集約）

**中央サーバーで：**
```bash
mcp-proxy --port=8000 --allow-origin '*' \
  --named-server serena 'uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code' \
  --named-server codex 'codex mcp-server' \
  --named-server playwright 'npx -y @playwright/mcp --isolated' \
  --named-server vibe_kanban 'npx -y vibe-kanban@latest --mcp' \
  --named-server context7 'npx -y @upstash/context7-mcp' \
  --named-server drawio 'npx -y @drawio/mcp@latest'
```

**`.mcp.json`：**
```json
{
  "mcpServers": {
    "serena": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/serena/sse"
    },
    "codex": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/codex/sse"
    },
    "playwright": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/playwright/sse"
    },
    "vibe_kanban": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/vibe_kanban/sse"
    },
    "context7": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/context7/sse"
    },
    "drawio": {
      "type": "sse",
      "url": "http://jumpbox.internal:8000/servers/drawio/sse"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

### オプションC: ハイブリッド（軽量stdioは維持、重いサーバーのみ中央化）

**軽量なサーバーはstdioのまま維持：**
- vibe_kanban（軽量）
- context7（軽量）
- drawio（軽量）
- github（すでにリモート）

**重いサーバーのみ中央化：**
- serena（LSPサーバー、重い）
- codex（重い可能性）
- playwright（ブラウザインスタンス、リソース消費大）

**`.mcp.json`：**
```json
{
  "mcpServers": {
    "serena": {
      "type": "sse",
      "url": "http://jumpbox.internal:8001/sse"
    },
    "codex": {
      "type": "sse",
      "url": "http://jumpbox.internal:8002/sse"
    },
    "playwright": {
      "type": "sse",
      "url": "http://jumpbox.internal:8003/sse"
    },
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "drawio": {
      "command": "npx",
      "args": ["-y", "@drawio/mcp@latest"]
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

## 6. セキュリティ・運用上の考慮事項

### 認証・認可

- **SSEサーバーは認証なし**の場合、アクセス可能な全員がMCPツールを使用可能
- Supergatewayは`--cors`オプションでアクセス制御が必要
- mcp-proxyは`--headers`でBearerトークン等を設定可能
- 本番環境では**VPN・ファイアウォール・リバースプロキシ**での保護を推奨

### ログ・監査

- Supergateway: `--logLevel info|none` でログ制御
- mcp-proxy: 標準出力にログ出力
- 中央サーバーのログを監視することで、全チームの操作を追跡可能

### 可用性

- 中央サーバーがSPOF（単一障害点）になる
- Docker + systemd / supervisord等でプロセス管理を推奨
- ヘルスチェックエンドポイント（`--healthEndpoint`）の活用

### パフォーマンス

- ネットワークレイテンシが追加される（特にSerenaのLSP操作）
- Playwrightは`--isolated`モードで独立ブラウザが必要な場合、中央化のメリットは限定的
- リソース競合（複数ユーザーが同時にPlaywrightブラウザを使用）を考慮

## 7. まとめと次のステップ

### 結論

1. **Claude Codeは `.mcp.json` でstdio, SSE, HTTPの3タイプをサポート**
2. **SSEは非推奨**だが、stdio→SSE変換の用途では現在も実用的
3. **Supergateway（npxのみ）とmcp-proxy（uv/pipx）が主要な変換ツール**
4. **真の共有（プロセス共有）には中央サーバー化が必要**
5. **現在のプロジェクトは6/7サーバーがstdio**で、複数インスタンス起動時にリソース重複

### 推奨アクションプラン

| 優先度 | アクション | 内容 |
|--------|------------|------|
| 🔴 高 | **重量級サーバーの中央化** | Serena, Codex, Playwrightを中央サーバー（Supergateway）で公開 |
| 🟡 中 | **`.mcp.json` の更新** | SSE URLを設定し、プロジェクトスコープで共有 |
| 🟢 低 | **軽量サーバーの評価** | vibe_kanban, context7, drawioも中央化するか、stdioのまま維持するか判断 |
| 🔵 将来 | **エンタープライズ対応** | Claude.aiアカウント連携 or AWS Guidanceに基づくクラウドデプロイ |

### 参考リンク

- [Claude Code MCP公式ドキュメント](https://code.claude.com/docs/en/mcp)
- [Supergateway GitHub](https://github.com/goodatlas/mcp-supergateway)
- [mcp-proxy GitHub](https://github.com/sparfenyuk/mcp-proxy)
- [MCP仕様（Architecture）](https://modelcontextprotocol.io/specification/2025-06-18/architecture/index)
- [AWS MCP Server Guidance](https://aws.amazon.com/solutions/guidance/deploying-model-context-protocol-servers-on-aws/)

---

**調査完了日**: 2026-02-27
**調査者**: Claude Code Explore Agent
