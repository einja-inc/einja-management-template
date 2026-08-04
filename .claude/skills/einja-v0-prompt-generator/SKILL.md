---
name: einja-v0-prompt-generator
description: "Generates v0.dev (Vercel v0) prompts for React + Tailwind + shadcn/ui UI mockups through interactive hearing. 機能概要・画面構成・インタラクション・スタイル志向を段階的にヒアリングし、v0公式推奨構造（behavior + visual intent + states + style cues）に沿ったプロンプトを`.md`ファイルに保存する。ユーザーは生成された`.md`の内容をv0.devに手動コピペしてモックを生成する。「v0プロンプト作って」「v0プロンプト生成」「v0モック用のプロンプト」「Vercel v0のプロンプト」「v0.devのプロンプト」等で呼び出す。Do NOT use for: Figmaモックアップ生成（→ ui-design-generator agent）、Pencilデザイン管理（→ einja-pencil-design-manager）、フロントエンド実装本体（→ einja-frontend-implement）、v0.devへの自動投入（本Skillは`.md`生成のみ）"
user-invocable: true
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - TaskCreate
  - TaskUpdate
---

<!-- 参考: https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation -->
<!-- 参考: https://v0.app/docs/design-systems-legacy -->
<!-- 参考: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices -->
<!-- ベース: .claude/skills/einja-project-requirements/SKILL.md (AskUserQuestion 多段ヒアリングパターン) -->
<!-- ベース: .claude/skills/einja-pencil-design-manager/SKILL.md (デザインツール向け先例) -->

# einja-v0-prompt-generator: v0.dev プロンプト生成Skill

## あなたの役割

v0.dev（Vercel v0）向けの高品質プロンプトを対話ヒアリングで組み立て、`.md` ファイルとして保存します。生成物はユーザーが v0.dev に手動コピペして UI モックアップ生成に使用します。**本Skillの責務は「プロンプト生成」と「ファイル保存」のみ**で、v0.dev への自動投入は行いません。

## v0 vs Figma vs Pencil 使い分け早見表

| ツール / Skill | 生成物 | 得意領域 | 呼び出し方 |
|---|---|---|---|
| **v0.dev（本Skill: `einja-v0-prompt-generator`）** | React + Tailwind + shadcn/ui コードモック（v0側で生成） | プロトタイプ即興・実装連結可能なコード出力 | 本Skillで `.md` を生成 → v0.dev に手動投入 |
| **Figma（`ui-design-generator` agent）** | Figma lo-fi ワイヤーフレーム（`ui-design-url.md`） | Issue仕様書と連動した画面設計・レビュー | Issue仕様書作成フロー内で自動呼び出し |
| **Pencil.dev（`einja-pencil-design-manager` Skill）** | `.pen` デザインマスターファイル | デザイントークン統一・共通コンポーネント管理 | `Pencil` `.pen` 等キーワードで自動呼び出し |

**判断基準**:
- 「動くコードとして即興的にモックが欲しい」→ v0（本Skill）
- 「Issue仕様書とセットで画面設計をレビューしたい」→ Figma（ui-design-generator）
- 「プロジェクト共通のデザインシステムを管理したい」→ Pencil

## 前提条件

| 項目 | 内容 |
|------|------|
| v0.dev アカウント | 生成 .md を手動コピペする際に必要 |
| 起動位置 | プロジェクトルート（Step 4 の保存先解決基準、git外でも AskUserQuestion で許可可） |
| 依存 MCP | なし |
| 生成物配置 | `docs/v0-prompts/`（既定） or `.local/v0-prompts/`（機微情報保護時） or 任意パス |

## 重要な原則

1. **推測禁止**: 機能概要・画面構成・スタイル志向はユーザーにしか決められない。AskUserQuestion で必ず確認する
2. **AskUserQuestion 2層記述**: 各選択肢は `description`（What: 何をするか）と `Note:`（So What: 選ぶとどうなるか、メリット/デメリット/注意点）を必ず含める
3. **その他（自由入力）を必ず含める**: どの質問でも `その他（自由入力）` 選択肢を末尾に必ず加える
4. **プロンプト本体は英語**: v0 の学習主体言語は英語のため、生成する v0 Prompt 本文は英語で書く（Skill利用者向けのドキュメント本文・見出しは日本語）
5. **プロジェクト固有デザイントークンは含めない**: v0 デフォルト（shadcn/ui + Tailwind）任せとする
6. **機微情報の混入防止**: Step 3 で軽量な機微情報検出を行い、検出時はユーザーに保存継続可否を確認する

