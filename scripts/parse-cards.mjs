#!/usr/bin/env node
// Convert _docs/CactusClan_trading.xlsx → src/data/cards.json.
// One-shot script. Uses `unzip -p` + a small XML pass to avoid pulling a
// runtime dep just for this; the spreadsheet schema is tiny and stable.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xlsxPath = resolve(__dirname, '../_docs/CactusClan_trading.xlsx');
const outPath = resolve(__dirname, '../src/data/cards.json');

function readMember(member) {
  if (process.platform === 'win32') {
    const tmp = resolve(tmpdir(), 'parse-cards-extract');
    const dest = resolve(tmp, ...member.split('/'));
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Add-Type -Assembly System.IO.Compression.FileSystem; ` +
      `$z=[IO.Compression.ZipFile]::OpenRead('${xlsxPath.replace(/\\/g, '\\\\')}'); ` +
      `$e=$z.Entries|?{$_.FullName -eq '${member}'}|Select -First 1; ` +
      `[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName('${dest.replace(/\\/g, '\\\\')}'))|Out-Null; ` +
      `[IO.Compression.ZipFileExtensions]::ExtractToFile($e,'${dest.replace(/\\/g, '\\\\')}', $true); ` +
      `$z.Dispose()`,
    ], { maxBuffer: 16 * 1024 * 1024 });
    return readFileSync(dest, 'utf8');
  }
  return execFileSync('unzip', ['-p', xlsxPath, member], { maxBuffer: 16 * 1024 * 1024 }).toString('utf8');
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml) {
  const out = [];
  // Each <si> wraps either a single <t>...</t> or a sequence of <r><t>...</t></r>.
  const siRe = /<si[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1];
    const parts = [];
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(inner)) !== null) parts.push(decodeXml(tm[1]));
    out.push(parts.join(''));
  }
  return out;
}

function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheetRows(xml, strings) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells = {};
    const cellRe = /<c\s+r="([A-Z]+)(\d+)"(?:\s+s="\d+")?(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const colLetters = cm[1];
      const type = cm[3];
      const inner = cm[4];
      const vMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      let value = vMatch ? vMatch[1] : '';
      if (type === 's') value = strings[Number(value)] ?? '';
      else if (type === 'str' || type === 'inlineStr') {
        const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        value = tMatch ? decodeXml(tMatch[1]) : '';
      } else value = decodeXml(value);
      cells[colLetterToIndex(colLetters)] = value;
    }
    rows.push(cells);
  }
  return rows;
}

function toNumberOrString(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(v)) return n;
  return v;
}

const sharedStrings = parseSharedStrings(readMember('xl/sharedStrings.xml'));
const rows = parseSheetRows(readMember('xl/worksheets/sheet1.xml'), sharedStrings);

// Header row is row 1 (index 0): Clan, Form, Name, Description, Strengths, Weaknesses, Attack, Defence, Speed, Health, Overall Score
// Clan column (A) is filled for the first row of each clan, then blank for subsequent forms.
// Form column (B) is the explicit 1..8 form number; falls back to a running counter when blank.
let currentClan = '';
let formCounter = 0;
const cards = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const name = (r[2] ?? '').toString().trim();
  if (!name) continue;
  const clanCell = (r[0] ?? '').toString().trim();
  if (clanCell && clanCell !== currentClan) {
    currentClan = clanCell;
    formCounter = 0;
  }
  formCounter += 1;
  const formCell = (r[1] ?? '').toString().trim();
  const form = formCell ? Math.round(Number(formCell)) : formCounter;
  cards.push({
    clan: currentClan,
    form,
    name,
    description: (r[3] ?? '').toString().trim(),
    strengths: (r[4] ?? '').toString().split(';').map((s) => s.trim()).filter(Boolean),
    weaknesses: (r[5] ?? '').toString().split(';').map((s) => s.trim()).filter(Boolean),
    attack: toNumberOrString(r[6]),
    defence: toNumberOrString(r[7]),
    speed: toNumberOrString(r[8]),
    health: toNumberOrString(r[9]),
    overallScore: toNumberOrString(r[10]),
  });
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(cards, null, 2) + '\n');

const clans = [...new Set(cards.map((c) => c.clan))];
console.log(`Parsed ${cards.length} cards across ${clans.length} clans:`);
for (const clan of clans) {
  const forCount = cards.filter((c) => c.clan === clan).length;
  console.log(`  ${clan.padEnd(20)} ${forCount} forms`);
}
console.log(`Wrote ${outPath}`);
