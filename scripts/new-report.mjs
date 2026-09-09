// Scaffold a report record from a PDF:
//
//   node scripts/new-report.mjs "path/to/Report.pdf" my-report-slug
//
// Copies the PDF into public/pdf/<slug>.pdf, counts its pages, and writes a
// content/reports/<slug>.json stub with the next report number filled in.
// Fill in dek, topics, abstract, findings, keywords, jel and contents by hand.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [src, slugArg] = process.argv.slice(2);

if (!src) {
  console.error('usage: node scripts/new-report.mjs <file.pdf> [slug]');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`No such file: ${src}`);
  process.exit(1);
}

const base = path.basename(src, '.pdf').replace(/\s+H Heuristics$/i, '').trim();
const slug = (slugArg || base).toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Page count via pdfinfo when available; otherwise leave 0 to be filled in.
let pages = 0;
try {
  const out = execFileSync('pdfinfo', [src], { encoding: 'utf8' });
  pages = Number((out.match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
} catch {
  console.warn('  ! pdfinfo unavailable — set "pages" by hand.');
}

const existing = fs.readdirSync(path.join(ROOT, 'content/reports'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/reports', f), 'utf8')).number);
const yr = String(new Date().getFullYear());
const next = Math.max(0, ...existing
  .filter((n) => n.startsWith(`HH-${yr}-`))
  .map((n) => Number(n.split('-')[2]))) + 1;

const today = new Date().toISOString().slice(0, 10);
const record = {
  slug,
  number: `HH-${yr}-${String(next).padStart(2, '0')}`,
  title: base,
  authors: ['Hunter Hughes'],
  series: 'H Heuristics Research Report',
  institution: 'H Heuristics',
  published: today,
  updated: today,
  language: 'en',
  pdf: `${slug}.pdf`,
  pages,
  dek: 'TODO — one or two sentences for cards and social previews.',
  topics: ['TODO'],
  abstract: ['TODO — abstract paragraph one.'],
  findings: ['TODO — a key finding.'],
  keywords: ['TODO'],
  jelCodes: [],
  jelNote: '',
  method: 'TODO — data and method note.',
  contents: ['TODO — section title'],
  doi: null,
  license: 'CC BY-NC-ND 4.0',
};

const jsonPath = path.join(ROOT, 'content/reports', `${slug}.json`);
if (fs.existsSync(jsonPath)) {
  console.error(`Refusing to overwrite existing record: content/reports/${slug}.json`);
  process.exit(1);
}
fs.copyFileSync(src, path.join(ROOT, 'public/pdf', `${slug}.pdf`));
fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2) + '\n');

console.log(`\n  ${record.number}  ${slug}  (${pages} pp)`);
console.log(`  → public/pdf/${slug}.pdf`);
console.log(`  → content/reports/${slug}.json  — fill in the TODOs, then npm run build\n`);
