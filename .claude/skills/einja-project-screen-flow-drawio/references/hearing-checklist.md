# 画面候補推定 + ヒアリング項目チェックリスト

本ファイルは `einja-project-screen-flow-drawio` Skill のワークフロー **Step 3（画面候補推定・章識別と画面候補抽出）** および **Step 4（AskUserQuestion によるヒアリング補完）** で参照される。`docs/project/requirements.md` を入力に、drawio 上に描く画面ノード集合と画面間遷移を確定させるための推定ルールと質問テンプレを定義する。

enum 値（`layout_strategy` / `edge_kind` / `routing` / `node_kind` / `business_role` / `source_confidence` / `status` 等）は `canonical-enums.md` を Single Source of Truth として参照する。本ファイル内では lowercase + ハイフン形式で正確に引用すること。

> **Progressive disclosure 方針**: 本ファイル §3.3「共通画面リスト（出現条件と既定 ON/OFF）」が共通画面に関する SSoT。
> SKILL.md 側からは具体的な共通画面の列挙を行わず、必ず「→ `references/hearing-checklist.md` §3.3 を参照」とリンクで参照すること。
> 重複記述は変更時の同期漏れを招くため避ける。

## 1. 章別シグナル強度

要件定義書の章ごとに「画面候補抽出の信頼度」が異なる。下表の **主要シグナル** から仮リストを生成し、**補助シグナル** で補強・取捨選択する。

| シグナル区分 | 章 | 抽出するもの | 信頼度 |
|--------|------|-------------|--------|
| 主要 | §2.x 配下の TO-BE 業務フロー（章番号は揺らぐ） | mermaid `flowchart` 内のアクターノード（subgraph "従業員"/"上長"/"人事部" 等の box 名）= 人が触る画面候補 | 高 |
| 主要相当 | §3.3 権限マトリクス × フロー クロスチェック | 権限マトリクス行ラベルと §2 業務フロー由来画面のクロスチェックで抽出漏れを検出（§3.4 参照） | 高 |
| 補助 | §3 対象ユーザー（特に §3.3 権限マトリクス） | ロール × アクションのクロス積で画面候補を補強・ロール別アクセスを推定 | 中 |
| 補助 | §5 スコープ境界（§5.1 機能スコープ） | 「含む / 含まない」表で画面の取捨選択（含まない機能の画面は除外） | 中 |
| 補助 | §6.1 機能一覧 | §2 で漏れる管理系画面（マスタ管理・設定・監査ログ閲覧等）を補強 | 中 |

**システム側ノード（subgraph "新システム" / "バッチ" 等）は画面候補から除外**する（自動処理のため UI を持たない）。ただし「通知」「アラート」等は画面ではなく遷移トリガーとして §4 ヒアリング項目C で扱う。drawio 書き出し時はシステム側ノードを mxCell として描画しない。

## 2. 見出し名ベースの章識別パターン

章番号はスキーマ変更で揺れる可能性があるため、見出し**名**ベースで検索する。ハイフン異字（`-` / `‐` / `－`）にも対応する。

```yaml
patterns:
  to_be_flow:
    primary: '/^#{2,4}\s+(\d+(\.\d+)*\s*)?TO[-‐－]?BE\s*業務フロー/im'   # ハイフン異字対応
    fallback: '/^#{1,3}\s+(\d+(\.\d+)*\s*)?対象業務/im'
  user_roles:
    primary: '/^#{2,3}\s+(\d+(\.\d+)*\s*)?対象ユーザー/im'
  permission_matrix:
    primary: '/^#{2,4}\s+(\d+(\.\d+)*\s*)?権限\s*マトリクス/im'
    table_header: '/\|\s*主要機能領域\s*\|/i'
  scope:
    primary: '/^#{2,3}\s+(\d+(\.\d+)*\s*)?スコープ境界/im'
  functions:
    primary: '/^#{2,3}\s+(\d+(\.\d+)*\s*)?機能要件/im'
    list_table: '/^#{2,4}\s+(\d+(\.\d+)*\s*)?機能一覧/im'
  common_screens:
    auth: '/Auth\.js|多要素認証|MFA|OAuth/i'
    error: '/エラー画面|障害|フォールバック/i'
    maintenance: '/メンテナンス|計画停止|SLA/i'
```

