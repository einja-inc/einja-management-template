---
name: einja-skill-creator
description: >
  新しいSkillの作成、既存Skillの改善・更新、Skillパフォーマンスの評価に使用。Skillをゼロから作成したい場合、既存Skillを更新・最適化したい場合、評価テストでSkillをテストしたい場合、ベンチマークでパフォーマンスを分析したい場合、Skillのdescriptionのトリガー精度を最適化したい場合に使用。Create new skills, modify and improve existing skills, measure skill performance, run evals, benchmark, optimize description triggering.
---

# Skill作成ガイド

Skillを作成し、反復的に改善するためのSkill。

大まかなプロセスは以下の通り：

- Skillに何をさせたいか、どのように動作すべきかを決める
- Skillのドラフトを書く
- いくつかのテストプロンプトを作成し、Skill付きのClaudeで実行する
- ユーザーと共に結果を定性的・定量的に評価する
  - バックグラウンドで実行中に、定量的な評価項目がなければドラフトする。すでにある場合はそのまま使用するか、必要に応じて修正する。ユーザーに説明する
  - `eval-viewer/generate_review.py`スクリプトで結果をユーザーに表示し、定量的メトリクスも確認してもらう
- ユーザーの評価フィードバック（および定量的ベンチマークから明らかになった問題）に基づいてSkillを書き直す
- 満足するまで繰り返す
- テストセットを拡大し、より大規模に再試行する

このSkillを使う際の役割は、ユーザーがこのプロセスのどこにいるかを把握し、次のステージに進む手助けをすること。例えば「Xのスキルを作りたい」と言われたら、意図を明確化し、ドラフトを書き、テストケースを作成し、評価方法を決め、全プロンプトを実行し、繰り返す。

一方、すでにドラフトがある場合は、直接eval/反復パートに入れる。

もちろん柔軟に。ユーザーが「大量の評価は不要、一緒に感覚で作ろう」と言えばそうする。

Skillが完成した後（順序は柔軟）、Skillのdescription最適化も実行できる。これには専用のスクリプトがある。

## ユーザーとのコミュニケーション

スキルクリエイターは、コーディング用語への馴染み度が大きく異なるユーザーに使われる可能性がある。コンテキストの手がかりに注意して、コミュニケーションの言い回しを調整すること。デフォルトの目安：

- 「評価」「ベンチマーク」はボーダーラインだがOK
- 「JSON」「アサーション」はユーザーがそれらを知っている確実な手がかりを見てから、説明なしで使用する

疑わしい場合は用語を簡潔に説明してOK。不明な場合は短い定義を添えて明確にする。

---

## Skillの作成

### 意図の把握

ユーザーの意図を理解することから始める。現在の会話にすでにワークフローが含まれている場合（例：「これをスキルにして」）、会話履歴から回答を抽出する — 使用されたツール、ステップの順序、ユーザーの修正、観察されたI/O形式。ユーザーにギャップを埋めてもらい、次に進む前に確認する。

1. このSkillでClaudeに何をできるようにしたいか？
2. このSkillはいつトリガーすべきか？（どのようなユーザーフレーズ/コンテキスト）
3. 期待される出力フォーマットは？
4. Skillの動作を検証するためのテストケースを設定すべきか？客観的に検証可能な出力（ファイル変換、データ抽出、コード生成、固定ワークフロー）を持つSkillはテストケースの恩恵を受ける。主観的な出力（文体、アート）は通常不要。Skillの種類に基づいて適切なデフォルトを提案するが、最終判断はユーザーに委ねる。

### インタビューとリサーチ

エッジケース、I/Oフォーマット、サンプルファイル、成功基準、依存関係について積極的に質問する。テストプロンプトの作成はこの部分が固まってから。

利用可能なMCPを確認 — リサーチに有用なら（ドキュメント検索、類似スキル発見、ベストプラクティス参照）、サブエージェントで並行リサーチ。

### SKILL.mdの作成

ユーザーインタビューに基づいて以下を記入：

- **name**: Skill識別子。ディレクトリ名と一致させること
  - インナーSkill（他Skillから内部的に参照される、プロトコル定義、出力テンプレート等）
    は `_` プレフィックスをつける（例: `_einja-output-format`）
  - プロジェクト固有のSkillには名前空間プレフィックスをつけない
  - プロジェクトの名前空間プレフィックスはCLAUDE.mdに定義される
