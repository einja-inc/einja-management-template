---
name: einja-hearing-sheet-creator
description: >-
  案件タイプ（Web/モバイル/AI/業務システム/EC）に応じた質問項目を自動生成し、
  Google スプレッドシート形式のヒアリングシートを作成する。
  スキル起動後にチャットで5問のキーヒアリングを実施し、回答を事前記入した状態でシートを作成する。
  プロジェクト概要・対象ユーザー・業務フロー・機能要望・非機能要件・外部連携・
  体制スケジュール・予算・デザイン・保守運用の10カテゴリを網羅し、
  案件タイプ別の追加質問を自動付加する。
  「ヒアリングシート作って」「要件定義シート作成」「ヒアリングシートを準備して」
  「hearing sheet」等で呼び出す。
user-invocable: true
metadata:
  author: einja-inc
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Write
  - Skill
---

# einja-hearing-sheet-creator — ヒアリングシート自動生成

## 概要

案件タイプに応じた質問項目を自動選択し、Google スプレッドシート形式のヒアリングシートを作成する。

スキル起動後にチャットで5問のキーヒアリングを実施し、その回答をスプレッドシートの対応する回答欄に事前記入した状態（淡いイエロー背景）で作成する。10の必須カテゴリ（プロジェクト概要〜保守運用）に加え、案件タイプ（Web/モバイル/AI/業務システム/EC）ごとの追加質問を自動付加する。

## Examples

- 「ヒアリングシート作って」
- 「Webアプリ案件のヒアリングシートを準備して」
- 「AIシステムの要件定義シート作成して」

## デザインポイント

| 要素 | 色・スタイル |
|------|------------|
| タイトル行 | ネイビー `#1B3A6B` / 白太字 / 14pt / A1:D1マージ / 中央揃え |
| ヘッダー行 | ダークスレート `#374151` / 白太字 / 中央揃え |
| カテゴリ行 | 淡いブルー `#EFF6FF` / ネイビー文字 / 太字 |
| 事前記入あり回答欄 | 淡いイエロー `#FFFBEB`（クライアントが「ここは埋まってる」と一目でわかる） |
| 先頭2行固定 | frozenRowCount: 2（スクロールしてもヘッダーが見える） |
| 列幅 | カテゴリ200 / 質問450 / 回答欄350 / 備考200 |

## ワークフロー

### Step 0: 前提チェック（自動実行）

gws CLI と認証状態を確認する。

```bash
which gws && gws sheets spreadsheets list --params '{"pageSize": 1}' 2>&1 | head -3
```

- `gws` が見つからない → Skill ツールで `einja-common:gws-setup` を呼び出してセットアップを完了させる
- 認証エラー（401）が発生した場合 → `einja-common:gws-meeting-scheduler` の「認証確認・自動リフレッシュ」手順に準じて再認証する

### Step 1: 基本情報の収集（AskUserQuestion）

AskUserQuestion で以下を2回に分けて確認する。

**1問目**: 案件タイプを選択してください

- Web（Webサイト・Webアプリ）: 企業サイト・LP・SaaSなどブラウザで使うシステム全般
- モバイル（iOS/Androidアプリ）: スマートフォン・タブレット向けのネイティブアプリ
- AI（AI機能・LLMシステム）: 生成AI・機械学習・データ分析・自動化が中心の案件
- 業務システム（社内システム・基幹）: 社内向けの管理・ワークフロー・基幹系システム
- EC（ECサイト・物販）: 商品販売・決済・在庫管理を含む電子商取引システム
- その他（汎用）: 上記に当てはまらない場合（10カテゴリ共通のみ使用）

**2問目**: プロジェクト名またはクライアント名をチャットで入力してください（シートのタイトルに使います）
- 選択肢は「入力する」1択でOK（ユーザーへの案内として提示する）

### Step 2: キーヒアリング（チャットで順番に質問）

AskUserQuestion を使わず、テキストで1問ずつチャットに質問して回答を待つ。全部で5問。

1. 「このプロジェクトの背景・目的を教えてください（ざっくりでOK）」
2. 「主な利用者は誰ですか？（例: 社内の営業担当、一般消費者 など）」
3. 「リリース目標時期はありますか？（例: 2026年9月、未定 など）」
4. 「予算感の目安を教えてください（ざっくりでOK、未定でも可）」
5. 「特に重視している機能・要件があれば教えてください」

各回答を `pre_answers` 辞書として保持する:

