#!/usr/bin/env node
/**
 * preprocess_mermaid.mjs
 *
 * 入力 .md ファイル内の mermaid コードブロックを mmdc で SVG に変換し、
 * 生成された外部 SVG ファイル参照を base64 data URI に変換した最終 .md を出力する。
 *
 * Usage:
 *   node preprocess_mermaid.mjs --input <input.md> --output <output.md> --config <mermaid-config.json>
 */

import { readFile, writeFile, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, sep } from 'path';
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
    } else if (args[i] === '--config' && args[i + 1]) {
      result.config = args[++i];
    }
  }
  return result;
}

const args = parseArgs(process.argv);

if (!args.input || !args.output || !args.config) {
  process.stderr.write(
    'Usage: node preprocess_mermaid.mjs --input <input.md> --output <output.md> --config <mermaid-config.json>\n'
  );
  process.exit(1);
}

const INPUT_MD = resolve(args.input);
const OUTPUT_MD = resolve(args.output);
const CONFIG_FILE = resolve(args.config);

// ─── 入力ファイル存在確認 ──────────────────────────────────────────────────────

if (!existsSync(INPUT_MD)) {
  process.stderr.write(`Input file not found: ${INPUT_MD}\n`);
  process.exit(1);
}

// ─── 一時ディレクトリ作成 ─────────────────────────────────────────────────────

const TMPDIR = `/tmp/einja-md-export-${randomUUID()}`;
await mkdir(TMPDIR, { recursive: true });

const WITH_SVG_MD = `${TMPDIR}/with-svg.md`;

// ─── mmdc 実行 ────────────────────────────────────────────────────────────────

/**
 * child_process.spawn をラップして Promise を返す。
 * stdout/stderr はそのままプロセスに流す。
 */
function runMmdc(inputPath, outputPath, configPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'npx',
      [
        '--yes',
        '@mermaid-js/mermaid-cli@latest',
        '-i', inputPath,
        '-o', outputPath,
        '--configFile', configPath,
        '--backgroundColor', 'transparent',
        '--width', '1200',
      ],
      {
        stdio: ['ignore', 'inherit', 'inherit'],
      }
    );

    child.on('error', (err) => {
      rejectPromise(new Error(`Failed to spawn mmdc: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`mmdc exited with code ${code}`));
      } else {
        resolvePromise();
      }
    });
  });
}

try {
  await runMmdc(INPUT_MD, WITH_SVG_MD, CONFIG_FILE);
} catch (err) {
  process.stderr.write(`mmdc failed: ${err.message}\n`);
  await rm(TMPDIR, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
}

// ─── mmdc 出力 .md を読み込み ─────────────────────────────────────────────────

let mdContent;
try {
  mdContent = await readFile(WITH_SVG_MD, 'utf-8');
} catch (err) {
  process.stderr.write(`Failed to read mmdc output: ${err.message}\n`);
  await rm(TMPDIR, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
}

// ─── SVG 参照を base64 data URI に置換 ───────────────────────────────────────

/**
 * mmdc が出力する SVG 参照パターン:
 *   ![alt](./xxx.svg) または ![alt](xxx-1.svg) などの相対参照
 *
 * SVG ファイルの解決ベースは TMPDIR（mmdc の出力先ディレクトリ）。
 * 外部 URL（http(s)://）は除外する。
 */
const SVG_REF_RE = /!\[([^\]]*)\]\(((?!https?:\/\/)[^)]*\.svg)\)/g;
const TMPDIR_RESOLVED = resolve(TMPDIR) + sep;

/**
 * すべての SVG 参照を収集して非同期で変換する。
 * String.prototype.replace は非同期コールバックをサポートしないため、
 * 一度マッチを収集してから順次置換する。
 */
const matches = [...mdContent.matchAll(SVG_REF_RE)];

// SVG ファイルごとに base64 を取得してキャッシュ（同一ファイルの重複読み込みを防ぐ）
const svgBase64Cache = new Map();

for (const match of matches) {
  const svgRelPath = match[2];
  if (svgBase64Cache.has(svgRelPath)) continue;

  // パス解決: TMPDIR 起点の相対パス
  const svgAbsPath = resolve(TMPDIR, svgRelPath);

  // パストラバーサル検証: 解決後のパスが TMPDIR 配下にあることを確認
  if (!svgAbsPath.startsWith(TMPDIR_RESOLVED)) {
    process.stderr.write(`Warning: SVG path outside tmpdir, skipping: ${svgRelPath}\n`);
    continue;
  }

  let svgContent;
  try {
    svgContent = await readFile(svgAbsPath);
  } catch (err) {
    process.stderr.write(`Warning: SVG file not found, skipping: ${svgAbsPath}\n`);
    continue;
  }

  const base64 = svgContent.toString('base64');
  svgBase64Cache.set(svgRelPath, base64);
}

// 置換実行
const processedContent = mdContent.replace(SVG_REF_RE, (fullMatch, alt, svgRelPath) => {
  const base64 = svgBase64Cache.get(svgRelPath);
  if (base64 === undefined) {
    // SVG が読み込めなかった場合は元の参照をそのまま残す
    return fullMatch;
  }
  return `![${alt}](data:image/svg+xml;base64,${base64})`;
});

// ─── 出力ファイルに書き出し ────────────────────────────────────────────────────

// 出力先ディレクトリが存在しない場合は作成する
const outputDir = dirname(OUTPUT_MD);
await mkdir(outputDir, { recursive: true });

try {
  await writeFile(OUTPUT_MD, processedContent, 'utf-8');
} catch (err) {
  process.stderr.write(`Failed to write output file: ${err.message}\n`);
  await rm(TMPDIR, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
}

// ─── 一時ディレクトリの削除 ───────────────────────────────────────────────────

await rm(TMPDIR, { recursive: true, force: true }).catch(() => {});

// ─── 完了 ─────────────────────────────────────────────────────────────────────

process.stdout.write(`Generated: ${OUTPUT_MD}\n`);
