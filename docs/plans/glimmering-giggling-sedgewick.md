# Plan: Plan mode進入時にeinja-skill-firstを自動リマインドするhook

## Context

現在、`einja-skill-first` SkillはCLAUDE.mdの指示に基づいて親エージェントが手動で呼び出す運用になっている。しかし強制力がなく、忘れる可能性がある。

`UserPromptSubmit` hookを使い、Plan mode中のプロンプト送信時に**軽量リマインダー**を自動注入することで、確実にeinja-skill-first評価が実行される仕組みを作る。

**なぜ `UserPromptSubmit` か:**
- `PreToolUse(EnterPlanMode)` はLLMが呼ぶ場合のみ発火し、**Shift+Tab**での手動Plan mode進入をカバーできない
- `UserPromptSubmit` は `permission_mode` フィールドを受け取れるため、Plan mode中の全プロンプト送信を確実に検出可能

**なぜ軽量リマインダー方式か:**
- SKILL.md全文（240行）を注入するとコンテキストを圧迫する
- 短い指示（2-3行）なら毎回注入しても低コスト → **状態管理（フラグファイル等）が不要**
- LLMが自分でSKILL.mdを読みに行くので、Compaction後も再読み込み可能

## 実装内容

### 1. hookスクリプト作成

**ファイル**: `.claude/hooks/einja/plan-mode-skill-loader.sh`

```bash
#!/bin/bash
# plan-mode-skill-loader.sh - Plan mode中にeinja-skill-firstのリマインダーを注入
#
# UserPromptSubmit hookとして設定
# permission_mode == "plan" の場合に、軽量リマインダーをadditionalContextとして注入
# 毎回注入しても2-3行なのでコスト無視可能。状態管理不要。

set -uo pipefail

input=$(cat)

# permission_modeを取得
permission_mode=$(echo "$input" | jq -r '.permission_mode // empty')

# Plan mode以外はスキップ
if [[ "$permission_mode" != "plan" ]]; then
  exit 0
fi

# 軽量リマインダーを注入
jq -n '{
  "additionalContext": "【Plan mode自動リマインダー】計画作成前にeinja-skill-firstの評価を実施してください。.claude/skills/einja-skill-first/SKILL.mdを参照し、スキップ基準に該当しない場合はSkill作成の必要性を評価してください。スキップ基準（単発の小規模修正、既存キーワードトリガー一致、具体的かつ限定的な作業指示、1回限りの作業）に該当する場合は省略可。"
}'
```

### 2. settings.json にhookを追加

**ファイル**: `.claude/settings.json`

`hooks` セクションに `UserPromptSubmit` を追加:

```json
"UserPromptSubmit": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/einja/plan-mode-skill-loader.sh",
        "timeout": 5000
      }
    ]
  }
]
```

※ `UserPromptSubmit` はmatcherをサポートしない（全プロンプトで発火）。スクリプト内で `permission_mode` をチェックして制御する。

### 3. CLAUDE.md のskill-first関連記述を更新

**ファイル**: `CLAUDE.md`

現在の必須フロー Step3 の記述を更新:

**変更前:**
```
3. `einja-skill-first` で「Skill を先に作るべきか」を自動評価する
```

**変更後:**
```
3. `einja-skill-first` で「Skill を先に作るべきか」を評価する
   - Plan mode中は `UserPromptSubmit` hookにより自動でリマインダーが注入される
   - `.claude/skills/einja-skill-first/SKILL.md` を読み込んで評価を実施する
```

手動キーワードトリガー（「Skill作るべき？」等）はそのまま維持。

## 変更対象ファイル

| ファイル | 操作 |
|---------|------|
| `.claude/hooks/einja/plan-mode-skill-loader.sh` | **新規作成** |
| `.claude/settings.json` | **編集** - `UserPromptSubmit` hook追加 |
| `CLAUDE.md` | **編集** - skill-first記述を更新（任意） |

## 検証方法

1. **スクリプト単体テスト**:
   ```bash
   # Plan modeの場合 → additionalContext出力
   echo '{"permission_mode":"plan","session_id":"test123"}' | \
     CLAUDE_PROJECT_DIR="$(pwd)" \
     bash .claude/hooks/einja/plan-mode-skill-loader.sh

   # 通常modeの場合 → 何も出力しない
   echo '{"permission_mode":"default","session_id":"test123"}' | \
     CLAUDE_PROJECT_DIR="$(pwd)" \
     bash .claude/hooks/einja/plan-mode-skill-loader.sh
   ```

2. **実動作テスト**:
   - Shift+TabでPlan modeに入りプロンプトを送信
   - リマインダーが注入され、skill-first評価が促されることを確認

3. **通常mode非発火テスト**:
   - Plan mode以外でプロンプト送信した際に何も注入されないことを確認

## 注意事項

- `.claude/` 配下の変更は `presets/default/` にビルド時に自動コピーされる
- `additionalContext` はCompaction対象だが、毎回再注入されるため消失しても問題ない
- hookのタイムアウトは5秒（jqの実行のみなので十分余裕あり）