## タスク管理

TaskCreate ツールで進捗を可視化します:
- Step 1〜5 をトップレベルタスクとして登録
- 各ステップ開始時 `in_progress`、完了時 `completed` に更新
- 再ヒアリング分岐時は Step 2b / 3b / 4b を追加
- Step 4 保存先選択・Step 5 最終確認では AskUserQuestion 応答待ち中も現在 Step を `in_progress` のまま維持し、応答受領後に `completed` へ遷移

## 実行手順

### Step 1: 前提確認・初期化

1. Bash で `git rev-parse --show-toplevel` を実行し、リポジトリルートを取得する（失敗（git外）時は AskUserQuestion で「pwd を basedir にする / 中断」を確認）。成功時はそれを basedir として保持し、以降の相対パス解決の基準とする
2. `references/hearing-questions.md` を Read し、Q1〜Q6 の質問セットと分岐ロジックを把握する
3. TaskCreate で Step 2〜5 を一括登録

**注記**: 保存先ディレクトリの作成は Step 4 で保存先が確定してから実施する（ユーザーが D=`.local/` や C=パス指定を選ぶと `docs/v0-prompts/` が空のまま残るため）

### Step 2: 対話ヒアリング（Q1〜Q6）

`references/hearing-questions.md` に定義された質問セットを順に AskUserQuestion で実行し、回答を内部辞書（例: `{ Q1: "...", Q2: "Dashboard", Q3: [...], Q4: [...], Q5: "Modern", Q6: "..." }`）に格納する。

**分岐ロジック**: Q2/Q3/Q4/Q6 のスキップ・分岐挙動の詳細は `references/hearing-questions.md` セクション8「分岐ロジック集約」を参照。

**ユーザーが「その他（自由入力）」を選んだ場合**: 続けて AskUserQuestion で自由入力を受け取り、その内容を回答として保持する。

### Step 3: プロンプト構築

**注記**: 機微情報検出は best-effort であり見逃しあり得る。ユーザーは最終的に生成 .md を目視レビューする責任を持つ。

1. `references/v0-prompt-template.md` を Read し、テンプレート本体を取得する
2. Q1〜Q6 の回答を対応するプレースホルダ（`{Q1}`, `{Q2}`, ...）に単純文字列置換で埋め込む。なお `{feature_name}` は Q1 回答から Title Case で英訳生成（詳細は `references/v0-prompt-template.md` プレースホルダ展開ルール参照）。
3. 未回答（スキップ）セクションは対応する挙動を実施する。
   - Q3=スキップ → `### Layout & Content Areas` を "Use shadcn/ui default layout patterns." に置換
   - Q4=空配列 or I=なし選択 → `### States & Interactions` セクションごと削除
   - Q6=スキップ or 空欄 → `### Additional Requirements` セクションごと削除
   詳細は `references/v0-prompt-template.md` セクション1参照。
4. Q4 の分岐ロジック結果（Responsive / Dark Mode）を該当セクションに追記する
5. **Hearing Summary テーブル**を末尾に組み立てる（Q1〜Q6の回答をそのまま記録、後日改訂時の入力履歴として有用）
6. **機微情報パターン軽量検出**を実施する（Q1〜Q6のすべての回答文字列を対象）

**最小限のエスケープ**: 置換前に以下を適用:
- Hearing Summary テーブル埋め込み値は `|` を `\|` にエスケープ
- コードブロック内埋め込みで入力に `` ``` `` を含む場合、コードブロック区切りをより長い連続バッククォート（4個以上）に変更するか `~~~` フェンスに切り替える

**機微情報検出パターン（正規表現目安、Bash `grep -E` か文字列マッチで判定）:**

| パターン | 例 | 対応 |
|---|---|---|
| APIキー系プレフィックス | `sk-...`, `sk_live_...`, `sk_test_...` | 検出 |
| AWSアクセスキー | `AKIA[0-9A-Z]{16}` | 検出 |
| メールアドレス | `[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}` | 検出 |
| 電話番号（日本形式） | `0\d{1,4}-\d{1,4}-\d{4}` または `\+81-...` | 検出 |
| GitHub PAT | `ghp_[A-Za-z0-9]{36}` / `gho_` / `ghu_` / `ghs_` / `ghr_` | 検出 |
| Slack Token | `xox[baprs]-[A-Za-z0-9-]+` | 検出 |
| JWT | `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | 検出 |
| GCP Service Account | `-----BEGIN PRIVATE KEY-----` または `"type": "service_account"` | 検出 |
| Google API Key | `AIza[0-9A-Za-z_-]{35}` | 検出 |
| Stripe公開/秘匿共通 | `sk_live_` / `pk_live_` / `rk_live_` / `sk_test_` / `pk_test_` | 検出 |