- **description**: いつトリガーするか、何をするか。主要なトリガーメカニズム。Skillが何をするかと使用する具体的なコンテキストの両方を含める。「いつ使用するか」情報はすべてここに。本文はトリガー後に読み込まれるため、本文の「使用すべき場合」セクションはClaudeに役立たない。注意：現在Claudeはスキルを「アンダートリガー」する傾向がある。対策としてdescriptionを少し「積極的」にする
- **compatibility**: 必要なツール、依存関係（オプション、まれに必要）
- **Skillの残りの部分 :)**

### Skill記述ガイド

#### ディレクトリ命名規則

ディレクトリ名はSkillの配布範囲を決定する:
- `{namespace}-{name}/` — 配布対象のユーザー向けSkill（例: `einja-task-commit/`）
- `_{namespace}-{name}/` — 配布対象のインナーSkill（例: `_einja-output-format/`）
- `{name}/` — プロジェクト固有Skill、配布されない（例: `cli-package-specs/`）

`name` フィールドはディレクトリ名と一致させること。

#### Skillの構造

```
skill-name/
├── SKILL.md（必須）
│   ├── YAMLフロントマター（name、description必須）
│   └── Markdown指示
└── バンドルリソース（オプション）
    ├── scripts/    - 決定論的/反復タスク用の実行可能コード
    ├── references/ - 必要に応じてコンテキストに読み込むドキュメント
    └── assets/     - 出力で使用されるファイル（テンプレート、アイコン、フォント等）
```

#### 段階的開示

Skillは3レベルの読み込みシステムを使用：
1. **メタデータ**（name + description）- 常にコンテキスト内（~100語）
2. **SKILL.md本文** - Skillトリガー時（500行以内が理想）
3. **バンドルリソース** - 必要に応じて（無制限、スクリプトは読み込まずに実行可能）

語数は目安であり、必要に応じて長くしてよい。

**主要パターン:**
- SKILL.mdは500行以内に抑える。この制限に近づいたら追加の階層を設け、モデルが次にどこを参照すべきか明確に示す
- referenceファイルをSKILL.mdから明確に参照し、いつ読むべきか記載
- 大きなreferenceファイル（300行超）には目次を含める

**ドメイン別整理**: Skillが複数ドメイン/フレームワークをサポートする場合、バリエーションごとに整理：

```
cloud-deploy/
├── SKILL.md（ワークフロー + 選択）
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

Claudeは関連するreferenceファイルのみ読む。

#### 驚きのない原則

Skillにマルウェア、エクスプロイトコード、システムセキュリティを侵害する可能性のあるコンテンツを含めてはならない。誤解を招くSkillや、不正アクセス、データ窃取、その他の悪意のある活動を助長するSkillの作成に協力しないこと。「XYZとしてロールプレイ」のようなものはOK。

#### 参考ドキュメントの記録

Skill作成時に参考にした公式ドキュメント、ベースとなるSkill、設計判断の根拠となった情報源をSKILL.md内にHTMLコメントで記載する。

**記載箇所**: フロントマター（`---`）直後

**フォーマット**:
```
<!-- 参考: https://example.com/docs/feature -->
<!-- ベース: .claude/skills/existing-skill/SKILL.md -->
```

これにより、Skillの設計根拠を後から追跡でき、公式仕様の変更時に影響範囲を特定しやすくなる。

#### 記述パターン

指示には命令形を使用する。

**出力フォーマットの定義** - 例：
```markdown
## レポート構造
常にこのテンプレートを使用：
# [タイトル]
## エグゼクティブサマリー
## 主要な発見
## 推奨事項
```

**例のパターン** - 例を含めると有用：
```markdown
## コミットメッセージフォーマット
**例1:**
入力: Added user authentication with JWT tokens
出力: feat(auth): implement JWT-based authentication
```

### 記述スタイル

重苦しい必須語句（MUST）の代わりに、物事がなぜ重要かをモデルに説明する。心の理論を使い、Skillを一般的で、特定の例に狭くなりすぎないようにする。ドラフトを書き、新鮮な目で見直して改善する。

### テストケース

Skillドラフト作成後、2-3のリアルなテストプロンプトを作成 — 実際のユーザーが言いそうなもの。ユーザーに共有：「テストケースをいくつか考えました。これで良いですか？追加したいものはありますか？」そして実行する。

テストケースを`evals/evals.json`に保存。アサーションはまだ書かない — プロンプトのみ。アサーションは実行中に次のステップで作成する。

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "ユーザーのタスクプロンプト",
      "expected_output": "期待される結果の説明",
      "files": []
    }
  ]
}
```

全スキーマは`references/schemas.md`を参照（アサーションフィールドを含む）。

## テストケースの実行と評価

このセクションは一連の連続したシーケンス — 途中で止めないこと。`/skill-test`やその他のテスティングスキルは使用しないこと。

