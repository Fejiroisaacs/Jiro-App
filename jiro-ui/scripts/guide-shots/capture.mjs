// Usage: node scripts/guide-shots/capture.mjs <guide> [name...]; see README.md.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.GUIDE_SHOTS_BASE_URL || 'http://localhost:4200';
const GUIDES = ['basics', 'jym', 'culinara', 'journaly', 'ledger'];
const ACTIONS = ['click', 'fill', 'wait', 'scroll', 'press'];
const SHOT_KEYS = ['name', 'path', 'waitFor', 'clip', 'actions', 'viewport', 'hide'];

function fail(msg) {
  console.error(`capture: ${msg}`);
  process.exit(1);
}

const [guide, ...only] = process.argv.slice(2);
if (!GUIDES.includes(guide)) fail(`usage: node scripts/guide-shots/capture.mjs <${GUIDES.join('|')}> [name...]`);

const listPath = join(HERE, `${guide}.shots.json`);
let shots;
try {
  shots = JSON.parse(readFileSync(listPath, 'utf8'));
} catch (e) {
  fail(`cannot read ${listPath}: ${e.message}`);
}
if (!Array.isArray(shots)) fail(`${guide}.shots.json must be a JSON array`);

// Validate up front so a typo fails before a browser opens.
const seen = new Set();
for (const [i, s] of shots.entries()) {
  const where = `${guide}.shots.json[${i}]`;
  for (const k of Object.keys(s)) if (!SHOT_KEYS.includes(k)) fail(`${where}: unknown key "${k}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.name ?? '')) fail(`${where}: "name" must be lowercase-with-dashes`);
  if (seen.has(s.name)) fail(`${where}: duplicate name "${s.name}"`);
  seen.add(s.name);
  if (typeof s.path !== 'string' || !s.path.startsWith('/')) fail(`${where}: "path" must start with /`);
  if (s.viewport && !(Number.isInteger(s.viewport.width) && Number.isInteger(s.viewport.height))) {
    fail(`${where}: "viewport" must be { "width": int, "height": int }`);
  }
  if (s.hide && !Array.isArray(s.hide)) fail(`${where}: "hide" must be an array of selectors`);
  for (const [j, a] of (s.actions ?? []).entries()) {
    const kind = Object.keys(a).find(k => ACTIONS.includes(k));
    if (!kind) fail(`${where}.actions[${j}]: needs one of ${ACTIONS.join(', ')}`);
    if (kind === 'fill' && typeof a.value !== 'string') fail(`${where}.actions[${j}]: "fill" needs a "value"`);
    if (kind === 'click' && typeof a.click === 'object' && !(a.click.role && a.click.name)) {
      fail(`${where}.actions[${j}]: "click" object needs "role" and "name"`);
    }
  }
}

const selected = only.length ? shots.filter(s => only.includes(s.name)) : shots;
const missing = only.filter(n => !seen.has(n));
if (missing.length) fail(`not in ${guide}.shots.json: ${missing.join(', ')}`);
if (!selected.length) {
  console.log(`capture: ${guide}.shots.json has no shots, nothing to do`);
  process.exit(0);
}

const outDir = resolve(HERE, '.raw', guide).replace(/\\/g, '/');
mkdirSync(outDir, { recursive: true });

// Serialised into playwright-cli's sandbox: no require, fetch or setTimeout.
async function runner(page, config) {
  const { shots, outDir, baseUrl } = config;
  const HIDE_CSS = [
    '.demo-bar',        // "You're exploring sample data."
    '.toaster, jiro-toaster',
  ];
  const results = [];
  const ctx = await page.context().browser().newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();

  // Sign in to the demo once, the way a visitor does.
  await p.goto(baseUrl + '/');
  await p.getByRole('button', { name: 'Try the demo' }).click();
  try {
    await p.waitForURL('**/dashboard', { timeout: 30000 });
  } catch {
    const msg = await p.locator('[role="alert"]').first().textContent().catch(() => '');
    await ctx.close();
    return { error: 'demo sign-in failed' + (msg ? ': ' + msg.trim() : '') };
  }

  const settle = async () => {
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.evaluate(() => document.fonts.ready.then(() => true));
    await p.waitForTimeout(400);
  };

  for (const shot of shots) {
    const vp = shot.viewport || { width: 1280, height: 800 };
    await p.setViewportSize(vp);
    const files = [];
    try {
      for (const theme of ['light', 'dark']) {
        await p.evaluate(dark => {
          if (dark) localStorage.setItem('jiro_dark', '1');
          else localStorage.removeItem('jiro_dark');
        }, theme === 'dark');
        await p.goto(baseUrl + shot.path);
        await p.addStyleTag({
          content: HIDE_CSS.concat(shot.hide || []).join(',\n') + ' { display: none !important; }',
        });
        if (shot.waitFor) await p.locator(shot.waitFor).first().waitFor({ state: 'visible', timeout: 15000 });
        await settle();

        for (const a of shot.actions || []) {
          if ('click' in a) {
            const loc = typeof a.click === 'string'
              ? p.locator(a.click).first()
              : p.getByRole(a.click.role, { name: a.click.name, exact: !!a.click.exact }).first();
            await loc.click();
          } else if ('fill' in a) {
            await p.locator(a.fill).first().fill(a.value);
          } else if ('press' in a) {
            await p.keyboard.press(a.press);
          } else if ('scroll' in a) {
            await p.locator(a.scroll).first().scrollIntoViewIfNeeded();
          } else if ('wait' in a) {
            await p.waitForTimeout(a.wait);
          }
        }
        await settle();

        // The app scrolls inside <body>: shoot the viewport clipped to the element, or main minus the phone bars.
        const target = p.locator(shot.clip || 'main.content').first();
        if (shot.clip) {
          await target.scrollIntoViewIfNeeded();
          await p.waitForTimeout(150);
        }
        const box = await target.boundingBox();
        if (!box) throw new Error('clip element not visible: ' + (shot.clip || 'main.content'));
        let top = 0;
        let bottom = vp.height;
        if (!shot.clip) {
          const bars = await p.evaluate(() => {
            const r = sel => {
              const el = document.querySelector(sel);
              if (!el || getComputedStyle(el).display === 'none') return null;
              return el.getBoundingClientRect();
            };
            const t = r('.mobile-topbar');
            const n = r('.mobile-nav');
            return { top: t ? t.bottom : 0, bottom: n ? n.top : null };
          });
          top = bars.top;
          if (bars.bottom !== null) bottom = bars.bottom;
        }
        const x = Math.max(0, box.x);
        const y = Math.max(top, box.y);
        const clip = {
          x, y,
          width: Math.min(vp.width, box.x + box.width) - x,
          height: Math.min(bottom, box.y + box.height) - y,
        };
        const file = outDir + '/' + shot.name + '-' + theme + '.png';
        await p.screenshot({ path: file, clip, animations: 'disabled', caret: 'hide' });
        files.push({ theme, file, cssWidth: Math.round(clip.width), cssHeight: Math.round(clip.height),
          cut: box.height > clip.height + 1 || box.width > clip.width + 1 });
      }
      results.push({ name: shot.name, ok: true, files });
    } catch (e) {
      results.push({ name: shot.name, ok: false, error: String(e && e.message || e).split('\n')[0] });
    }
  }
  await p.evaluate(() => localStorage.removeItem('jiro_dark')).catch(() => {});
  await ctx.close();
  return { results };
}

const config = { shots: selected, outDir, baseUrl: BASE_URL };
const script = `async page => {\n  const config = ${JSON.stringify(config)};\n  const runner = ${runner.toString()};\n  return JSON.stringify(await runner(page, config));\n}\n`;
const scriptPath = join(tmpdir(), `guide-shots-${guide}-${process.pid}.js`);
writeFileSync(scriptPath, script);

const session = `-s=guide-${guide}`;
const cli = (...args) => spawnSync('playwright-cli', [session, ...args], { encoding: 'utf8', shell: true });

cli('close'); // a session left over from a crashed run
const opened = cli('open');
if (opened.status !== 0) fail(`playwright-cli open failed:\n${opened.stderr || opened.stdout}`);

console.log(`capture: ${selected.length} shot(s) for ${guide}, light and dark ...`);
const run = cli('--raw', 'run-code', `--filename=${scriptPath}`);
cli('close');
rmSync(scriptPath, { force: true });

let out;
try {
  out = JSON.parse(run.stdout.trim());
  if (typeof out === 'string') out = JSON.parse(out);
} catch {
  fail(`run-code failed:\n${run.stdout}\n${run.stderr}`);
}
if (out.error) fail(out.error);

let failed = 0;
for (const r of out.results) {
  if (!r.ok) {
    failed++;
    console.log(`  FAIL ${r.name}: ${r.error}`);
    continue;
  }
  for (const f of r.files) {
    const note = f.cut ? '  (element taller or wider than the viewport: cut to fit)' : '';
    console.log(`  ok   ${r.name}-${f.theme}.png  ${f.cssWidth}x${f.cssHeight} css px${note}`);
  }
}
console.log(failed ? `capture: ${failed} shot(s) failed` : `capture: done. Next: python scripts/guide-shots/to-webp.py ${guide}`);
process.exit(failed ? 1 : 0);