```python
pre_answers = {
    "background": "（ユーザー回答1）",
    "users": "（ユーザー回答2）",
    "release": "（ユーザー回答3）",
    "budget": "（ユーザー回答4）",
    "requirements": "（ユーザー回答5）",
}
```

### Step 3: 質問テンプレートの読み込み

`references/question-templates.md` を Read ツールで読み込む。

Step 1 で選択した案件タイプに対応する追加質問を特定する:
- Web → 「Web（Webサイト・Webアプリ）」セクションの追加質問
- モバイル → 「モバイル（iOS / Android アプリ）」セクション
- AI → 「AI（AI機能・LLMシステム）」セクション
- 業務システム → 「業務システム（社内システム・基幹システム）」セクション
- EC → 「EC（ECサイト・物販システム）」セクション
- その他 → 追加質問なし（共通10カテゴリのみ）

### Step 4: スプレッドシートの作成

#### 4-1. スプレッドシート作成

```bash
TITLE="ヒアリングシート_${PROJECT_NAME}"
CREATE_RESULT=$(gws sheets spreadsheets create --json "{\"properties\": {\"title\": \"$TITLE\"}}")
SHEET_ID=$(echo "$CREATE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['spreadsheetId'])")
echo "Sheet ID: $SHEET_ID"
```

#### 4-2. データ書き込みスクリプトの生成と実行

Write ツールで以下の Python スクリプトを `/tmp/hearing_write.py` に出力してから `Bash` で実行する。

**スクリプトの構造**:

```python
import json, subprocess, sys

SHEET_ID = "{Step 4-1 で取得した ID}"
PROJECT_NAME = "{Step 1 で取得したプロジェクト名}"
PARAMS = json.dumps({"spreadsheetId": SHEET_ID})

# Step 2 で収集した回答
pre_answers = {
    "background": "{ユーザー回答1}",
    "users": "{ユーザー回答2}",
    "release": "{ユーザー回答3}",
    "budget": "{ユーザー回答4}",
    "requirements": "{ユーザー回答5}",
}

# ---- データ構築 ----
# pre_answers の回答は以下の質問の回答欄に事前記入する:
#   カテゴリ「1. プロジェクト概要」の1問目 → pre_answers["background"]
#   カテゴリ「2. 対象ユーザー」の1問目 → pre_answers["users"]
#   カテゴリ「7. 体制・スケジュール」の1問目 → pre_answers["release"]
#   カテゴリ「8. 予算感」の1問目 → pre_answers["budget"]
#   カテゴリ「4. 機能要望」の1問目 → pre_answers["requirements"]

rows = [
    # 行0: タイトル行（A列のみ値を入れ、後でA1:D1をマージ）
    [f"ヒアリングシート｜{PROJECT_NAME}", "", "", ""],
    # 行1: ヘッダー行
    ["カテゴリ", "質問", "回答欄", "備考・補足"],
]

# question-templates.md の内容を展開（4列: カテゴリ名 / 質問 / 回答 / ""）
categories = [
    ("1. プロジェクト概要", [
        ("このプロジェクトの背景・きっかけを教えてください", pre_answers["background"]),
        ("プロジェクトの目的・達成したいゴールを教えてください", ""),
        ("プロジェクトが成功した状態とはどのような状態ですか？", ""),
        ("類似の取り組みや過去の経緯はありますか？", ""),
        ("このプロジェクトを進める上での制約・前提条件はありますか？", ""),
        # ※ AI案件の場合: question-templates.md の「AI追加質問（プロジェクト概要）」をここに展開する
    ]),
    ("2. 対象ユーザー", [
        ("主な利用者はどのような方ですか？（社内/社外、職種など）", pre_answers["users"]),
        ("利用規模（ユーザー数・同時接続数の見込み）を教えてください", ""),
        ("利用環境（PC・スマートフォン・タブレット）の比率はどのくらいですか？", ""),
        ("ITリテラシーの高さ（操作に慣れているか）を教えてください", ""),
        ("ユーザーが利用する場所・状況（社内のみ／外出先など）を教えてください", ""),
        # ※ モバイル案件の場合: question-templates.md の「モバイル追加質問（対象ユーザー）」をここに展開する
        # ※ 業務システム案件の場合: question-templates.md の「業務システム追加質問（対象ユーザー）」をここに展開する
    ]),
    ("3. 業務フロー", [
        ("現在の業務の流れ（手順）を教えてください", ""),
        ("現状で最も困っている・時間がかかっている部分はどこですか？", ""),
        ("改善したい業務プロセスを具体的に教えてください", ""),
        ("現在使用しているツール・システムは何ですか？", ""),
        ("業務に関わる部署・担当者は何名くらいいますか？", ""),
    ]),
    ("4. 機能要望", [
        ("絶対に必要な機能（必須）を教えてください", pre_answers["requirements"]),
        ("あれば嬉しい機能（希望）を教えてください", ""),
        ("参考にしたいサービス・システムはありますか？（URL等）", ""),
        ("優先度をつけるとしたら、最初に実現したい機能はどれですか？", ""),
        ("将来的に追加したい機能・拡張の方向性はありますか？", ""),
        # ※ Web案件の場合: question-templates.md の「Web追加質問（機能要望）」をここに展開する
        # ※ モバイル案件の場合: question-templates.md の「モバイル追加質問（機能要望）」をここに展開する
        # ※ 業務システム案件の場合: question-templates.md の「業務システム追加質問（機能要望）」をここに展開する
        # ※ EC案件の場合: question-templates.md の「EC追加質問（機能要望）」をここに展開する
    ]),
    ("5. 非機能要件", [
        ("応答速度・処理性能への期待値はありますか？（例：3秒以内）", ""),
        ("セキュリティ要件はありますか？（認証方式・暗号化・アクセス制限など）", ""),
        ("可用性・稼働率への期待値はありますか？（例：99.9%）", ""),
        ("取り扱うデータの機密性・個人情報の有無を教えてください", ""),
        ("対応が必要なブラウザ・OS・端末のバージョン制約はありますか？", ""),
        # ※ Web案件の場合: question-templates.md の「Web追加質問（非機能要件）」をここに展開する
        # ※ AI案件の場合: question-templates.md の「AI追加質問（非機能要件）」をここに展開する
    ]),
    ("6. 外部連携", [
        ("連携が必要な既存システム・サービスはありますか？", ""),
        ("APIやデータ連携の仕様書・ドキュメントはありますか？", ""),
        ("既存システムからのデータ移行は必要ですか？", ""),
        ("データ移行が必要な場合、件数・形式・品質を教えてください", ""),
        ("外部サービス（決済・認証・通知など）の利用予定はありますか？", ""),
        # ※ EC案件の場合: question-templates.md の「EC追加質問（外部連携）」をここに展開する
    ]),
    ("7. 体制・スケジュール", [
        ("希望リリース日・稼働開始時期を教えてください", pre_answers["release"]),
        ("プロジェクトの最終決裁者はどなたですか？", ""),
        ("プロジェクト推進の社内担当者を教えてください", ""),
        ("検収・受け入れのプロセスを教えてください", ""),
        ("他のステークホルダー（関係部署・外部ベンダーなど）はいますか？", ""),
        # ※ モバイル案件の場合: question-templates.md の「モバイル追加質問（体制・スケジュール）」をここに展開する
    ]),
    ("8. 予算感", [
        ("概算予算の目安を教えてください", pre_answers["budget"]),
        ("初期費用・月額費用のどちらを重視しますか？", ""),
        ("他社からも見積を取る予定はありますか？（相見積）", ""),
        ("予算の決裁は誰が行いますか？", ""),
        ("費用対効果として重視するポイントを教えてください", ""),
    ]),
    ("9. デザイン要件", [
        ("ブランドガイドライン・デザインガイドラインはありますか？", ""),
        ("参考にしたいサイト・アプリのデザインはありますか？（URL等）", ""),
        ("コーポレートカラーやロゴの使用ルールを教えてください", ""),
        ("デザインの方向性（シンプル・スタイリッシュ・親しみやすいなど）", ""),
        ("既存のUI素材・アイコン・画像素材の流用予定はありますか？", ""),
    ]),
    ("10. 保守運用", [
        ("リリース後の保守・運用体制を教えてください（社内対応／外注）", ""),
        ("障害発生時の対応時間の期待値（SLA）はありますか？", ""),
        ("システムの監視・アラート通知は必要ですか？", ""),
        ("定期メンテナンス・バージョンアップへの対応方針を教えてください", ""),
        ("ドキュメント（操作マニュアル・管理者向け手順書）は必要ですか？", ""),
    ]),
]

# 事前記入ありの行インデックスを記録（書式設定で黄色背景にする）
pre_filled_row_indices = []
category_row_indices = []
current_row = 2  # 行0・1 はタイトル/ヘッダー済み

for cat_name, questions in categories:
    category_row_indices.append(current_row)
    rows.append([cat_name, "", "", ""])
    current_row += 1
    for q_text, answer in questions:
        rows.append(["", q_text, answer, ""])
        if answer:
            pre_filled_row_indices.append(current_row)
        current_row += 1

total_rows = len(rows)

# ---- データ書き込み ----
batch_body = json.dumps({
    "valueInputOption": "RAW",
    "data": [{"range": f"シート1!A1:D{total_rows}", "values": rows}]
})
r = subprocess.run(
    ["gws", "sheets", "spreadsheets", "values", "batchUpdate",
     "--params", PARAMS, "--json", batch_body],
    capture_output=True, text=True
)
if r.returncode != 0:
    print("ERROR:", r.stderr[:300]); sys.exit(1)
print("✅ データ書き込み完了")

# ---- 書式設定（モダンデザイン） ----
requests = []

# ---- タイトル行 (row 0) ----
# セル結合 A1:D1
requests.append({"mergeCells": {
    "range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1,
              "startColumnIndex": 0, "endColumnIndex": 4},
    "mergeType": "MERGE_ALL"
}})
# タイトル行スタイル: ネイビー背景 (#1B3A6B) / 白太字 / 中央揃え / 14pt
requests.append({"repeatCell": {
    "range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1},
    "cell": {"userEnteredFormat": {
        "textFormat": {"bold": True, "fontSize": 14,
                       "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}},
        "backgroundColor": {"red": 0.106, "green": 0.227, "blue": 0.42},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE"
    }},
    "fields": "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
}})

# ---- ヘッダー行 (row 1) ----
# ヘッダー: ダークスレート (#374151) / 白太字 / 中央揃え
requests.append({"repeatCell": {
    "range": {"sheetId": 0, "startRowIndex": 1, "endRowIndex": 2},
    "cell": {"userEnteredFormat": {
        "textFormat": {"bold": True, "fontSize": 10,
                       "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}},
        "backgroundColor": {"red": 0.216, "green": 0.255, "blue": 0.318},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE"
    }},
    "fields": "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
}})

# ---- ヘッダー2行を固定 ----
requests.append({"updateSheetProperties": {
    "properties": {"sheetId": 0, "gridProperties": {"frozenRowCount": 2}},
    "fields": "gridProperties.frozenRowCount"
}})

# ---- カテゴリ行: 淡いネイビー (#EFF6FF) / ネイビー文字 / 太字 ----
for idx in category_row_indices:
    requests.append({"repeatCell": {
        "range": {"sheetId": 0, "startRowIndex": idx, "endRowIndex": idx + 1},
        "cell": {"userEnteredFormat": {
            "textFormat": {"bold": True, "fontSize": 10,
                           "foregroundColor": {"red": 0.106, "green": 0.227, "blue": 0.42}},
            "backgroundColor": {"red": 0.937, "green": 0.961, "blue": 1.0}
        }},
        "fields": "userEnteredFormat(textFormat,backgroundColor)"
    }})

# ---- 事前記入ありの回答欄 (C列): 淡い黄色 (#FFFBEB) ----
for idx in pre_filled_row_indices:
    requests.append({"repeatCell": {
        "range": {"sheetId": 0, "startRowIndex": idx, "endRowIndex": idx + 1,
                  "startColumnIndex": 2, "endColumnIndex": 3},
        "cell": {"userEnteredFormat": {
            "backgroundColor": {"red": 1.0, "green": 0.988, "blue": 0.922},
            "wrapStrategy": "WRAP"
        }},
        "fields": "userEnteredFormat(backgroundColor,wrapStrategy)"
    }})

# ---- 列幅: カテゴリ200 / 質問450 / 回答欄350 / 備考200 ----
for i, width in enumerate([200, 450, 350, 200]):
    requests.append({"updateDimensionProperties": {
        "range": {"sheetId": 0, "dimension": "COLUMNS",
                  "startIndex": i, "endIndex": i + 1},
        "properties": {"pixelSize": width}, "fields": "pixelSize"
    }})

# ---- 行の高さ ----
# タイトル行: 44px
requests.append({"updateDimensionProperties": {
    "range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
    "properties": {"pixelSize": 44}, "fields": "pixelSize"
}})
# ヘッダー行: 32px
requests.append({"updateDimensionProperties": {
    "range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 1, "endIndex": 2},
    "properties": {"pixelSize": 32}, "fields": "pixelSize"
}})
# その他: 28px
requests.append({"updateDimensionProperties": {
    "range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 2, "endIndex": total_rows},
    "properties": {"pixelSize": 28}, "fields": "pixelSize"
}})

# ---- 回答欄（C列）折り返し（事前記入なしの行も含む） ----
requests.append({"repeatCell": {
    "range": {"sheetId": 0, "startRowIndex": 2, "endRowIndex": total_rows,
              "startColumnIndex": 2, "endColumnIndex": 3},
    "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP"}},
    "fields": "userEnteredFormat(wrapStrategy)"
}})

# ---- 枠線 ----
requests.append({"updateBorders": {
    "range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": total_rows,
              "startColumnIndex": 0, "endColumnIndex": 4},
    "top": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
    "bottom": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
    "left": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
    "right": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
    "innerHorizontal": {"style": "SOLID",
                        "color": {"red": 0.9, "green": 0.9, "blue": 0.9}},
    "innerVertical": {"style": "SOLID",
                      "color": {"red": 0.9, "green": 0.9, "blue": 0.9}},
}})

r2 = subprocess.run(
    ["gws", "sheets", "spreadsheets", "batchUpdate",
     "--params", PARAMS, "--json", json.dumps({"requests": requests})],
    capture_output=True, text=True
)
if r2.returncode != 0:
    print("ERROR:", r2.stderr[:300]); sys.exit(1)
print("✅ 書式設定完了")

# ---- 共有設定（リンクを知っている人が編集可） ----
r3 = subprocess.run(
    ["gws", "drive", "permissions", "create",
     "--params", json.dumps({"fileId": SHEET_ID}),
     "--json", json.dumps({"role": "writer", "type": "anyone"})],
    capture_output=True, text=True
)
if r3.returncode != 0:
    print("WARNING 共有設定失敗:", r3.stderr[:200])
    print("手動で共有設定してください")
else:
    print("✅ 共有設定完了")

print(f"\n📊 スプレッドシート完成:")
print(f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
```