**フォールバック**: §2 TO-BE フローが見つからない / mermaid 抽出失敗時は、§6.1 機能一覧の全機能を 1:1 で画面化（機能名から `-画面` を補い、最低限のセーフティネットとする）。drawio 書き出しでも同じセーフティネットを適用する。

## 3. 抽出パターン例（勤怠管理SaaSサンプル）

`docs/einja/example/specs/projects/sample-attendance-saas/requirements.md` を入力にした場合の推定結果例。各画面に **`(暫定推定)`** マークを付与し、ヒアリングで確定させ、drawio に書き出す。

**完全な出力サンプル（ヒアリング Step 4 確定後の manifest）**: `docs/einja/example/specs/projects/sample-attendance-saas/screen-flow-url.md` を参照（10画面 + 12エッジ規模）。

### 3.1 §2.1.2 TO-BE フローから抽出（主要シグナル）

| ロール | 画面候補 | フロー上のノード | source_confidence |
|--------|---------|----------------|----------|
| 従業員 | 打刻画面 (暫定推定) | A2 「アプリで打刻」 | `high` |
| 従業員 | 申請画面（有給/残業） (暫定推定) | A3 「アプリで有給/残業申請」 | `high` |
| 上長 | 申請通知一覧 (暫定推定) | B1 「アプリで申請通知受領」 | `high` |
| 上長 | 申請承認画面 (暫定推定) | B2 「承認判定」 | `high` |
| 上長 | 差し戻しコメント入力 (暫定推定) | B3 「コメント付き差し戻し」 | `high` |
| 人事部 | ダッシュボード (暫定推定) | H1 「ダッシュボードで状況確認」 | `high` |
| 人事部 | 月次集計画面 (暫定推定) | H2 「月次集計を自動取得」 | `high` |
| 人事部 | CSV/PDFエクスポート画面 (暫定推定) | H3 「CSV/PDFで給与システムへ連携」 | `high` |

### 3.2 §6.1 機能一覧から補強（補助シグナル）

| 機能ID | 画面候補（追加） | 理由 | source_confidence |
|--------|---------------|------|----------|
| F-02 | シフト管理画面 (暫定推定) | §2 に登場しないが §6 で MUST 機能 | `medium` |
| F-07 | ユーザー管理画面 (暫定推定) | マスタ管理（人事担当・システム管理者向け） | `medium` |
| F-08 | 監査ログ閲覧画面 (暫定推定) | セキュリティ系（システム管理者向け） | `medium` |

### 3.3 共通画面リスト（出現条件と既定 ON/OFF）

要件定義書の記述シグナルを検知して、以下の共通画面を画面候補に追加するか判定する。既定 ON のものは項目E のデフォルトで採用、既定 OFF のものはユーザーの明示指定がある場合のみ追加する。

| 画面名 | 出現条件 | 既定 | 配置 lane_id | Note |
|--------|--------|----|--------|------|
| `login` | §3.3 権限マトリクス存在 / §4 採用方針に「認証」記載 | ON | `Common` | **user-flow レイアウト時はエントリポイント候補（既定 ON で `is_entry_point: true` 補完、`references/drawio-style-rules.md §3.3.1` 3-method priority chain method 2 (heuristics-name) でマッチ）** |
| `home` | §2 TO-BE 業務フローに「メニュー」「ダッシュボード」相当のハブ画面なし | ON | `Common` | - |
| `settings` | §6 機能一覧に「設定」「プロフィール」等の記載 | OFF | `Common` | - |
| `error` | §4.x 非機能 / §6 機能一覧に「エラー画面」記載 | ON | `Common` | - |
| `not-found-404` | §5 スコープに「公開機能」 | ON | `Common` | - |
| `session-expired` | §4 採用方針に「認証」 | ON | `Common` | - |
| `forbidden-403` | §3.3 権限マトリクス存在 | ON | `Common` | - |
| `maintenance` | §7 運用要件・SLA記載 | OFF | `Common` | - |

共通画面は canonical role `Common`（`canonical-enums.md §5`）に配置する。

### 3.4 クロスチェック自動フラグ（§3.3 権限マトリクス × §2 業務フロー）

§3.3 の権限マトリクス行ラベルと §2 業務フロー由来の画面集合をクロスチェックし、権限マトリクスに登場するが §2 に画面ノードが無いものを「抽出漏れ候補」として検出する。検出結果には `source_confidence`（`canonical-enums.md §6` 参照: `high` / `medium` / `low`）を付与し、`high` 以外はヒアリング項目 A で必ず確認対象とする。