**誤検知抑制**: 例示ドメイン (`example.com`, `example.org`, `test.local`) の email は許可リストとして検出対象外とする。検出は best-effort であり見逃しあり得る旨を Step 3 冒頭にも明記。

**検出タイミング**: プロンプト構築（Step 3-1〜5）完了後、Write 直前に組み立て済み `.md` 文字列全体に対して grep 相当の正規表現マッチを実行する。Bash 経由で検出する場合は一時ファイル（例: `mktemp` 作成）に書き出してから `grep -E` する。

**検出時の対応:**
- 検出内容と該当質問Qを提示して AskUserQuestion で「保存継続 / 該当箇所を伏せ字にして継続 / 中断して再ヒアリング」を選択させる
- **伏せ字を選んだ場合**: 検出箇所を `[REDACTED]` に置換する
- **中断を選んだ場合**: Step 2 に戻り該当Qのみ再ヒアリング

**保存先制約の伝播**: 機微情報検出（伏せ字化含む）があった場合、Step 4 の保存先選択で A（docs/v0-prompts/）と B（カレント）を選択不可（グレーアウトまたは選択肢から除外）とし、C（パス指定）か D（.local/）に強制誘導する。ユーザーが強行 A/B を希望する場合は AskUserQuestion で「本当に git 管理下に機微情報を保存しますか？」の二重確認を必須化。

### Step 4: 保存先確認・書き出し

1. **slug 自動生成**: `{Q2の画面種別（小文字化）}-{Q1由来キーワード（英数ハイフン、最大3語）}` の形式で提案する（例: `dashboard-inventory-analytics`）。Q1 が日本語主体の場合は主要トピックの英訳を試み、不能な場合は `page` などフォールバック値を使用する

   **slug 検証ルール**: 正規表現ホワイトリスト `^[a-z0-9][a-z0-9-]{0,63}$`（先頭英数字、以降英小文字/数字/ハイフン、最大64文字）。上書き入力時に検証し、違反時は AskUserQuestion で再入力を促す（自動変換ではなく意図確認）。
2. AskUserQuestion で slug 確認・上書き受付（デフォルト: 自動生成値、変更希望時は自由入力）
3. AskUserQuestion で**保存先を4択**提示する:

```
質問: "v0 プロンプトファイルの保存先を選択してください"
ヘッダー: "保存先"
選択肢:
  - A: デフォルト（推奨） — docs/v0-prompts/{YYYYMMDD}-{slug}.md
    description: Issue仕様書と同様に docs/ 配下で git 管理する
    Note: 既存 docs/plans パターンと親和的。中間成果物として資産化・チーム共有可。機微情報を含まない一般的なケースに最適
  - B: カレントディレクトリ — ./{slug}-v0-prompt.md
    description: pwd 直下に保存する
    Note: 作業中のworktreeやサブディレクトリで完結させたい場合に選択。git管理対象になる点は注意
  - C: パスを指定 — 自由入力
    description: 任意の絶対/相対パスを入力する
    Note: リポジトリ外に保存したい場合や、機微情報を含むため .gitignore 配下パスを明示指定したい場合に選択
  - D: .gitignore 済みディレクトリ — .local/v0-prompts/{YYYYMMDD}-{slug}.md
    description: .local/ 配下（gitignore対象）に保存する
    Note: 機微情報を含む場合や個人メモとして保持したい場合に推奨。.gitignore に `.local/` が無ければ Bash で自動追記する
  - E: その他（自由入力）
    description: 上記以外の方針を自由記述する
    Note: 特殊な運用（例: 別リポジトリの docs/ に保存、外部共有ストレージへ手動コピー予定 等）を伝えたい場合に使用
```

