#!/usr/bin/env node
/**
 * md_to_html.mjs
 *
 * Markdown ファイル（mermaid が data URI に置換済み）を
 * markdown-it ライブラリで HTML に変換する。
 * CSS テンプレートは pdf/gdocs モードで切り替える。
 *
 * Usage:
 *   node md_to_html.mjs --input <input.md> --output <output.html> --mode pdf|gdocs [--template <template.css>]
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

// ─── 引数パース ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      result.input = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      result.output = args[++i];
    } else if (args[i] === '--mode' && args[i + 1]) {
      result.mode = args[++i];
    } else if (args[i] === '--template' && args[i + 1]) {
      result.template = args[++i];
    }
  }
  return result;
}

const args = parseArgs(process.argv);

if (!args.input || !args.output || !args.mode) {
  process.stderr.write(
    'Usage: node md_to_html.mjs --input <input.md> --output <output.html> --mode pdf|gdocs [--template <template.css>]\n'
  );
  process.exit(1);
}

if (args.mode !== 'pdf' && args.mode !== 'gdocs') {
  process.stderr.write(`Invalid --mode value: "${args.mode}". Must be "pdf" or "gdocs".\n`);
  process.exit(1);
}

const INPUT_MD = resolve(args.input);
const OUTPUT_HTML = resolve(args.output);
const MODE = args.mode;

// ─── 入力ファイル存在確認 ──────────────────────────────────────────────────────

if (!existsSync(INPUT_MD)) {
  process.stderr.write(`Input file not found: ${INPUT_MD}\n`);
  process.exit(1);
}

// ─── CSS デフォルトテンプレート ───────────────────────────────────────────────

const DEFAULT_CSS_PDF = `
@page { size: A4 portrait; margin: 18mm 15mm; }
body { font-family: 'Hiragino Sans', 'Helvetica Neue', sans-serif; font-size: 11pt; line-height: 1.7; color: #1f2937; }
h1 { font-size: 24pt; border-bottom: 2px solid #2563eb; padding-bottom: 0.3em; margin-top: 1.5em; page-break-before: auto; }
h2 { font-size: 18pt; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2em; margin-top: 1.2em; }
h3 { font-size: 14pt; margin-top: 1em; }
p, li { font-size: 11pt; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; break-inside: avoid; }
th, td { border: 1px solid #d1d5db; padding: 0.5em 0.8em; text-align: left; }
th { background: #f3f4f6; font-weight: bold; }
tr:nth-child(even) td { background: #fafafa; }
code { font-family: 'Menlo', 'Monaco', monospace; font-size: 0.9em; background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; padding: 0.8em; border-radius: 4px; overflow-x: auto; break-inside: auto; }
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; }
blockquote { border-left: 4px solid #2563eb; padding-left: 1em; margin: 1em 0; color: #4b5563; }
a { color: #2563eb; text-decoration: none; }
`.trim();

const DEFAULT_CSS_GDOCS = `
body { font-family: 'Hiragino Sans', 'Helvetica Neue', sans-serif; font-size: 11pt; line-height: 1.7; color: #1f2937; max-width: 800px; margin: 2em auto; padding: 0 1em; }
h1 { font-size: 22pt; border-bottom: 2px solid #2563eb; padding-bottom: 0.3em; }
h2 { font-size: 17pt; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2em; }
h3 { font-size: 14pt; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d1d5db; padding: 0.5em 0.8em; }
th { background: #f3f4f6; }
img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; }
code { font-family: 'Menlo', 'Monaco', monospace; background: #f3f4f6; padding: 0.1em 0.3em; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; padding: 0.8em; border-radius: 4px; }
`.trim();

// ─── CSS 取得 ─────────────────────────────────────────────────────────────────

let css;
if (args.template) {
  const templatePath = resolve(args.template);
  if (!existsSync(templatePath)) {
    process.stderr.write(`Template file not found: ${templatePath}\n`);
    process.exit(1);
  }
  try {
    css = await readFile(templatePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`Failed to read template file: ${err.message}\n`);
    process.exit(1);
  }
} else {
  css = MODE === 'pdf' ? DEFAULT_CSS_PDF : DEFAULT_CSS_GDOCS;
}

// ─── パッケージ一時インストール helper ───────────────────────────────────────

/**
 * 指定パッケージが import できない場合、一時ディレクトリに npm install して
 * そのパスから import できるモジュールを返す。
 */
