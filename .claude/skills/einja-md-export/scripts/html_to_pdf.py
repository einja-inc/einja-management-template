"""
html_to_pdf.py - HTMLファイルをChrome Headlessでの A4縦PDFに変換する

Usage:
    python3 html_to_pdf.py --input <input.html> --output <output.pdf>
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MIN_PDF_SIZE_BYTES = 5 * 1024  # 5KB


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert an HTML file to an A4 portrait PDF using Chrome Headless."
    )
    parser.add_argument("--input", required=True, help="Path to the input HTML file")
    parser.add_argument("--output", required=True, help="Path to the output PDF file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Step 1: 入力ファイル存在確認
    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    if not input_path.is_file():
        print(f"Input path is not a file: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Step 2: 出力ディレクトリ作成
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Step 3: Chrome 存在確認
    chrome = Path(CHROME_PATH)
    if not chrome.exists() or not os.access(chrome, os.X_OK):
        print(
            "Chrome not found. Install Google Chrome from https://www.google.com/chrome/",
            file=sys.stderr,
        )
        sys.exit(1)

    # Step 4: Chrome Headless 実行
    cmd = [
        str(chrome),
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--print-to-pdf={output_path}",
        "--no-pdf-header-footer",
        "--virtual-time-budget=10000",
        "--run-all-compositor-stages-before-draw",
        f"file://{input_path}",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        print("ERROR: Chrome timed out during PDF generation", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"ERROR: Chrome exited with code {result.returncode}", file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        sys.exit(1)

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")

    # Step 5: 出力ファイル存在 & サイズチェック
    if not output_path.exists():
        print("PDF generation failed: output file was not created", file=sys.stderr)
        sys.exit(1)

    size = output_path.stat().st_size
    if size < MIN_PDF_SIZE_BYTES:
        os.remove(output_path)
        print(
            f"PDF generation failed: output too small ({size} bytes)",
            file=sys.stderr,
        )
        sys.exit(1)

    # Step 6: 成功報告
    print(f"Generated: {output_path} ({size} bytes)")


if __name__ == "__main__":
    main()