**パス正規化・許可基準（C/E選択時に必須）:**
- 相対/絶対パスを Bash で `realpath` 相当（macOS では `python3 -c "import os,sys;print(os.path.realpath(sys.argv[1]))" <path>` で代替）で絶対パス化
- 許可 root を判定:
  - A/B/D 選択時 → リポジトリルート（`git rev-parse --show-toplevel`）配下のみ許可
  - C 選択時 → ユーザー同意（AskUserQuestion で「リポジトリ外への保存を許可しますか？」）を得た場合のみ許可
- 正規化後パスが許可 root 配下に含まれるか `startsWith(root + "/")` でチェック
- シンボリックリンクは `readlink -f` (Linux) または上記 Python 相当で解決後に再チェック
- 違反時: AskUserQuestion で「別パス指定 / D=.local/ にフォールバック / 中断」を選択

**処理順序（副作用ロールバック順序）:**
1. パス正規化・許可判定（副作用なし）
2. slug 検証（副作用なし）
3. 同名ファイル存在チェック（副作用なし）
4. Write ツールでの保存（初の副作用）
5. Write 成功後に `.gitignore` 編集（D選択時のみ、Write失敗時はスキップ）
6. `mkdir -p` は Write 直前に必要最小限で実施

4. **保存先パスの決定と準備:**
   - A選択: `docs/v0-prompts/` を `mkdir -p` で作成
   - D選択: 以下の順で処理
     1. `git rev-parse --show-toplevel` でリポジトリルート特定（git外の場合は AskUserQuestion で pwd 使用可否を確認）
     2. `.gitignore` を Read（未存在時は新規作成）
     3. 行単位で `.local/`, `.local`, `/.local/`, `/.local`（trimmed比較）のいずれかが既存かチェック（コメントアウト行 `#` 始まりは除外）
     4. 未存在時、既存末尾が `\n` で終わっていなければ `\n` を先に追記後 `.local/\n` を追記
     5. 書き込み権限エラー時は AskUserQuestion で「別パスに保存 / .gitignore 編集をスキップして .local/ に直接保存」から選択
     6. `mkdir -p .local/v0-prompts` を実行
   - C選択: 指定パスの親ディレクトリを `mkdir -p` で作成
5. **同名ファイル存在チェック**: Bash `ls` またはGlob で確認、存在すればファイル名末尾に `-{HHmmss}` タイムスタンプを付与。秒単位でも衝突した場合は `-{HHmmss}-{counter}` で連番付与する。Bash コマンド例では全パスをダブルクオートで囲むこと（空白・特殊文字対策）。
6. **Write ツールで保存**

### Step 5: 案内・最終確認

1. 保存パスを明示し、先頭40行を Read でプレビュー表示する
2. v0.dev URL（`https://v0.dev`）と手動コピペ手順を案内する（`.md` 内の `## v0 Prompt` ブロックをコピーして v0.dev に貼り付ける旨）
3. 機微情報検出があった場合は再度注意喚起する（「D=.gitignore配下保存を推奨します」等）
4. AskUserQuestion で修正意向を確認する:

```
質問: "生成した v0 プロンプトの修正・再ヒアリングを行いますか？"
ヘッダー: "最終確認"
選択肢:
  - A: 完了（そのまま利用する）
    description: このまま v0.dev に投入する
    Note: Skill終了。追加変更なし
  - B: 再ヒアリング（特定Qのみ修正）
    description: 修正したい質問Qを複数選択で指定し、選択されたQのみ再質問する
    Note: 未選択Qは初回回答を保持。再生成時はファイル名にタイムスタンプ suffix が付与される。最大1回まで（無限ループ防止）
  - C: 手動編集（自分で.mdを直接編集）
    description: 生成された .md を任意のエディタで直接編集する
    Note: Skill終了。ファイルパスを再掲するのでそこから編集可
  - D: その他（自由入力）
    description: 上記以外の対応方針を自由記述する
    Note: 例: 「別Skillに引き継ぐ」「一旦保存して後日再開」等
```

**再ヒアリング（B選択時）仕様:**