async function requirePackage(pkgName) {
  // まず通常の import を試みる
  try {
    const mod = await import(pkgName);
    return mod.default ?? mod;
  } catch {
    // 通常 import に失敗した場合は一時 npm install
  }

  const tmpDir = `/tmp/einja-md-html-deps-${randomUUID()}`;
  await mkdir(tmpDir, { recursive: true });

  await new Promise((res, rej) => {
    const child = spawn(
      'npm',
      ['install', '--prefix', tmpDir, '--no-save', '--no-package-lock', pkgName],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    );
    child.on('error', (e) => rej(new Error(`npm install failed: ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0) rej(new Error(`npm install exited with code ${code}`));
      else res(undefined);
    });
  });

  // 一時ディレクトリの node_modules から require して返す
  const req = createRequire(`${tmpDir}/node_modules/`);
  const mod = req(pkgName);

  // クリーンアップ（非同期・エラー無視）
  rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  return mod.default ?? mod;
}

// ─── markdown-it のインポート ─────────────────────────────────────────────────

let MarkdownIt;
try {
  MarkdownIt = await requirePackage('markdown-it');
} catch (err) {
  process.stderr.write(`Failed to load markdown-it: ${err.message}\n`);
  process.exit(1);
}

// ─── highlight.js のインポート（オプション）──────────────────────────────────

let hljs = null;
try {
  hljs = await requirePackage('highlight.js');
} catch {
  // highlight.js が利用できない場合はシンタックスハイライトなしで継続
}

// ─── markdown-it インスタンス作成 ─────────────────────────────────────────────

/** @type {import('markdown-it').Options} */
const mdOptions = {
  html: true,
  linkify: true,
  breaks: true,
  typographer: false,
};

if (hljs) {
  mdOptions.highlight = (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch {
        // ハイライト失敗時はフォールバック
      }
    }
    // 言語指定なし、または未知の言語はエスケープして返す
    const escaped = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<pre class="hljs"><code>${escaped}</code></pre>`;
  };
}

const md = new MarkdownIt(mdOptions);

// ─── 入力 Markdown 読み込み ───────────────────────────────────────────────────

let mdContent;
try {
  mdContent = await readFile(INPUT_MD, 'utf-8');
} catch (err) {
  process.stderr.write(`Failed to read input file: ${err.message}\n`);
  process.exit(1);
}

// ─── HTML レンダリング ────────────────────────────────────────────────────────

let renderedHtml;
try {
  renderedHtml = md.render(mdContent);
} catch (err) {
  process.stderr.write(`Failed to render Markdown: ${err.message}\n`);
  process.exit(1);
}

// ─── HTML ドキュメント組み立て ────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const title = basename(INPUT_MD, '.md');
const safeTitle = escapeHtml(title);
const safeCss = css.replace(/<\/style/gi, '<\\/style');

const htmlDocument = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
${safeCss}
  </style>
</head>
<body>
${renderedHtml}
</body>
</html>
`;

// ─── 出力ファイルに書き出し ────────────────────────────────────────────────────

const outputDir = dirname(OUTPUT_HTML);
await mkdir(outputDir, { recursive: true });

try {
  await writeFile(OUTPUT_HTML, htmlDocument, 'utf-8');
} catch (err) {
  process.stderr.write(`Failed to write output file: ${err.message}\n`);
  process.exit(1);
}

// ─── 完了 ─────────────────────────────────────────────────────────────────────

process.stdout.write(`Generated: ${OUTPUT_HTML}\n`);