結果は`<skill-name>-workspace/`にスキルディレクトリの兄弟として配置。ワークスペース内はイテレーションごとに整理（`iteration-1/`、`iteration-2/`等）、その中に各テストケースのディレクトリ（`eval-0/`、`eval-1/`等）。事前にすべて作成する必要はない — 進行に応じて作成。

### ステップ1: 全実行（with-skill AND ベースライン）を同じターンで起動

各テストケースに対して、同じターンで2つのサブエージェントを起動 — 1つはSkill付き、1つはSkillなし。重要：with-skill実行を先にすべて起動してからベースラインに戻るのではなく、すべてを一度に起動してほぼ同時に完了するようにする。

**With-skill実行:**
```
このタスクを実行:
- Skillパス: <path-to-skill>
- タスク: <evalプロンプト>
- 入力ファイル: <evalファイル、またはなし>
- 出力保存先: <workspace>/iteration-<N>/eval-<ID>/with_skill/outputs/
- 保存する出力: <ユーザーが気にするもの>
```

**ベースライン実行**（同じプロンプト、コンテキストに応じたベースライン）：
- **新規Skill作成**: Skillなし。同じプロンプト、Skillパスなし、`without_skill/outputs/`に保存
- **既存Skill改善**: 旧バージョン。編集前にスナップショット（`cp -r <skill-path> <workspace>/skill-snapshot/`）、ベースラインサブエージェントをスナップショットに向ける。`old_skill/outputs/`に保存

各テストケースに`eval_metadata.json`を作成（アサーションは空でよい）。各evalにテスト内容を説明する名前を付ける。

### ステップ2: 実行中にアサーションをドラフト

実行完了を待つだけでなく、この時間を有効活用。各テストケースの定量的アサーションをドラフトし、ユーザーに説明する。

良いアサーションは客観的に検証可能で、説明的な名前を持つ — ベンチマークビューアで一目で何をチェックしているか分かるべき。主観的なSkill（文体、デザイン品質）は定性的評価が適切 — 人間の判断が必要なものにアサーションを強制しない。

### ステップ3: 実行完了時にタイミングデータをキャプチャ

各サブエージェントタスク完了時、通知に`total_tokens`と`duration_ms`が含まれる。**このデータを即座に`timing.json`に保存**すること — タスク通知は1回限りで、後からバッチ処理できない：

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

### ステップ4: 採点、集計、ビューア起動

全実行完了後：

1. **各実行を採点** — 採点サブエージェントを起動し`agents/grader.md`を読ませて各アサーションを出力に対して評価。`grading.json`に保存。grading.jsonの期待値配列は `text`、`passed`、`evidence` フィールドを使用すること（`name`/`met`/`details` やその他のバリアントは不可 — ビューアがこの正確なフィールド名に依存している）。プログラムでチェック可能なアサーションは、目視ではなくスクリプトを書いて実行。

2. **ベンチマークに集計** — skill-creatorディレクトリから集計スクリプトを実行：
   ```bash
   python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>
   ```
   各with_skillバージョンをベースライン対応の前に配置。

3. **アナリストパスを実行** — ベンチマークデータを読み、集計統計が隠すパターンを表面化。`agents/analyzer.md`の「ベンチマーク結果の分析」セクションを参照。

4. **ビューアを起動** — 定性的出力と定量的データの両方で：
   ```bash
   nohup python <skill-creator-path>/eval-viewer/generate_review.py \
     <workspace>/iteration-N \
     --skill-name "my-skill" \
     --benchmark <workspace>/iteration-N/benchmark.json \
     > /dev/null 2>&1 &
   VIEWER_PID=$!
   ```
   イテレーション2以降は`--previous-workspace <workspace>/iteration-<N-1>`も渡す。

   **Cowork / ヘッドレス環境:** `webbrowser.open()`が利用不可の場合、`--static <output_path>`でスタンドアロンHTMLファイルを書き出す。

注意: ビューア生成にはgenerate_review.pyを使用すること。カスタムHTMLを書く必要はない。

5. **ユーザーに伝える** — 「ブラウザで結果を開きました。'Outputs'タブで各テストケースをクリックしてフィードバックを残せます。'Benchmark'タブで定量的比較が見られます。完了したらお知らせください。」

### ステップ5: フィードバックの読み込み

ユーザーが完了を告げたら、`feedback.json`を読む：

```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "チャートに軸ラベルがない", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."},
    {"run_id": "eval-2-with_skill", "feedback": "完璧、気に入った", "timestamp": "..."}
  ],
  "status": "complete"
}
```