```javascript
// crossCheck: 権限マトリクス × 業務フロー画面集合のクロスチェック
function crossCheck(permissionMatrix, flowScreens) {
  const unmatched = [];
  for (const row of permissionMatrix.rows) {
    const result = normalizeToScreenName(row.label);
    if (!flowScreens.has(result.name)) {
      unmatched.push({
        name: result.name,
        source: "permission_matrix",
        source_confidence: result.confidence,  // "high" | "medium" | "low"
      });
    }
  }
  return unmatched;
}

// normalizeToScreenName: 権限マトリクス行ラベル → 正規化画面名
// confidence 判定基準:
//   high   : 完全一致 / 既知 synonym 辞書ヒット（例: "打刻" → "打刻画面"）
//   medium : 部分一致（例: "勤怠データ" → "勤怠管理画面" を部分含有判定）
//   low    : 機能語尾変換（例: "ログ閲覧" → "ログ表示画面"、「閲覧」→「表示」等の語尾置換）
function normalizeToScreenName(label) {
  // 1) 完全一致 / synonym 辞書（high）
  if (KNOWN_SYNONYMS.has(label)) {
    return { name: KNOWN_SYNONYMS.get(label), confidence: "high" };
  }
  // 2) 部分一致（medium）
  const partial = findPartialMatch(label);
  if (partial) return { name: partial, confidence: "medium" };
  // 3) 機能語尾変換（low）
  const transformed = transformSuffix(label);  // 「閲覧」→「表示」「画面」等
  return { name: transformed, confidence: "low" };
}
```

**ヒアリング連携**: クロスチェック結果のうち `source_confidence != "high"` のものは、項目A（画面リスト確定）で「権限マトリクス由来の追加候補」として明示し、採用 / 除外 / 名称修正をユーザーに確認する。

## 4. AskUserQuestion ヒアリング項目テンプレ

ヒアリングは **項目を分割** して順に確認する（一度に多くを聞かない）。各選択肢は **description（What）** と **Note（So What）** の2層で記述し、必ず **「その他（自由入力）」** を含める。

### 項目A: 画面リスト確定

**質問例**: 推定画面リスト（上記 3.1〜3.3 + §3.4 クロスチェック結果）を提示し、追加・削除・名称修正を確認。クロスチェックで `source_confidence != "high"` の画面は「権限マトリクス由来 / 機能一覧由来」と明示すること。

| 選択肢 | description | Note |
|--------|------------|------|
| そのまま採用 | 推定された全画面を drawio に書き出す | メリット: 最速。デメリット: 不要画面も生成される可能性。後から個別削除も可 |
| 一部削除して採用 | 不要な画面を指定して除外 | 削除画面名をリスト形式で指定。Note: 削除画面に紐づくエッジも自動除外される |
| 追加・名称修正 | 抽出漏れの画面追加 / 画面名のリネーム | Note: 命名規則は kebab-case 推奨（`shift-management`等）。リネームは後工程の冪等性に影響しない |
| 未確定で先に進む | 暫定推定のまま drawio 書き出し、後で手動編集 | Note: 冪等性により後から再実行しても手動編集は保持される（orphan化のみ） |
| その他（自由入力） | 上記以外の指示・質問 | - |

### 項目B: 画面間遷移（エッジ）

**質問例**: §2 TO-BE フローのエッジから推定した遷移リスト（例: `打刻画面 → ホーム`、`申請画面 → 申請通知一覧`）を提示し、追加・削除・方向の修正を確認。

| 選択肢 | description | Note |
|--------|------------|------|
| 推定遷移を採用 | flowchart のエッジを画面遷移に変換して採用 | Note: システム側ノード経由のエッジは「自動遷移」扱い（項目C で確認） |
| 追加遷移を指定 | 抽出漏れの遷移を追加 | 例: ログイン画面 → ホーム、エラー画面遷移など共通遷移はフローに描かれないことが多い |
| 双方向に修正 | 「戻る」遷移を明示したい場合 | Note: drawio の矢印は片方向（edge mxCell）。双方向にする場合はエッジを2本描画（`edge_kind: back` 推奨、`canonical-enums.md §2` 参照） |
| 未確定で先に進む | 推定のまま drawio 書き出し | - |
| その他（自由入力） | - | - |

### 項目C: 遷移トリガー（エッジラベル）

