#!/usr/bin/env node
/**
 * Fails when a CSS custom property is referenced with var(--x) anywhere in
 * src/ but never defined. Definitions are collected from:
 *   - `--x:` declarations in .scss and inline component styles
 *   - `setProperty('--x'` calls in TypeScript
 *   - `[style.--x]` bindings in templates
 * Also reports (warn only) the number of raw hex colours inside component
 * files, which the design-system work drives toward zero.
 *
 *   node scripts/check-css-vars.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const EXTS = new Set(['.ts', '.scss', '.html']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const defined = new Set();
const referenced = new Map(); // name -> [file, ...]
let rawHex = 0;
const rawHexByFile = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1]);
  for (const m of text.matchAll(/setProperty\(\s*['"`]--([a-zA-Z0-9_-]+)/g)) defined.add(m[1]);
  for (const m of text.matchAll(/\[style\.--([a-zA-Z0-9_-]+)\]/g)) defined.add(m[1]);
  for (const m of text.matchAll(/var\(\s*--([a-zA-Z0-9_-]+)/g)) {
    const list = referenced.get(m[1]) ?? [];
    list.push(file);
    referenced.set(m[1], list);
  }
  if (file.endsWith('.ts') && !file.endsWith('.generated.ts')) {
    const n = (text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length;
    if (n) { rawHex += n; rawHexByFile.push([n, file]); }
  }
}

const missing = [...referenced.keys()].filter(name => !defined.has(name)).sort();
const rel = f => f.slice(SRC.length + 1).replaceAll('\\', '/');

if (missing.length) {
  console.error(`\n${missing.length} CSS variable(s) referenced but never defined:\n`);
  for (const name of missing) {
    const where = [...new Set(referenced.get(name))].map(rel);
    console.error(`  --${name}  (${where.length} file${where.length === 1 ? '' : 's'})`);
    for (const f of where.slice(0, 5)) console.error(`      ${f}`);
    if (where.length > 5) console.error(`      ... and ${where.length - 5} more`);
  }
  console.error('');
} else {
  console.log(`check-css-vars: all ${referenced.size} referenced variables are defined.`);
}

rawHexByFile.sort((a, b) => b[0] - a[0]);
console.log(`check-css-vars: ${rawHex} raw hex colour(s) in component files (warn only). Top offenders:`);
for (const [n, f] of rawHexByFile.slice(0, 8)) console.log(`  ${String(n).padStart(4)}  ${rel(f)}`);

process.exit(missing.length ? 1 : 0);
