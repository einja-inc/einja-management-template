#!/usr/bin/env python3
"""評価＋改善ループを実行。全パスまたは最大イテレーション到達まで繰り返す。

run_eval.pyとimprove_description.pyをループで組み合わせ、
履歴を追跡し最良のdescriptionを返す。
過学習防止のためtrain/test分割に対応。
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path

try:
    from scripts.generate_report import generate_html
    from scripts.improve_description import improve_description
    from scripts.run_eval import find_project_root, run_eval
    from scripts.utils import parse_skill_md
except ImportError:
    from generate_report import generate_html
    from improve_description import improve_description
    from run_eval import find_project_root, run_eval
    from utils import parse_skill_md

import anthropic


def split_eval_set(
    eval_set: list[dict],
    holdout: int,
    seed: int | None = None,
) -> tuple[list[dict], list[dict]]:
    """評価セットをトレーニングとテストに分割する。

    holdoutが0の場合、全データをトレーニングに使用する。
    should_trigger=Trueとshould_trigger=Falseの両方から
    均等にホールドアウトする。
    """
    if holdout <= 0:
        return eval_set, []

    rng = random.Random(seed)

    positive = [item for item in eval_set if item.get("should_trigger", True)]
    negative = [item for item in eval_set if not item.get("should_trigger", True)]

    # 正例と負例から均等にホールドアウト
    pos_holdout = holdout // 2
    neg_holdout = holdout - pos_holdout

    # 上限調整
    pos_holdout = min(pos_holdout, len(positive) - 1) if len(positive) > 1 else 0
    neg_holdout = min(neg_holdout, len(negative) - 1) if len(negative) > 1 else 0

    rng.shuffle(positive)
    rng.shuffle(negative)

    test_set = positive[:pos_holdout] + negative[:neg_holdout]
    train_set = positive[pos_holdout:] + negative[neg_holdout:]

    return train_set, test_set


def run_loop(
    eval_set_path: str,
    skill_path: str,
    max_iterations: int = 10,
    num_workers: int = 10,
    timeout: int = 30,
    runs_per_query: int = 3,
    trigger_threshold: float = 0.5,
    holdout: int = 0,
    seed: int | None = None,
    model: str | None = None,
    improve_model: str = "claude-sonnet-4-20250514",
    verbose: bool = False,
    report_path: str | None = None,
    log_dir: str | None = None,
) -> dict:
    """評価＋改善ループのメイン関数。"""
    eval_set = json.loads(Path(eval_set_path).read_text())
    skill_dir = Path(skill_path)

    if not (skill_dir / "SKILL.md").exists():
        print(f"エラー: {skill_dir} にSKILL.mdが見つかりません", file=sys.stderr)
        sys.exit(1)

    name, original_description, content = parse_skill_md(skill_dir)
    project_root = find_project_root()

    # train/test分割
    train_set, test_set = split_eval_set(eval_set, holdout, seed)

    if verbose:
        print(f"スキル: {name}", file=sys.stderr)
        print(f"トレーニングクエリ: {len(train_set)}, テストクエリ: {len(test_set)}", file=sys.stderr)
        print(f"最大イテレーション: {max_iterations}", file=sys.stderr)
        print(f"オリジナルdescription: {original_description}", file=sys.stderr)

    client = anthropic.Anthropic()
    current_description = original_description
    history: list[dict] = []
    improve_history: list[dict] = []
    log_path = Path(log_dir) if log_dir else None

    for iteration in range(max_iterations):
        if verbose:
            print(f"\n--- イテレーション {iteration} ---", file=sys.stderr)
            print(f"description: {current_description[:100]}...", file=sys.stderr)

        # トレーニング評価
        train_results = run_eval(
            eval_set=train_set,
            skill_name=name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )

        # テスト評価（テストセットがある場合）
        test_results = None
        if test_set:
            test_results = run_eval(
                eval_set=test_set,
                skill_name=name,
                description=current_description,
                num_workers=num_workers,
                timeout=timeout,
                project_root=project_root,
                runs_per_query=runs_per_query,
                trigger_threshold=trigger_threshold,
                model=model,
            )

        # 履歴エントリの構築
        entry: dict = {
            "description": current_description,
            "train_passed": train_results["summary"]["passed"],
            "train_failed": train_results["summary"]["failed"],
            "train_total": train_results["summary"]["total"],
            "train_results": train_results["results"],
        }
        if test_results:
            entry["test_passed"] = test_results["summary"]["passed"]
            entry["test_failed"] = test_results["summary"]["failed"]
            entry["test_total"] = test_results["summary"]["total"]
            entry["test_results"] = test_results["results"]

        history.append(entry)

        if verbose:
            train_s = f"{train_results['summary']['passed']}/{train_results['summary']['total']}"
            msg = f"トレーニングスコア: {train_s}"
            if test_results:
                test_s = f"{test_results['summary']['passed']}/{test_results['summary']['total']}"
                msg += f", テストスコア: {test_s}"
            print(msg, file=sys.stderr)

        # レポート更新
        if report_path:
            output_data = {"history": history, "holdout": holdout}
            report_html = generate_html(output_data, auto_refresh=True, skill_name=name)
            Path(report_path).write_text(report_html)
            if verbose:
                print(f"レポートを更新しました: {report_path}", file=sys.stderr)

        # 全パスなら終了
        if train_results["summary"]["failed"] == 0:
            if test_results is None or test_results["summary"]["failed"] == 0:
                if verbose:
                    print("全クエリパス。ループを終了します。", file=sys.stderr)
                break

        # 最終イテレーションでなければ改善
        if iteration < max_iterations - 1:
            if verbose:
                print("descriptionを改善中...", file=sys.stderr)

            new_description = improve_description(
                client=client,
                skill_name=name,
                skill_content=content,
                current_description=current_description,
                eval_results=train_results,
                history=improve_history,
                model=improve_model,
                test_results=test_results,
                log_dir=log_path,
                iteration=iteration,
            )

            # 改善履歴を更新
            improve_entry: dict = {
                "description": current_description,
                "train_passed": train_results["summary"]["passed"],
                "train_total": train_results["summary"]["total"],
                "results": train_results["results"],
            }
            if test_results:
                improve_entry["test_passed"] = test_results["summary"]["passed"]
                improve_entry["test_total"] = test_results["summary"]["total"]
            improve_history.append(improve_entry)

            current_description = new_description

            if verbose:
                print(f"新しいdescription: {new_description[:100]}...", file=sys.stderr)

    # 最良のdescriptionを選択（テスト > トレーニングで優先）
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

    # 最終レポート（auto_refreshオフ）
    if report_path:
        output_data = {"history": history, "holdout": holdout}
        report_html = generate_html(output_data, auto_refresh=False, skill_name=name)
        Path(report_path).write_text(report_html)

    output = {
        "skill_name": name,
        "original_description": original_description,
        "best_description": best["description"],
        "best_iteration": best_idx,
        "history": history,
        "holdout": holdout,
    }

    if verbose:
        print(f"\n最良のdescription (イテレーション {best_idx}): {best['description']}", file=sys.stderr)
        train_s = f"{best['train_passed']}/{best['train_total']}"
        msg = f"最良スコア - トレーニング: {train_s}"
        if best.get("test_passed") is not None:
            test_s = f"{best['test_passed']}/{best['test_total']}"
            msg += f", テスト: {test_s}"
        print(msg, file=sys.stderr)

    return output


def main():
    parser = argparse.ArgumentParser(description="評価＋改善ループを実行")
    parser.add_argument("--eval-set", required=True, help="評価セットJSONファイルへのパス")
    parser.add_argument("--skill-path", required=True, help="スキルディレクトリへのパス")
    parser.add_argument("--max-iterations", type=int, default=10, help="最大イテレーション数（デフォルト: 10）")
    parser.add_argument("--num-workers", type=int, default=10, help="並行ワーカー数（デフォルト: 10）")
    parser.add_argument("--timeout", type=int, default=30, help="クエリごとのタイムアウト秒数（デフォルト: 30）")
    parser.add_argument("--runs-per-query", type=int, default=3, help="クエリごとの実行回数（デフォルト: 3）")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="トリガー率の閾値（デフォルト: 0.5）")
    parser.add_argument("--holdout", type=int, default=0, help="テスト用ホールドアウトクエリ数（デフォルト: 0）")
    parser.add_argument("--seed", type=int, default=None, help="train/test分割のランダムシード")
    parser.add_argument("--model", default=None, help="評価時にclaude -pに使用するモデル")
    parser.add_argument("--improve-model", default="claude-sonnet-4-20250514", help="description改善に使用するモデル（デフォルト: claude-sonnet-4-20250514）")
    parser.add_argument("--verbose", action="store_true", help="進捗をstderrに出力")
    parser.add_argument("--report", default=None, help="HTMLレポートの出力先パス（ライブ更新あり）")
    parser.add_argument("--log-dir", default=None, help="改善トランスクリプトのログディレクトリ")
    args = parser.parse_args()

    output = run_loop(
        eval_set_path=args.eval_set,
        skill_path=args.skill_path,
        max_iterations=args.max_iterations,
        num_workers=args.num_workers,
        timeout=args.timeout,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        holdout=args.holdout,
        seed=args.seed,
        model=args.model,
        improve_model=args.improve_model,
        verbose=args.verbose,
        report_path=args.report,
        log_dir=args.log_dir,
    )

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