**質問例**: 各エッジに付与するラベル（クリック操作・自動遷移・条件分岐）を確認。

| 選択肢 | description | Note |
|--------|------------|------|
| クリック操作 | ボタン押下による画面遷移 | 例: 「打刻ボタンクリック」「承認ボタンクリック」。最も一般的 |
| 自動遷移 | システム処理完了後の自動遷移 | 例: 「打刻完了 → ホームへ自動戻り」「通知受信時」 |
| 条件分岐 | mermaid の `B2{承認判定}` のような分岐 | Note: 1つの遷移元から2本以上のエッジが出る場合に使用（例: 承認 / 差し戻し）。差し戻しは `edge_kind: back` を付与 |
| ラベルなし | トリガー未確定 / 自明な遷移 | Note: edge mxCell の value 属性を空にし、ラベル自体を描画しない（エッジは線のみ） |
| その他（自由入力） | - | - |

### 項目D: ロール別アクセス可能画面（§3.3 権限マトリクスが存在する場合）

**質問例**: §3.3 の権限マトリクスを参考に、各画面のアクセス可能ロールを確認。

**デフォルト**: 「エントリポイント基準で階層化」（`layout_strategy: user-flow`、`canonical-enums.md §1` 参照）を **既定 ON** とする。視認性とエントリポイント基準階層化を優先するため。drawio の swim-lane は role 軸明示時のみ採用。

| 選択肢 | description | Note |
|--------|------------|------|
| エントリポイント基準で階層化（デフォルト） | `layout_strategy: user-flow` でエントリ画面から BFS 深さ順に階層配置 | Note: `references/drawio-style-rules.md §3.3` 参照。視認性・操作フロー追従性向上。role 軸明示が不要な一般的ケースで推奨 |
| ロールごとにグルーピング | `layout_strategy: swim-lane` で Common / Employee / Manager / HR / Admin / Ext の drawio swim-lane mxCell に画面を配置 | Note: `canonical-enums.md §5` の canonical role 辞書順で lane を生成。role 責務軸を明示したい場合に有用 |
| 権限マトリクス準拠（ロール情報のみ付与） | swim-lane 配置はせず、各画面 mxCell に `business_role` 属性のみ付与 | Note: 後工程の Issue 仕様書生成等で再利用される。レイアウトは `grid` |
| ロール情報なしで進める | アクセス制御は別途検討、画面のみ生成 | Note: 後から mxCell の `business_role` 属性で追加可能 |
| その他（自由入力） | - | - |

### 項目E: 共通画面の追加（§3.3 共通画面リスト）

**質問例**: §3.3 の出現条件にヒットした共通画面（既定 ON: `error` / `not-found-404` / `session-expired` / `forbidden-403` 等）の採用方針を確認。

| 選択肢 | description (What) | Note (So What) |
|-------|------------------|--------------|
| (a) 推定 ON 画面を一括採用（デフォルト） | §3.3 で既定 ON とされた共通画面（`error` / `not-found-404` / `session-expired` / `forbidden-403` 等）を一括採用する | 4画面（条件次第で増減）が自動で manifest に追加され、`Common` lane に配置される。所要時間: 即時 |
| (b) 個別選択 | 表形式で画面ごとに ON/OFF を選択する | 1画面ずつ確認できるが、所要時間 +2分。出現条件が borderline の画面（`maintenance` 等）を慎重に判断したい場合に有用 |
| (c) すべて除外 | 共通画面は今回スコープ外とし、manifest に追加しない | manifest に追加せず、後で別 Issue で追加可能。プロトタイプ段階等で業務フロー画面のみに集中したい場合 |
| (d) その他（自由入力） | カスタム判断 | 自由入力で具体的指示（例: 「error と forbidden-403 だけ採用」「maintenance も追加」等） |

### 項目F: エントリポイント確認（`user-flow` 経路で自動検出 0 件時のみ表示）

**表示条件**: `references/drawio-style-rules.md §3.3.1` の 3-method priority chain（manifest 明示 (`is_entry_point: true`) → 名前 heuristics (`/^(login|signin|sign-in|entry|top|landing|splash)(-|$)/i`) → primary in-degree 0）が全 0 件の場合のみ表示する。自動検出が成功した場合は本項目を skip する（デフォルト OFF）。

**質問例**: 「業務フローの開始画面を選択してください。自動検出ではエントリポイントを特定できませんでした。」