空のフィードバックはユーザーがOKと判断したことを意味する。具体的な指摘があるテストケースに改善を集中する。

ビューアサーバーが不要になったらkillする。

---

## Skillの改善

ループの核心。テストケースを実行し、ユーザーが結果をレビューし、フィードバックに基づいてSkillを改善する。

### 改善の考え方

1. **フィードバックから汎化する。** ここでの大きな絵は、何百万回も使われるSkillを作ろうとしていること。少数の例で反復するのは速く進むためだが、それらの例にのみ機能するSkillは無用。こまごまとした過学習的な変更や、圧倒的に制約の多いMUSTの代わりに、異なるメタファーや作業パターンを試みる。

2. **プロンプトをスリムに保つ。** 効果のないものを削除。トランスクリプトを読み（最終出力だけでなく）、Skillがモデルに非生産的なことをさせていたら、該当部分を削除して結果を見る。

3. **理由を説明する。** モデルに何かをさせる理由の「なぜ」を説明する。今日のLLMは賢い。良いハーネスがあれば機械的な指示を超えて本当に成果を出せる。ALWAYS/NEVERを全大文字で書いている場合、それは黄色信号。

4. **テストケース間の重複作業を探す。** テスト実行のトランスクリプトを読み、サブエージェントが独立して同様のヘルパースクリプトを書いたか確認。3つのテストケースすべてでサブエージェントが`create_docx.py`を書いていたら、Skillにそのスクリプトをバンドルすべき強いシグナル。

### 反復ループ

1. 改善をSkillに適用
2. 全テストケースを新しい`iteration-<N+1>/`ディレクトリに再実行（ベースライン含む）
3. `--previous-workspace`で前のイテレーションを指定してレビューアを起動
4. ユーザーのレビュー完了を待つ
5. 新しいフィードバックを読み、改善を繰り返す

以下で終了：
- ユーザーが満足
- フィードバックがすべて空（すべて良好）
- 意味のある進歩がない

---

## 高度: ブラインド比較

2つのバージョンのより厳密な比較が必要な場合（例：「新バージョンは本当に良くなったか？」）、ブラインド比較システムがある。`agents/comparator.md`と`agents/analyzer.md`を参照。基本的な考え方：2つの出力をどちらが由来かを伝えずに独立エージェントに渡し、品質を判定させる。

オプション、サブエージェントが必要、ほとんどのユーザーには不要。人間のレビューループで通常は十分。

---

## Description最適化

SKILL.mdフロントマターのdescriptionフィールドは、ClaudeがSkillを呼び出すかどうかを決定する主要メカニズム。Skill作成・改善後、トリガー精度を最適化するdescription改善を提案する。

### ステップ1: トリガー評価クエリの生成

20個の評価クエリを作成 — トリガーすべきものとすべきでないものの混合。JSONとして保存。

クエリは現実的で、Claude CodeやClaude.aiユーザーが実際にタイプするもの。抽象的ではなく、具体的で詳細なリクエスト。ファイルパス、個人的なコンテキスト、カラム名、会社名、URL等。少しの背景。一部は小文字や略語やタイプミスやカジュアルな話し方。長さを混ぜ、明確なケースよりエッジケースに焦点。

**Bad**: `"Format this data"`, `"Extract text from PDF"`, `"Create a chart"` — 抽象的すぎて何もテストしない

**Good**: `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage. The revenue is in column C and costs are in column D i think"` — 具体的、カジュアル、背景あり

**トリガーすべき**クエリ（8-10個）はカバレッジを考える。異なるフレーズ、フォーマル/カジュアル混在、スキル名を明示しないが明らかに必要なケース、珍しいユースケース。**トリガーすべきでない**クエリ（8-10個）はニアミス — キーワードを共有するが実際には異なるものが必要なクエリ。「フィボナッチ関数を書いて」のような明らかに無関係なクエリは避ける — テストにならない。

### ステップ2: ユーザーとレビュー

HTMLテンプレートで評価セットをユーザーに提示：

1. `assets/eval_review.html`のテンプレートを読む
2. プレースホルダーを置換：
   - `__EVAL_DATA_PLACEHOLDER__` → 評価項目のJSON配列
   - `__SKILL_NAME_PLACEHOLDER__` → Skill名
   - `__SKILL_DESCRIPTION_PLACEHOLDER__` → 現在のdescription
3. 一時ファイルに書き出してブラウザで開く
4. ユーザーが編集し「Export Eval Set」をクリック

### ステップ3: 最適化ループの実行

バックグラウンドで実行：

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id-powering-this-session> \
  --max-iterations 5 \
  --holdout 0.4 \
  --verbose
