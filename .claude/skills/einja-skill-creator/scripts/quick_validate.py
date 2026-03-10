#!/usr/bin/env python3
"""
Skillの簡易バリデーションスクリプト - 最小バージョン
"""

import sys
import os
import re
import yaml
from pathlib import Path

def validate_skill(skill_path):
    """Skillの基本バリデーション"""
    skill_path = Path(skill_path)

    # SKILL.mdの存在を確認
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.mdが見つかりません"

    # フロントマターの読み込みと検証
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "YAMLフロントマターが見つかりません"

    # フロントマターの抽出
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "無効なフロントマター形式"

    frontmatter_text = match.group(1)

    # YAMLフロントマターのパース
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "フロントマターはYAML辞書である必要があります"
    except yaml.YAMLError as e:
        return False, f"フロントマターの無効なYAML: {e}"

    # 許可されたプロパティを定義
    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility', 'user-invocable', 'user_invocable', 'invocation'}

    # 予期しないプロパティを確認（metadata配下のネストされたキーを除く）
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"SKILL.mdフロントマターに予期しないキー: {', '.join(sorted(unexpected_keys))}。"
            f"許可されたプロパティ: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # 必須フィールドの確認
    if 'name' not in frontmatter:
        return False, "フロントマターに'name'がありません"
    if 'description' not in frontmatter:
        return False, "フロントマターに'description'がありません"

    # バリデーション用にnameを抽出
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Nameは文字列である必要があります。{type(name).__name__}が指定されました"
    name = name.strip()
    if name:
        # 命名規則をチェック（ケバブケース: 小文字、ハイフンのみ）
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"Name '{name}' はケバブケース（小文字、数字、ハイフンのみ）である必要があります"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"Name '{name}' はハイフンで始まる/終わる、または連続したハイフンを含めません"
        # 名前の長さをチェック（仕様に従い最大64文字）
        if len(name) > 64:
            return False, f"Nameが長すぎます（{len(name)}文字）。最大64文字です。"

        # セキュリティ: 予約語チェック
        if 'claude' in name.lower() or 'anthropic' in name.lower():
            return False, f"Name '{name}' に予約語が含まれています。'claude'や'anthropic'をSkill名に使用することはできません"

        # einja固有: einja-プレフィックスの推奨（警告レベル）
        if not name.startswith('einja-'):
            print(f"⚠️  警告: einjaプロジェクトでは 'einja-' プレフィックスを推奨します（現在: '{name}'）")

    # descriptionを抽出・検証
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Descriptionは文字列である必要があります。{type(description).__name__}が指定されました"
    description = description.strip()
    if description:
        # 山括弧を確認
        if '<' in description or '>' in description:
            return False, "Descriptionには山括弧（<または>）を含められません"
        # descriptionの長さをチェック（仕様に従い最大1024文字）
        if len(description) > 1024:
            return False, f"Descriptionが長すぎます（{len(description)}文字）。最大1024文字です。"

    # compatibilityフィールドが存在する場合に検証（オプション）
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"Compatibilityは文字列である必要があります。{type(compatibility).__name__}が指定されました"
        if len(compatibility) > 500:
            return False, f"Compatibilityが長すぎます（{len(compatibility)}文字）。最大500文字です。"

    # einja固有: SKILL.mdの行数チェック（500行以内推奨）
    line_count = len(content.split('\n'))
    if line_count > 500:
        print(f"⚠️  警告: SKILL.mdが500行を超えています（{line_count}行）。コンテンツをreferenceファイルに分割することを検討してください。")

    # 本文の語数チェック（5,000語超は警告）
    # フロントマター以降の本文を抽出
    body_match = re.match(r'^---\n.*?\n---\n?(.*)', content, re.DOTALL)
    if body_match:
        body_text = body_match.group(1)
        # 日本語と英語の両方に対応（簡易的な語数カウント）
        # 英語: スペース区切り、日本語: 文字数ベース（1文字≈0.5語として概算）
        word_count = len(body_text.split())
        if word_count > 5000:
            print(f"⚠️  警告: SKILL.md本文が5,000語を超えています（約{word_count}語）。コンテンツをreferenceファイルに分割することを推奨します。")

    # einja固有: references/ディレクトリ名チェック（reference/は警告）
    reference_dir = skill_path / 'reference'
    if reference_dir.exists():
        print(f"⚠️  警告: 'reference/'ディレクトリが見つかりました。公式仕様に準拠し 'references/'（複数形）を使用してください。")

    return True, "Skillは有効です！"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使用法: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