| 選択肢 | description | Note |
|--------|------------|------|
| 既存 screens から選択 | 確定済み画面リスト（項目 A で確定）から開始画面 1 つを選択 | Note: 選択した画面に `is_entry_point: true` を付与し、`references/canonical-enums.md §10` `entry-detection-method: user-confirmed` を記録 |
| `grid` fallback で進める | `user-flow` レイアウトを諦め、`layout_strategy: grid` にフォールバック | Note: エントリ階層化を放棄し v1 grid 配置を採用。後で manifest 編集 + 再生成でエントリ指定可能 |
| 中止 | Skill 実行を中止し、要件定義書 / manifest を見直す | Note: エントリ画面候補が業務フロー上に存在しない場合は要件定義書の見直しが必要 |
| その他（自由入力） | カスタム判断 | 自由入力（例: 「新規エントリ画面を追加して entry-screen として採用」等） |

## 5. ヒアリングのアンチパターン

- **主観的な質問を避ける**: 「使いやすそうな配置にしますか？」のような曖昧質問は禁止。座標・命名等は機械的に決定する
- **一度に多くを聞かない**: 項目A〜E を一括で聞かず、A → B → C → D → E の順で分割する（A の回答により B 以降の選択肢が変わるため）
- **「未確定で先に進む」を必ず提供**: 後から手動編集 / 再実行で修正可能であることを Note に明記し、ヒアリングのブロッキングを防ぐ
- **要件定義書を逸脱した質問を避ける**: 「ボタンの色は？」「フォントサイズは？」等の UI 詳細は本 Skill のスコープ外（drawio 描画はノード矩形のみで配色等は問わない、→ `ui-design-generator` で扱う）
- **画面の中身を聞かない**: 本 Skill は遷移図のみ。画面内のフォーム項目・コンポーネント構成は問わない
- **クロスチェック由来画面を黙って追加しない**: §3.4 のクロスチェックで `source_confidence != "high"` のものは項目A で必ず確認対象とする（信頼度に応じた透明性確保）

## 6. 関連リファレンス

本 Skill 内の関連ファイル:

- [`canonical-enums.md`](./canonical-enums.md) - enum 値の Single Source of Truth（`layout_strategy` / `edge_kind` / `routing` / `node_kind` / `business_role` / `source_confidence` / `status`）
- [`manifest-schema.md`](./manifest-schema.md) - `docs/project/screen-flow-url.md` の frontmatter / manifest スキーマ定義
- [`drawio-style-rules.md`](./drawio-style-rules.md) - drawio 上の矢印・swim-lane レイアウト描画ルール、`readNodeKind()` 等のユーティリティ
- [`../SKILL.md`](../SKILL.md) - Skill 本体（ワークフロー Step 3 / Step 4 から本ファイルを参照）

## 7. ドラフト確認フェーズ（Step 4.5）

SKILL.md ワークフロー **Step 4.5** から参照される。Step 4 ヒアリング完了後、drawio 描画（Step 6 以降）前に manifest ドラフトをユーザー承認する関門ステップの仕様を定義する。

### 7.1 目的

Step 4 ヒアリング完了直後、drawio 書き出しコストを払う前に manifest ドラフトを提示してユーザー承認を取るためのゲート。drawio 描画後の手戻り（再生成・orphan 量産）を抑止し、精度を高める。本フェーズは **読み取り専用 + draft note 編集のみ**で drawio 書き出しは発生しない。詳細経緯は worktree-synthetic-hinton.md Plan「Skill 1 の Step 4.5 新設」参照。

### 7.2 draft note フォーマット

- **パス**: `docs/project/screen-flow-url.draft.md`（本番 manifest と同階層、`.draft.md` 拡張子で区別）
- **構造**:
  - YAML frontmatter（`project_name` / `layout_strategy` / `role_canonical_map` / `schema_version`）
  - `## screens` セクション（各画面の name / role / lane_id / source_confidence / is_entry_point）
  - `## edges` セクション（各エッジの from / to / trigger / edge_kind / routing）
  - **`cell_id` / `drawio_url` / `drawio_file_path` 等の drawio 接続情報は全件 PLACEHOLDER**（drawio 未書き出しのため）
- **末尾コメントブロック**:
  - `<!-- status: draft -->`
  - 生成日時（ISO8601）
  - ヒアリング応答ログ（A〜F）
  - 「ユーザー承認待ち — drawio 未書き出し」

