#!/usr/bin/env python3
"""
Skillパッケージャー - Skillフォルダの配布可能な.skillファイルを作成

使用法:
    python package_skill.py <path/to/skill-folder> [output-directory]

例:
    python package_skill.py .claude/skills/einja-my-skill
    python package_skill.py .claude/skills/einja-my-skill ./dist
"""

import sys
import zipfile
from pathlib import Path
from quick_validate import validate_skill


def package_skill(skill_path, output_dir=None):
    """
    Skillフォルダを.skillファイルにパッケージ化

    Args:
        skill_path: Skillフォルダへのパス
        output_dir: .skillファイルのオプションの出力ディレクトリ（デフォルトは現在のディレクトリ）

    Returns:
        作成された.skillファイルへのパス、エラーの場合はNone
    """
    skill_path = Path(skill_path).resolve()

    # Skillフォルダが存在することを検証
    if not skill_path.exists():
        print(f"❌ エラー: Skillフォルダが見つかりません: {skill_path}")
        return None

    if not skill_path.is_dir():
        print(f"❌ エラー: パスはディレクトリではありません: {skill_path}")
        return None

    # SKILL.mdが存在することを検証
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"❌ エラー: {skill_path} にSKILL.mdが見つかりません")
        return None

    # パッケージ化前にバリデーションを実行
    print("🔍 Skillをバリデーション中...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"❌ バリデーション失敗: {message}")
        print("   パッケージ化前にバリデーションエラーを修正してください。")
        return None
    print(f"✅ {message}\n")

    # 出力場所を決定
    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd()

    skill_filename = output_path / f"{skill_name}.skill"

    # .skillファイル（zip形式）を作成
    try:
        with zipfile.ZipFile(skill_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Skillディレクトリを走査
            for file_path in skill_path.rglob('*'):
                if file_path.is_file():
                    # zip内の相対パスを計算
                    arcname = file_path.relative_to(skill_path.parent)
                    zipf.write(file_path, arcname)
                    print(f"  追加: {arcname}")

        print(f"\n✅ Skillを正常にパッケージ化しました: {skill_filename}")
        return skill_filename

    except Exception as e:
        print(f"❌ .skillファイル作成エラー: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("使用法: python package_skill.py <path/to/skill-folder> [output-directory]")
        print("\n例:")
        print("  python package_skill.py .claude/skills/einja-my-skill")
        print("  python package_skill.py .claude/skills/einja-my-skill ./dist")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"📦 Skillをパッケージ化中: {skill_path}")
    if output_dir:
        print(f"   出力ディレクトリ: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
