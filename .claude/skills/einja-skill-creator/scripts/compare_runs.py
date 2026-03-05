#!/usr/bin/env python3
"""複数スキルのベンチマーク結果を集約。

複数のrun_loop.py出力を受け取り、全スキルのスコアを
サマリーテーブルとして表示する。
"""

import argparse
import json
import sys
from pathlib import Path


def aggregate_results(result_files: list[str]) -> dict:
    """複数のrun_loop.py出力ファイルを集約する。"""
    skills = []

    for filepath in result_files:
        try:
            data = json.loads(Path(filepath).read_text())
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"警告: {filepath} の読み込みに失敗しました: {e}", file=sys.stderr)
            continue

        history = data.get("history", [])
        if not history:
            print(f"警告: {filepath} に履歴がありません", file=sys.stderr)
            continue

        # 最良のイテレーションを見つける（テスト > トレーニングで優先）
        best_idx = 0
        best_test = -1
        best_train = -1
        for i, h in enumerate(history):
            t_passed = h.get("test_passed", -1)
            tr_passed = h.get("train_passed", h.get("passed", 0))
            if t_passed > best_test or (t_passed == best_test and tr_passed > best_train):
                best_test = t_passed
                best_train = tr_passed
                best_idx = i

        best = history[best_idx]
        original = history[0]

        skill_entry = {
            "skill_name": data.get("skill_name", Path(filepath).stem),
            "file": filepath,
            "iterations": len(history),
            "best_iteration": best_idx,
            "original_description": data.get("original_description", ""),
            "best_description": best.get("description", ""),
            "original_train_score": f"{original.get('train_passed', original.get('passed', 0))}/{original.get('train_total', original.get('total', 0))}",
            "best_train_score": f"{best.get('train_passed', best.get('passed', 0))}/{best.get('train_total', best.get('total', 0))}",
            "original_train_passed": original.get("train_passed", original.get("passed", 0)),
            "original_train_total": original.get("train_total", original.get("total", 0)),
            "best_train_passed": best.get("train_passed", best.get("passed", 0)),
            "best_train_total": best.get("train_total", best.get("total", 0)),
        }

        # テストスコア（存在する場合）
        if best.get("test_passed") is not None:
            skill_entry["original_test_score"] = f"{original.get('test_passed', '?')}/{original.get('test_total', '?')}"
            skill_entry["best_test_score"] = f"{best.get('test_passed', '?')}/{best.get('test_total', '?')}"
            skill_entry["best_test_passed"] = best.get("test_passed", 0)
            skill_entry["best_test_total"] = best.get("test_total", 0)

        skills.append(skill_entry)

    # トレーニングスコアでソート（降順）
    skills.sort(
        key=lambda s: (
            s.get("best_test_passed", 0) / max(s.get("best_test_total", 1), 1),
            s["best_train_passed"] / max(s["best_train_total"], 1),
        ),
        reverse=True,
    )

    # 全体サマリーの計算
    total_train_passed = sum(s["best_train_passed"] for s in skills)
    total_train_total = sum(s["best_train_total"] for s in skills)
    total_test_passed = sum(s.get("best_test_passed", 0) for s in skills if "best_test_passed" in s)
    total_test_total = sum(s.get("best_test_total", 0) for s in skills if "best_test_total" in s)

    return {
        "skills": skills,
        "summary": {
            "total_skills": len(skills),
            "total_train_passed": total_train_passed,
            "total_train_total": total_train_total,
            "total_train_score": f"{total_train_passed}/{total_train_total}",
            "total_test_passed": total_test_passed,
            "total_test_total": total_test_total,
            "total_test_score": f"{total_test_passed}/{total_test_total}" if total_test_total > 0 else None,
        },
    }


def print_table(aggregated: dict, verbose: bool = False) -> None:
    """集約結果をテーブル形式でstderrに出力する。"""
    skills = aggregated["skills"]
    summary = aggregated["summary"]

    has_test = any("best_test_score" in s for s in skills)

    # ヘッダー
    header = f"{'スキル名':<30} {'トレーニング(元)':<14} {'トレーニング(最良)':<14}"
    if has_test:
        header += f" {'テスト(元)':<12} {'テスト(最良)':<12}"
    header += f" {'回数':<6} {'最良回':<6}"
    print(header, file=sys.stderr)
    print("-" * len(header), file=sys.stderr)

    # 各スキル
    for s in skills:
        line = f"{s['skill_name']:<30} {s['original_train_score']:<14} {s['best_train_score']:<14}"
        if has_test:
            orig_test = s.get("original_test_score", "-")
            best_test = s.get("best_test_score", "-")
            line += f" {orig_test:<12} {best_test:<12}"
        line += f" {s['iterations']:<6} {s['best_iteration']:<6}"
        print(line, file=sys.stderr)

        if verbose:
            print(f"  オリジナル: {s['original_description'][:80]}...", file=sys.stderr)
            print(f"  最良:       {s['best_description'][:80]}...", file=sys.stderr)

    # サマリー
    print("-" * len(header), file=sys.stderr)
    total_line = f"{'合計':<30} {'':<14} {summary['total_train_score']:<14}"
    if has_test and summary.get("total_test_score"):
        total_line += f" {'':<12} {summary['total_test_score']:<12}"
    total_line += f" {summary['total_skills']} スキル"
    print(total_line, file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="複数スキルのベンチマーク結果を集約")
    parser.add_argument("files", nargs="+", help="run_loop.pyのJSON出力ファイル（複数指定可）")
    parser.add_argument("--verbose", action="store_true", help="各スキルのdescriptionも表示")
    parser.add_argument("--json", action="store_true", help="JSON形式で標準出力に出力")
    args = parser.parse_args()

    aggregated = aggregate_results(args.files)

    # テーブル表示
    print_table(aggregated, verbose=args.verbose)

    # JSON出力
    if args.json:
        print(json.dumps(aggregated, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