### 7.3 ヒアリング応答ログ テンプレ

draft note 末尾コメント内にヒアリング項目 A〜F の応答サマリを記載する。

```
<!--
status: draft
generated_at: 2026-05-27T11:30:00+09:00
hearing_responses:
  A: 11 screens 全件採用
  B: edges 12件、approval→request を back に確定
  C: trigger 文言は推定値そのまま
  D: layout_strategy: user-flow（推奨デフォルト）
  E: 共通画面 login のみ
  F: skip（自動検出で login 確定）
-->
```

### 7.4 識別子規約（フィールド直接修正で使うパス記法）

「フィールド直接修正」モードでユーザーが自由入力する際の YAML パス記法を定義する。

- `screens[<screen-name>].xxx` — screen は **name キー**（例: `screens[login].is_entry_point = true`）
- `edges[N].xxx` — edge は **配列インデックス**（例: `edges[3].edge_kind = back`）
- **配列インデックス指定（`screens[3]` のような name キー以外の指定）は明示エラー**、name キーのみ受付

### 7.5 差分絵文字規約

再生成時の既存 confirmed manifest との差分を AskUserQuestion description に表示する際の絵文字規約。

- ✅ **追加**: 既存 manifest になく draft note にある entry
- ❌ **削除**: 既存 manifest にあって draft note にない entry（orphan 化予定）
- 🔄 **変更**: 共通 entry のフィールド値差分

### 7.6 項目記号 ↔ ヒアリング名マッピング表

ヒアリング項目（A〜F）と manifest フィールドの対応。Step 4 のヒアリング項目名（`項目A` / `項目B` …）と Step 4.5 の「項目戻り」選択肢の対応を明示する。

| 項目 | 内容 | 確定する manifest フィールド |
|---|---|---|
| A | 画面リスト | `screens[]` |
| B | エッジ | `edges[]` |
| C | トリガー文言 | `edges[].trigger` |
| D | layout_strategy 選択 | `layout_strategy` |
| E | 共通画面 | `screens[]` (login/error 等) |
| F | エントリポイント | `screens[].is_entry_point` |

### 7.7 AskUserQuestion 文言テンプレ

Step 4.5 の AskUserQuestion 提示時の文言テンプレ:

- **description**: サマリ表（`manifest-schema.md §8.4 サマリ表テンプレ` 参照、screen-flow 列を使用、再生成時は差分件数も）+ draft note ファイルパス（`docs/project/screen-flow-url.draft.md`）案内
- **選択肢**（必ず「中止」と「その他（自由入力）」を末尾に含める。詳細は SKILL.md Step 4.5 処理 3 参照）:
  1. 承認 → drawio 書き出し開始
  2. 画面リスト修正 → 項目A に戻る
  3. エッジ修正 → 項目B に戻る
  4. トリガー文言修正 → 項目C に戻る
  5. layout_strategy 修正 → 項目D に戻る
  6. 共通画面修正 → 項目E に戻る
  7. エントリ指定修正 → 項目F に戻る
  8. フィールド直接修正（自由入力で `screens[<screen-name>].xxx = yyy` 形式、例: `screens[login].is_entry_point = true`）
  9. 中止 → `.draft.aborted.md` 退避して終了
  10. その他（自由入力）

### 7.8 修正フロー

ユーザー選択別の処理フロー:

- **項目戻り**: 該当ヒアリング項目（A〜F）を Step 4 から再実行 → 結果を draft note に Edit で反映 → Step 4.5 再表示
- **フィールド直接修正**: 自由入力指示を §7.4 識別子規約に従って解釈 → draft note を Edit で更新 → YAML 構文簡易 validate → Step 4.5 再表示（承認確認）
  - YAML 構文エラー時は AskUserQuestion で再入力依頼
  - 識別子規約違反（`screens[3]` のような index 指定）は明示エラーメッセージで案内
- **中止**: draft note を `<manifest-name>.draft.aborted.md` にリネーム（既存衝突時は `<manifest-name>.draft.aborted-YYYYMMDD-HHMMSS.md` の timestamp サフィックス付き名にフォールバック）→ Skill 終了。drawio ファイルは生成しない
- **承認**: draft note は保持したまま Step 5（drawio 書き出し）へ進む（Step 10 manifest 出力成功後に削除）

draft note ライフサイクル全体は `manifest-schema.md §8.2 ライフサイクル` 参照。
