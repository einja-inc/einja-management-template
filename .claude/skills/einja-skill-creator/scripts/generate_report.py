#!/usr/bin/env python3
"""run_loop.pyの出力からHTMLレポートを生成。

run_loop.pyのJSON出力を受け取り、各descriptionの試行結果を
チェック/xで表示するHTMLレポートを生成する。
トレーニングとテストのクエリを区別して表示。
"""

import argparse
import html
import json
import sys
from pathlib import Path


def generate_html(data: dict, auto_refresh: bool = False, skill_name: str = "") -> str:
    """ループ出力データからHTMLレポートを生成。auto_refreshがTrueの場合、メタリフレッシュタグを追加。"""
    history = data.get("history", [])
    holdout = data.get("holdout", 0)
    title_prefix = html.escape(skill_name + " — ") if skill_name else ""

    # トレーニングとテストの全ユニーククエリを取得（should_trigger情報付き）
    train_queries: list[dict] = []
    test_queries: list[dict] = []
    if history:
        for r in history[0].get("train_results", history[0].get("results", [])):
            train_queries.append({"query": r["query"], "should_trigger": r.get("should_trigger", True)})
        if history[0].get("test_results"):
            for r in history[0].get("test_results", []):
                test_queries.append({"query": r["query"], "should_trigger": r.get("should_trigger", True)})

    refresh_tag = '    <meta http-equiv="refresh" content="5">\n' if auto_refresh else ""

    html_parts = []
    html_parts.append(f"""<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
{refresh_tag}    <title>{title_prefix}スキルDescription最適化</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }}
        h1 {{ font-size: 1.4em; margin-bottom: 4px; color: #fff; }}
        .explainer {{ color: #888; font-size: 0.85em; margin-bottom: 16px; line-height: 1.4; }}
        .summary {{ display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }}
        .summary-card {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px 16px; min-width: 120px; }}
        .summary-card .label {{ font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }}
        .summary-card .value {{ font-size: 1.5em; font-weight: 600; margin-top: 2px; }}
        .legend {{ font-size: 0.8em; color: #888; margin-bottom: 12px; }}
        .legend span {{ margin-right: 16px; }}
        .table-container {{ overflow-x: auto; }}
        table {{ border-collapse: collapse; font-size: 0.8em; width: 100%; }}
        th, td {{ border: 1px solid #333; padding: 6px 8px; text-align: center; }}
        th {{ background: #1a1a1a; color: #ccc; font-weight: 600; position: sticky; top: 0; z-index: 2; }}
        th.query-header {{ writing-mode: vertical-rl; text-orientation: mixed; max-width: 30px; height: 180px; font-weight: 400; font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        th.query-header.negative {{ color: #ff6b6b; }}
        th.section-header {{ background: #222; color: #aaa; font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.1em; }}
        td.desc {{ text-align: left; max-width: 300px; font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        td.desc:hover {{ white-space: normal; overflow: visible; position: relative; z-index: 10; background: #1a1a1a; }}
        td.pass {{ background: rgba(34, 197, 94, 0.15); color: #22c55e; }}
        td.fail {{ background: rgba(239, 68, 68, 0.15); color: #ef4444; }}
        td.score {{ font-weight: 600; }}
        td.score.perfect {{ color: #22c55e; }}
        td.score.good {{ color: #86efac; }}
        td.score.mid {{ color: #fbbf24; }}
        td.score.bad {{ color: #ef4444; }}
        tr.best-row {{ background: rgba(34, 197, 94, 0.05); }}
        tr.best-row td {{ border-color: #22c55e44; }}
        .best-badge {{ background: #22c55e; color: #000; font-size: 0.7em; padding: 1px 6px; border-radius: 3px; font-weight: 700; margin-left: 4px; }}
    </style>
</head>
<body>
    <h1>{title_prefix}スキルDescription最適化</h1>
    <p class="explainer">
        各行はdescriptionの1イテレーションです。各列はクエリで、セルはそのdescriptionで
        スキルがトリガーされたかどうかを示します。赤い列ヘッダーはトリガーすべきでないクエリです。
""")

    if holdout:
        html_parts.append(f'        トレーニング/テスト分割: テスト用に{holdout}クエリをホールドアウト。\n')

    html_parts.append('    </p>\n')

    # サマリーカード
    if history:
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

        original = history[0] if history else {}
        best = history[best_idx] if history else {}

        orig_train = f"{original.get('train_passed', original.get('passed', 0))}/{original.get('train_total', original.get('total', 0))}"
        best_train_str = f"{best.get('train_passed', best.get('passed', 0))}/{best.get('train_total', best.get('total', 0))}"

        html_parts.append('    <div class="summary">\n')
        html_parts.append(f'        <div class="summary-card"><div class="label">オリジナル (トレーニング)</div><div class="value">{orig_train}</div></div>\n')

        if best.get("test_passed") is not None:
            best_test_str = f"{best.get('test_passed', '?')}/{best.get('test_total', '?')}"
            html_parts.append(f'        <div class="summary-card"><div class="label">最良スコア (テスト)</div><div class="value">{best_test_str}</div></div>\n')
        html_parts.append(f'        <div class="summary-card"><div class="label">最良スコア (トレーニング)</div><div class="value">{best_train_str}</div></div>\n')
        html_parts.append(f'        <div class="summary-card"><div class="label">イテレーション</div><div class="value">{len(history)}</div></div>\n')
        html_parts.append('    </div>\n')

    # レジェンド
    html_parts.append('    <div class="legend">\n')
    html_parts.append('        <span>クエリカラム: 通常=トリガーすべき、<span style="color:#ff6b6b">赤</span>=トリガーすべきでない</span>\n')
    html_parts.append('    </div>\n')

    # テーブル
    html_parts.append('    <div class="table-container">\n    <table>\n')

    # ヘッダー行
    html_parts.append('        <tr>\n')
    html_parts.append('            <th>回</th>\n')
    html_parts.append('            <th>Description</th>\n')

    if train_queries:
        html_parts.append(f'            <th class="section-header" colspan="{len(train_queries)}">トレーニング</th>\n')
    if test_queries:
        html_parts.append(f'            <th class="section-header" colspan="{len(test_queries)}">テスト</th>\n')

    html_parts.append('            <th>トレーニング</th>\n')
    if test_queries:
        html_parts.append('            <th>テスト</th>\n')
    html_parts.append('        </tr>\n')

    # クエリヘッダー行
    html_parts.append('        <tr>\n')
    html_parts.append('            <th></th>\n')
    html_parts.append('            <th></th>\n')

    for q in train_queries:
        css_class = "query-header negative" if not q["should_trigger"] else "query-header"
        html_parts.append(f'            <th class="{css_class}" title="{html.escape(q["query"])}">{html.escape(q["query"][:60])}</th>\n')
    for q in test_queries:
        css_class = "query-header negative" if not q["should_trigger"] else "query-header"
        html_parts.append(f'            <th class="{css_class}" title="{html.escape(q["query"])}">{html.escape(q["query"][:60])}</th>\n')

    html_parts.append('            <th></th>\n')
    if test_queries:
        html_parts.append('            <th></th>\n')
    html_parts.append('        </tr>\n')

    # 最良のイテレーションを見つける
    best_idx = 0
    if history:
        best_test_score = -1
        best_train_score = -1
        for i, h in enumerate(history):
            t_passed = h.get("test_passed", -1)
            tr_passed = h.get("train_passed", h.get("passed", 0))
            if t_passed > best_test_score or (t_passed == best_test_score and tr_passed > best_train_score):
                best_test_score = t_passed
                best_train_score = tr_passed
                best_idx = i

    # データ行
    for i, h in enumerate(history):
        row_class = ' class="best-row"' if i == best_idx else ""
        html_parts.append(f'        <tr{row_class}>\n')

        # イテレーション番号
        badge = ' <span class="best-badge">BEST</span>' if i == best_idx else ""
        html_parts.append(f'            <td>{i}{badge}</td>\n')

        # Description
        desc = html.escape(h.get("description", ""))
        html_parts.append(f'            <td class="desc" title="{desc}">{desc}</td>\n')

        # トレーニング結果
        train_results = h.get("train_results", h.get("results", []))
        result_map = {r["query"]: r for r in train_results}
        for q in train_queries:
            r = result_map.get(q["query"])
            if r:
                css = "pass" if r["pass"] else "fail"
                symbol = "&#10003;" if r["pass"] else "&#10007;"
                rate = f'{r["triggers"]}/{r["runs"]}'
                html_parts.append(f'            <td class="{css}" title="rate={rate}">{symbol}</td>\n')
            else:
                html_parts.append('            <td>-</td>\n')

        # テスト結果
        test_results = h.get("test_results", [])
        test_result_map = {r["query"]: r for r in test_results}
        for q in test_queries:
            r = test_result_map.get(q["query"])
            if r:
                css = "pass" if r["pass"] else "fail"
                symbol = "&#10003;" if r["pass"] else "&#10007;"
                rate = f'{r["triggers"]}/{r["runs"]}'
                html_parts.append(f'            <td class="{css}" title="rate={rate}">{symbol}</td>\n')
            else:
                html_parts.append('            <td>-</td>\n')

        # トレーニングスコア
        train_passed = h.get("train_passed", h.get("passed", 0))
        train_total = h.get("train_total", h.get("total", 0))
        if train_total > 0:
            ratio = train_passed / train_total
            if ratio >= 1.0:
                score_class = "perfect"
            elif ratio >= 0.8:
                score_class = "good"
            elif ratio >= 0.5:
                score_class = "mid"
            else:
                score_class = "bad"
        else:
            score_class = "bad"
        html_parts.append(f'            <td class="score {score_class}">{train_passed}/{train_total}</td>\n')

        # テストスコア
        if test_queries:
            test_passed = h.get("test_passed")
            test_total = h.get("test_total")
            if test_passed is not None and test_total is not None and test_total > 0:
                ratio = test_passed / test_total
                if ratio >= 1.0:
                    score_class = "perfect"
                elif ratio >= 0.8:
                    score_class = "good"
                elif ratio >= 0.5:
                    score_class = "mid"
                else:
                    score_class = "bad"
                html_parts.append(f'            <td class="score {score_class}">{test_passed}/{test_total}</td>\n')
            else:
                html_parts.append('            <td>-</td>\n')

        html_parts.append('        </tr>\n')

    html_parts.append('    </table>\n    </div>\n')
    html_parts.append('</body>\n</html>\n')

    return "".join(html_parts)


def main():
    parser = argparse.ArgumentParser(description="run_loop.pyの出力からHTMLレポートを生成")
    parser.add_argument("input", help="run_loop.pyのJSON出力へのパス（'-'でstdinから読み込み）")
    parser.add_argument("-o", "--output", default=None, help="HTMLレポートの出力先パス（未指定時はstdout）")
    parser.add_argument("--skill-name", default="", help="レポートタイトルに表示するスキル名")
    args = parser.parse_args()

    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        data = json.loads(Path(args.input).read_text())

    html_content = generate_html(data, skill_name=args.skill_name)

    if args.output:
        Path(args.output).write_text(html_content)
        print(f"レポートを生成しました: {args.output}", file=sys.stderr)
    else:
        print(html_content)


if __name__ == "__main__":
    main()
