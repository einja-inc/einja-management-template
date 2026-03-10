# Plan: settings.jsonに`teammateMode: "tmux"`を追加

## Context
Agent Teamsでtmux split panesを強制するために、`.claude/settings.json`に`teammateMode`設定を追加する。

## 変更内容

### `.claude/settings.json`
トップレベルに以下を追加:
```json
"teammateMode": "tmux"
```

`env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`は既に`"1"`で設定済み。

## 検証
- settings.jsonが有効なJSONであることを確認
