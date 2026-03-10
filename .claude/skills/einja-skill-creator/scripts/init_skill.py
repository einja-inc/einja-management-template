#!/usr/bin/env python3
"""
Skill初期化スクリプト - テンプレートから新しいSkillを作成

使用法:
    init_skill.py <skill-name> --path <output-directory>

例:
    init_skill.py einja-my-new-skill --path .claude/skills
    init_skill.py einja-api-helper --path .claude/skills
    init_skill.py custom-skill --path /custom/location
"""

import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: このSkillが何をするか、いつ使用すべきかについての完全かつ有益な説明。3要素公式を使用: [What it does] + [When to use it] + [Key capabilities]。特定のシナリオ、ファイルタイプ、またはトリガーとなるタスクを含めてください。類似Skillがあれば Do NOT use for: で除外条件も記述。]
# metadata:        # オプション: 必要に応じてコメントを外す
#   author: your-team
#   version: 1.0.0
# allowed-tools:   # オプション: ツール制限が必要な場合
#   - Read
#   - Edit
---

# {skill_title}

## 概要

[TODO: このSkillが可能にすることについての1-2文の説明]

## Skillの構造化

[TODO: このSkillの目的に最適な構造を選択してください。一般的なパターン:

**1. ワークフローベース**（順次プロセスに最適）
- 明確なステップバイステップの手順がある場合に適している
- 例: DOCXスキルの「ワークフロー決定ツリー」→「読み込み」→「作成」→「編集」
- 構造: ## 概要 → ## ワークフロー決定ツリー → ## ステップ1 → ## ステップ2...

**2. タスクベース**（ツールコレクションに最適）
- Skillが異なる操作/機能を提供する場合に適している
- 例: PDFスキルの「クイックスタート」→「PDFを結合」→「PDFを分割」→「テキストを抽出」
- 構造: ## 概要 → ## クイックスタート → ## タスクカテゴリ1 → ## タスクカテゴリ2...

**3. リファレンス/ガイドライン**（標準や仕様に最適）
- ブランドガイドライン、コーディング規約、要件に適している
- 例: ブランドスタイリングの「ブランドガイドライン」→「カラー」→「タイポグラフィ」→「機能」
- 構造: ## 概要 → ## ガイドライン → ## 仕様 → ## 使用方法...

**4. 機能ベース**（統合システムに最適）
- Skillが複数の関連機能を提供する場合に適している
- 例: プロダクト管理の「コア機能」→ 番号付き機能リスト
- 構造: ## 概要 → ## コア機能 → ### 1. 機能 → ### 2. 機能...

パターンは必要に応じて混在させて使用できます。ほとんどのSkillはパターンを組み合わせます（例: タスクベースで始め、複雑な操作にはワークフローを追加）。

完了したら、この「Skillの構造化」セクション全体を削除してください - これは単なるガイダンスです。]

## [TODO: 選択した構造に基づいて最初のメインセクションに置き換えてください]

[TODO: ここにコンテンツを追加してください。既存のSkillの例を参照:
- 技術的なSkillのためのコードサンプル
- 複雑なワークフローのための決定ツリー
- 現実的なユーザーリクエストを含む具体例
- 必要に応じてscripts/templates/referencesへの参照]

## リソース

このSkillには、異なるタイプのバンドルリソースをどのように整理するかを示す例のリソースディレクトリが含まれています：

### scripts/
特定の操作を実行するために直接実行できる実行可能コード（Python/Bash等）。

**他のSkillからの例:**
- PDFスキル: `fill_fillable_fields.py`, `extract_form_field_info.py` - PDF操作のためのユーティリティ
- DOCXスキル: `document.py`, `utilities.py` - ドキュメント処理のためのPythonモジュール

**適切な用途:** Pythonスクリプト、シェルスクリプト、または自動化、データ処理、特定の操作を実行する実行可能コード。

**注意:** スクリプトはコンテキストに読み込まずに実行できますが、パッチや環境調整のためにClaudeによって読まれる場合があります。

例のリソースディレクトリを作成：`scripts/`、`references/`、`assets/`

### references/
Claudeの処理と思考を導くためにコンテキストに読み込まれることを意図したドキュメントと参照資料。

**他のSkillからの例:**
- プロダクト管理: `communication.md`, `context_building.md` - 詳細なワークフローガイド
- BigQuery: APIリファレンスドキュメントとクエリ例
- 財務: スキーマドキュメント、会社ポリシー

