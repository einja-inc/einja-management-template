# Plan: issue-exec の tmux 自動インストール機能追加

## Context

`issue-exec` コマンドは tmux を必須依存としているが、現在 Step 0 で `which tmux` による確認のみで、未インストール時のフォールバックがない。tmux が入っていないとコマンドが即座に失敗するため、UX として自動インストールを提案・実行できるようにする。

## 変更対象

| ファイル | 変更内容 |
|---------|---------|
| `.claude/commands/einja/issue-exec.md` | Step 0 の tmux 確認ロジックを拡張（`which tmux` → `command -v tmux` + 自動導入フロー） |

## 変更内容: Step 0 を以下に書き換え

```markdown
### Step 0: 環境準備

#### 1. tmux インストール確認・自動導入

1. `command -v tmux` で tmux の存在を確認
2. **インストール済みの場合**: `tmux -V` でバージョン表示し、次のステップへ進む
3. **未インストールの場合**: `uname -s` で OS を判定し、以下のフローで自動導入を提案

**macOS（`uname -s` = `Darwin`）:**
1. `command -v brew` で Homebrew を確認
2. Homebrew あり:
   - AskUserQuestion で「`brew install tmux` を実行してよいか？」確認 → 承認後に実行
3. Homebrew なし:
   - 以下を表示して**停止**:
     > tmux のインストールには Homebrew が必要です。
     > 以下のコマンドで Homebrew をインストール後、再度 issue-exec を実行してください:
     > `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**Linux（`uname -s` = `Linux`）:**
1. パッケージマネージャーを検出（上から優先）:
   - `command -v apt-get` → `apt-get update && apt-get install -y tmux`
   - `command -v dnf` → `dnf install -y tmux`
   - `command -v yum` → `yum install -y tmux`
   - いずれも検出できない場合 → 「対応パッケージマネージャーが見つかりません。手動で tmux をインストールしてください」と表示して**停止**
2. 権限判定とインストール:
   - `id -u` が 0（root）→ sudo 不要。AskUserQuestion で「`<pm> install tmux` を実行してよいか？」確認 → 承認後に実行
   - root でない場合 → `sudo -n true 2>/dev/null` で sudo 権限を確認
     - sudo 可能 → AskUserQuestion で「`sudo <pm> install tmux` を実行してよいか？」確認 → 承認後に実行
     - sudo 不可 → AskUserQuestion で「tmux のインストールには sudo 権限が必要です。パスワード入力が求められる場合があります。`sudo <pm> install tmux` を実行しますか？それとも手動でインストールしますか？」と確認
       - 手動を選択 → インストールコマンドを表示して**停止**

**その他（`MINGW*`, `MSYS*`, `CYGWIN*`, 不明な OS）:**
- 以下を表示して**停止**:
  > issue-exec は tmux を必須としており、この環境では利用できません。
  > WSL2 環境での実行を推奨します。
  > 代替: `/einja:task-exec` で個別タスクグループを逐次実行することは可能です。

**インストール後の検証:**
- `hash -r` で PATH をリフレッシュし、`command -v tmux && tmux -V` で成功確認
- 失敗した場合 → 「tmux のインストールは完了しましたが、PATH に反映されていません。シェルを再起動して再度実行してください」と表示して**停止**

#### 2. ディレクトリ準備
（既存の内容を維持）

#### 3. セッション復元
（既存の内容を維持）
```

## 設計判断

| 判断ポイント | 決定 | 理由 |
|------------|------|------|
| OS 判定方法 | `uname -s` | POSIX 準拠。WSL2 は `Linux` を返すので自動カバー |
| tmux 確認方法 | `command -v`（`which` から変更） | POSIX 準拠。`which` は環境依存が大きい |
| ユーザー確認 | AskUserQuestion 1回に集約 | sudo 状態を含めて1問で完結。UX 改善 |
| Homebrew 未導入時 | 手動案内 + 停止 | curl\|bash は Agent の自動化範囲外。Xcode CLT 等の前提条件が複雑 |
| Linux 権限 | `id -u` + `sudo -n` の2段階 | root 直実行 / sudo 可能 / sudo 不可を正確に判別 |
| Windows ネイティブ | 注意書きレベル（`uname -s` の else 分岐） | Claude Code Agent が PowerShell/CMD で動作するケースは事実上ない |
| リトライ | 廃止（`hash -r` + 再確認のみ） | インストール直後の失敗は PATH 問題。リトライしても解決しない |

## 検証方法

1. `.md` ファイルのフロー整合性を確認（全分岐がエラー停止 or 成功に到達する）
2. macOS 環境で `issue-exec` を起動し、tmux インストール済みでバージョン表示されることを確認
3. `command -v tmux` / `uname -s` / `command -v brew` の出力が想定通りか Bash で確認