```

セッションのモデルIDを使用（`--model`）。`--holdout 0.4`（デフォルト）で60% train / 40% test分割。各クエリ3回実行で信頼性のあるトリガー率を取得。extended thinkingのClaudeで改善を提案（改善専用モデルは`--improve-model`で変更可）。train/testの両方で再評価し、最大5回反復。テストスコアは改善モデルに見せない（blinded_history）ため過学習を防止。完了時にHTMLレポートをブラウザで自動起動し、`best_description`をJSONで返す。`--results-dir <dir>`で全出力をタイムスタンプ付きサブディレクトリに保存可能。

### スキルトリガーの仕組み

SkillはClaudeの`available_skills`リストにname + descriptionで表示される。Claudeは自力で簡単に処理できるタスクにはSkillを参照しない。複雑で複数ステップの専門的なクエリはdescriptionが一致するとSkillを確実にトリガーする。評価クエリはSkillの参照が有益なほど実質的であるべき。

### ステップ4: 結果の適用

JSON出力の`best_description`をSkillのSKILL.mdフロントマターに更新。ユーザーにbefore/afterを表示しスコアを報告。

---

### パッケージ化と提示（`present_files`ツールが利用可能な場合のみ）

```bash
python -m scripts.package_skill <path/to/skill-folder>
```

---

## Claude.ai固有の手順

Claude.aiではサブエージェントがないため、一部の手順を変更する。コアワークフロー（ドラフト→テスト→レビュー→改善→繰り返し）は同じ。

- **テスト実行**: サブエージェントなし＝並列実行不可。各テストケースを順次に自分で実行。これはサブエージェント版より厳密性が低い（スキル作成者がスキル実行者でもあるため完全なコンテキストを持つ）が、有用なサニティチェックであり、人間のレビューステップが補完する。ベースライン実行はスキップ
- **結果レビュー**: ブラウザが使えない場合、会話内で直接結果を提示。出力がファイルの場合はパスを伝える
- **ベンチマーク**: スキップ（ベースライン比較がサブエージェントなしでは意味をなさない）
- **Description最適化**: `claude` CLI（`claude -p`）が必要なためスキップ
- **ブラインド比較**: サブエージェントが必要。スキップ

---

## Cowork固有の手順

- サブエージェントあり、メインワークフロー（テスト並行実行等）は動作する
- ブラウザがないため、ビューア生成時は`--static <output_path>`を使用
- フィードバックは`feedback.json`としてダウンロード（ファイルアクセスのリクエストが必要な場合がある）
- テスト実行後は**必ず**`generate_review.py`で評価ビューアを生成してから自己評価すること

---

## リファレンスファイル

agents/ディレクトリには専門サブエージェントの指示がある。関連サブエージェントを起動する時に読む。

- `agents/grader.md` — アサーションの出力に対する評価方法
- `agents/comparator.md` — 2つの出力のブラインドA/B比較方法
- `agents/analyzer.md` — 一方が勝った理由の分析方法

references/ディレクトリには追加ドキュメント：
- `references/schemas.md` — evals.json、grading.json等のJSON構造

---

## スキルの初期化（init_skill.py）

新しいSkillをゼロから作成する場合は、`init_skill.py`スクリプトを実行する。

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

## スキルのパッケージ化（package_skill.py）

```bash
scripts/package_skill.py <path/to/skill-folder> [output-directory]
```

---

コアループの再掲（見落とし防止）：

- Skillの目的を理解する
- Skillをドラフトまたは編集する
- テストプロンプトでSkill付きClaudeを実行する
- ユーザーと共に出力を評価する：
  - benchmark.jsonを作成し`eval-viewer/generate_review.py`でユーザーレビューを支援
  - 定量的評価を実施
- 満足するまで繰り返す
- 最終Skillをパッケージ化してユーザーに返す

**TodoList**: ステップを見失わないよう、TodoListが利用可能であればステップを追加すること。特にCowork環境では「evalsのJSONを作成し `eval-viewer/generate_review.py` を実行して人間がテストケースをレビューできるようにする」を必ずTodoListに含める。

### 横断比較ツール（compare_runs.py）

複数スキルの`run_loop.py`出力を横断比較する場合は`compare_runs.py`を使用：

```bash
python -m scripts.compare_runs result1.json result2.json --verbose --json
```

<!-- @einja:excluded:start -->
## プロジェクト固有セクションの記入

SKILL.md等のmdファイルの末尾には以下を記入する:

```markdown
<!-- @einja:project-private:start id="{既存と同じID}" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
```
<!-- @einja:excluded:end -->

<!-- @einja:project-private:start id="einja-skill-creator-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