**適切な用途:** 詳細なドキュメント、APIリファレンス、データベーススキーマ、包括的なガイド、またはClaudeが作業中に参照すべき詳細情報。

### assets/
コンテキストに読み込まれることを意図せず、Claudeが生成する出力で使用されるファイル。

**他のSkillからの例:**
- ブランドスタイリング: PowerPointテンプレートファイル (.pptx), ロゴファイル
- フロントエンドビルダー: HTML/Reactボイラープレートプロジェクトディレクトリ
- タイポグラフィ: フォントファイル (.ttf, .woff2)

**適切な用途:** テンプレート、ボイラープレートコード、ドキュメントテンプレート、画像、アイコン、フォント、または最終出力でコピーまたは使用されるファイル。

---

**不要なディレクトリは削除できます。** すべてのSkillが3種類のリソースすべてを必要とするわけではありません。

## Troubleshooting

### よくある問題

| 症状 | 原因 | 対処法 |
|------|------|--------|
| Skillがトリガーされない | descriptionが曖昧/不十分 | 3要素公式でdescriptionを改善 |
| 意図しないクエリでトリガーされる | descriptionが広すぎる | ネガティブトリガー（Do NOT use for）を追加 |
| 出力品質が不安定 | 指示が曖昧 | 具体例を追加し、出力フォーマットを明示 |
| コンテキストが大きすぎる | SKILL.md本文が肥大化 | referenceファイルに分割（段階的開示） |

<!-- @einja:excluded:start -->
## プロジェクト固有セクションの記入

SKILL.md等のmdファイルの末尾には以下を記入する:

<!-- @einja:project-private:start id="unique-id" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
<!-- @einja:excluded:end -->

---

<!-- @einja:project-private:start id="{skill_name}-project" -->
## プロジェクト固有の設定

<!-- このセクションはプロジェクト固有の内容を追記する場所です -->
<!-- einja syncで上書きされません -->
<!-- @einja:project-private:end -->
"""

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
{skill_name}のための例のヘルパースクリプト

これは直接実行できるプレースホルダースクリプトです。
実際の実装に置き換えるか、不要な場合は削除してください。

他のSkillからの実際のスクリプト例:
- pdf/scripts/fill_fillable_fields.py - PDFフォームフィールドに入力
- pdf/scripts/convert_pdf_to_images.py - PDFページを画像に変換
"""

def main():
    print("これは{skill_name}の例のスクリプトです")
    # TODO: ここに実際のスクリプトロジックを追加
    # これはデータ処理、ファイル変換、API呼び出し等です。

if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# {skill_title}のリファレンスドキュメント

これは詳細なリファレンスドキュメントのプレースホルダーです。
実際のリファレンスコンテンツに置き換えるか、不要な場合は削除してください。

他のSkillからの実際のリファレンスドキュメント例:
- product-management/reference/communication.md - ステータス更新のための包括的なガイド
- product-management/reference/context_building.md - コンテキスト収集の深掘り
- bigquery/reference/ - APIリファレンスとクエリ例

## リファレンスドキュメントが有用な場合

リファレンスドキュメントは以下に最適:
- 包括的なAPIドキュメント
- 詳細なワークフローガイド
- 複雑な複数ステップのプロセス
- メインのSKILL.mdには長すぎる情報
- 特定のユースケースにのみ必要なコンテンツ

## 構造の提案

### APIリファレンスの例
- 概要
- 認証
- 例付きエンドポイント
- エラーコード
- レート制限

### ワークフローガイドの例
- 前提条件
- ステップバイステップの指示
- 一般的なパターン
- トラブルシューティング
- ベストプラクティス
"""

EXAMPLE_ASSET = """# 例のアセットファイル

このプレースホルダーは、アセットファイルが保存される場所を表しています。
実際のアセットファイル（テンプレート、画像、フォント等）に置き換えるか、不要な場合は削除してください。

アセットファイルはコンテキストに読み込まれることを意図せず、Claudeが生成する
出力で使用されます。

他のSkillからの例のアセットファイル:
- ブランドガイドライン: logo.png, slides_template.pptx
- フロントエンドビルダー: HTML/Reactボイラープレートを含むhello-world/ディレクトリ
- タイポグラフィ: custom-font.ttf, font-family.woff2
- データ: sample_data.csv, test_dataset.json

## 一般的なアセットタイプ