- AskUserQuestion で修正対象Q（Q1〜Q6）を**複数選択**（各Qを選択肢として並べる、末尾に「その他（自由入力）」も配置）
- 選択されたQのみ Step 2 で該当質問を再実行、**未選択Qは初回回答をそのまま保持**
- Step 3 でプロンプトを再構築し、Hearing Summary テーブルに `revision: Q2,Q5` のようなマーク行を追加
- Step 4 で新しいファイル名（初回ファイル名 + `-{HHmmss}` タイムスタンプ suffix）で保存
- **最大1回まで**（2回目のB選択は不可、無限ループ防止。2回目以降の修正が必要ならSkillを再度呼び出す旨案内）

**状態管理**: 再ヒアリング実施済み判定は、Hearing Summary の Revision 行（`revision: Q2,Q5` 形式）の有無で判定する。2回目の Step 5 で B が選ばれた場合は revision 行を Read してフラグ判定し、既存の場合は「最大1回のためスキル再起動を推奨」旨のメッセージを表示して終了。

**Step 3 再実行**: 再ヒアリング後は必ず Step 3 の機微情報検出を全 Q （変更なし Q も含む）に対して再実行する。初回で見逃した機微情報を Step 3 が再検出できる。

## エラー処理

| 事象 | 対応 |
|---|---|
| AskUserQuestion でユーザーが「中断」相当の入力 | Skill を停止し、これまでの回答を破棄した旨を明示する |
| Write 権限エラー | パス権限を確認するよう案内し、AskUserQuestion で別パス指定を促す |
| `references/*.md` の Read 失敗 | まず `git rev-parse --is-inside-work-tree` と `ls packages/cli/` の有無で原本 vs 下流を判別。原本リポジトリ（packages/cli/ 存在）→ `git checkout HEAD -- .claude/skills/einja-v0-prompt-generator/references/` で復元。下流プロジェクト（packages/cli/ 非存在）→ `/einja:sync` プラグイン or `einja sync` CLI で再取得を促す |
| 機微情報検出で誤検知が疑われる | 「伏せ字化 / そのまま継続 / 中断」から選択させ、判断をユーザーに委ねる |

## Progressive disclosure 参照リンク

詳細な質問文・テンプレート本体は以下のリファレンスファイルを参照:

- **`references/hearing-questions.md`** — Q1〜Q6 の質問文、選択肢の `description` + `Note` 完全版、分岐ロジック詳細
- **`references/v0-prompt-template.md`** — v0 プロンプト完全テンプレート（プレースホルダ付き）、Hearing Summary テーブル雛形、良い例/悪い例、v0向けTips

Skill本体は概観のみを保持し、詳細は必要時にこれら reference を Read して展開する構成。

## 出力例（生成される .md の抜粋イメージ）

```markdown
# Inventory Dashboard - v0 Prompt

## v0 Prompt

Build a Dashboard for tracking inventory levels across multiple warehouses.

### Purpose
Enable warehouse managers to monitor stock, spot low-inventory alerts, and drill down per SKU.

### Layout & Content Areas
- Sidebar (left, 240px): navigation with sections "Overview", "SKUs", "Warehouses", "Alerts"
- Header: search bar, notifications, user avatar
- Main: 4 KPI cards (Total SKUs, Low Stock, Warehouses, Alerts), data table below

### Visual Style
Enterprise, clean, high-density. Use neutral grays with a single accent color.

### States & Interactions
- Loading skeletons for KPI cards and table
- Empty state when no low-stock alerts
- Responsive breakpoints (mobile-first, sm/md/lg)
- Include a dark mode toggle in the header

### Behavior
Clicking a KPI card filters the table below.

## How to use（コピペ手順）
1. 上記 `## v0 Prompt` ブロック全体をコピー
2. https://v0.dev を開く
3. プロンプト入力欄に貼り付け「Generate」

## Hearing Summary

| Q | 回答 |
|---|---|
| Q1 | 倉庫管理者が在庫レベルを監視するダッシュボード |
| Q2 | Dashboard |
| Q3 | Sidebar, Header, KPI, Table |
| Q4 | Loading, Empty, Responsive, Dark Mode |
| Q5 | Enterprise |
| Q6 | 特になし |
```

## 完了条件

- ユーザーが Step 5 で「完了」を選択したこと
- 生成した `.md` のパスをユーザーに明示済みであること
- Hearing Summary が `.md` 末尾に含まれていること

<!-- @einja:project-private:start id="einja-v0-prompt-generator-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