このスクリプトを Write ツールで `/tmp/hearing_write.py` に保存し、Bash で実行する:

```bash
python3 /tmp/hearing_write.py
```

### Step 5: 完了報告

```
📊 ヒアリングシートが完成しました
URL: https://docs.google.com/spreadsheets/d/.../edit

事前記入済み（黄色セル）: 5件
  - プロジェクト背景・目的
  - 対象ユーザー
  - リリース目標時期
  - 予算感
  - 重視する機能・要件

残り質問数: XX問（回答欄は空のまま）

このシートをクライアントに送付して事前記入をお願いするか、
商談当日に画面共有しながら一緒に埋めていってください。
```

## エラーリカバリ

| エラー | 対応 |
|--------|------|
| gws 未インストール | `einja-common:gws-setup` を呼び出してセットアップ |
| 認証エラー（401） | `gws-meeting-scheduler` の再認証手順に準拠して再認証 |
| spreadsheets create 失敗 | エラーログを表示して再試行1回。再試行も失敗 → CSV フォールバックへ |
| values batchUpdate 失敗 | エラーログを表示して再試行1回。再試行も失敗 → CSV フォールバックへ |
| 共有設定失敗 | シートは作成済みのため URL を案内し「手動で共有設定してください」と案内 |

## CSV フォールバック

gws CLI が利用できない・認証できない場合は CSV ファイルをローカルに出力する:

```python
import csv
from datetime import datetime

output = f"{PROJECT_NAME}_ヒアリングシート_{datetime.now().strftime('%Y%m%d')}.csv"

with open(output, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["カテゴリ", "質問", "回答欄", "備考・補足"])
    for cat_name, questions in categories:
        writer.writerow([cat_name, "", "", ""])
        for q_text, answer in questions:
            writer.writerow(["", q_text, answer, ""])

print(f"📄 CSV 出力: {output}")
print("Google スプレッドシートへのインポート手順:")
print("  1. Google スプレッドシートを新規作成")
print("  2. ファイル → インポート → アップロード → 上記CSVファイルを選択")
print("  3. 区切り文字: カンマ を選択してインポート")
```

## Additional Resources

- **`references/question-templates.md`** — 共通10カテゴリの質問リスト + 案件タイプ別追加質問
- 動作確認済みシート（テスト）: https://docs.google.com/spreadsheets/d/167NTTct9JnveQBlz_vSzJvmhCXmMPzMvohLrj35NFUM/edit