- テンプレート: .pptx, .docx, ボイラープレートディレクトリ
- 画像: .png, .jpg, .svg, .gif
- フォント: .ttf, .otf, .woff, .woff2
- ボイラープレートコード: プロジェクトディレクトリ、スターターファイル
- アイコン: .ico, .svg
- データファイル: .csv, .json, .xml, .yaml

注意: これはテキストプレースホルダーです。実際のアセットは任意のファイルタイプにできます。
"""


def title_case_skill_name(skill_name):
    """ハイフン区切りのスキル名を表示用のタイトルケースに変換"""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path):
    """
    テンプレートSKILL.mdを含む新しいSkillディレクトリを初期化

    Args:
        skill_name: Skillの名前
        path: Skillディレクトリを作成するパス

    Returns:
        作成されたSkillディレクトリへのパス、エラーの場合はNone
    """
    # Skillディレクトリパスを決定
    skill_dir = Path(path).resolve() / skill_name

    # ディレクトリがすでに存在するか確認
    if skill_dir.exists():
        print(f"❌ エラー: Skillディレクトリはすでに存在します: {skill_dir}")
        return None

    # Skillディレクトリを作成
    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"✅ Skillディレクトリを作成しました: {skill_dir}")
    except Exception as e:
        print(f"❌ ディレクトリ作成エラー: {e}")
        return None

    # テンプレートからSKILL.mdを作成
    skill_title = title_case_skill_name(skill_name)
    skill_content = SKILL_TEMPLATE.format(
        skill_name=skill_name,
        skill_title=skill_title
    )

    skill_md_path = skill_dir / 'SKILL.md'
    try:
        skill_md_path.write_text(skill_content)
        print("✅ SKILL.mdを作成しました")
    except Exception as e:
        print(f"❌ SKILL.md作成エラー: {e}")
        return None

    # 例のファイルを含むリソースディレクトリを作成
    try:
        # 例のスクリプトを含むscripts/ディレクトリを作成
        scripts_dir = skill_dir / 'scripts'
        scripts_dir.mkdir(exist_ok=True)
        example_script = scripts_dir / 'example.py'
        example_script.write_text(EXAMPLE_SCRIPT.format(skill_name=skill_name))
        example_script.chmod(0o755)
        print("✅ scripts/example.pyを作成しました")

        # 例のリファレンスドキュメントを含むreferences/ディレクトリを作成
        reference_dir = skill_dir / 'references'
        reference_dir.mkdir(exist_ok=True)
        example_reference = reference_dir / 'api_reference.md'
        example_reference.write_text(EXAMPLE_REFERENCE.format(skill_title=skill_title))
        print("✅ references/api_reference.mdを作成しました")

        # 例のアセットプレースホルダーを含むassets/ディレクトリを作成
        assets_dir = skill_dir / 'assets'
        assets_dir.mkdir(exist_ok=True)
        example_asset = assets_dir / 'example_asset.txt'
        example_asset.write_text(EXAMPLE_ASSET)
        print("✅ assets/example_asset.txtを作成しました")
    except Exception as e:
        print(f"❌ リソースディレクトリ作成エラー: {e}")
        return None

    # 次のステップを表示
    print(f"\n✅ Skill '{skill_name}' を {skill_dir} に初期化しました")
    print("\n次のステップ:")
    print("1. SKILL.mdを編集してTODO項目を完了し、descriptionを更新")
    print("2. scripts/、references/、assets/の例のファイルをカスタマイズまたは削除")
    print("3. 準備ができたら、バリデータを実行してSkill構造を確認")

    return skill_dir


def main():
    if len(sys.argv) < 4 or sys.argv[2] != '--path':
        print("使用法: init_skill.py <skill-name> --path <path>")
        print("\nSkill名の要件:")
        print("  - ケバブケース識別子（例: 'my-data-analyzer'）")
        print("  - 小文字、数字、ハイフンのみ")
        print("  - 最大64文字")
        print("  - ディレクトリ名と正確に一致する必要があります")
        print("\neinja固有:")
        print("  - einjaプロジェクトでは 'einja-' プレフィックスを推奨")
        print("  - references/ディレクトリは複数形（公式仕様準拠）")
        print("\n例:")
        print("  init_skill.py einja-my-new-skill --path .claude/skills")
        print("  init_skill.py einja-api-helper --path .claude/skills")
        print("  init_skill.py custom-skill --path /custom/location")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]

    print(f"🚀 Skillを初期化中: {skill_name}")
    print(f"   場所: {path}")
    print()

    result = init_skill(skill_name, path)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
