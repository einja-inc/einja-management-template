---
paths:
  - "packages/cli/**"
  - "packages/create-einja-app/**"
  - "packages/cli/presets/**"
  - ".claude/agents/einja/**"
  - ".claude/commands/einja/**"
  - ".claude/hooks/einja/**"
  - ".claude/skills/einja-*/**"
  - ".claude/skills/_einja-*/**"
  - ".claude/settings.json"
  - ".vscode/settings.json"
  - "docs/einja/**"
  - "scripts/**"
  - "package.json"
  - "AGENTS.md"
  - ".mcp.json"
  - ".envrc"
---

CLI関連ファイルを編集する前に `.claude/skills/cli-package-specs/SKILL.md` を読み込むこと。
このファイルはビルド時に `presets/default/` へコピー/変換される原本であり、二重管理禁止ルールが適用される。
