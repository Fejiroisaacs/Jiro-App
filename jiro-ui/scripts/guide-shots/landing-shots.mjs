// Usage: node scripts/guide-shots/landing-shots.mjs [name...]
// Re-shoots public/images/landing/<name>-{light,dark}.webp from the demo account.
// Needs what capture.mjs needs (API, ng serve, playwright-cli, Python with Pillow).

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.GUIDE_SHOTS_BASE_URL || 'http://localhost:4200';
const OUT = resolve(HERE, '..', '..', 'public', 'images', 'landing').replace(/\\/g, '/');
const RAW = resolve(HERE, '.raw', 'landing').replace(/\\/g, '/');

// size: final pixels. scale: device pixel ratio. budget: max bytes per webp.
// area: the CSS-pixel box to shoot, relative to the `at` element's top left
// (no `at` means the whole viewport).
const SHOTS = [
  { name: 'dashboard', path: '/dashboard', wait: 'dash-activity-widget .act-col',
    viewport: { width: 1440, height: 900 }, scale: 1.5, size: [2160, 1350], budget: 85000 },
  { name: 'dashboard-phone', path: '/dashboard', wait: 'dash-activity-widget .act-col',
    viewport: { width: 390, height: 640 }, scale: 2, size: [780, 1280], budget: 34000 },
  { name: 'culinara', path: '/culinara', wait: '.recipe-card', viewport: { width: 1044, height: 800 },
    at: '.recipe-card', area: { x: -20, y: -6, width: 764, height: 244 }, size: [1456, 464], budget: 26000 },
  { name: 'journaly', path: '/journal', wait: '.moodtrend-rows',
    viewport: { width: 360, height: 720 }, scale: 2, size: [720, 1440], budget: 30000 },
  { name: 'jym', path: '/jym/track', wait: '.session-card', click: '.session-card', clickWait: '.detail-ex',
    at: '.detail-ex', area: { x: -12, y: -12, width: 400, height: 300 }, size: [800, 600], budget: 16000 },
  { name: 'ledger', path: '/dashboard', wait: 'dash-ledger-widget .mo-net',
    at: '.cell:has(dash-ledger-widget)', area: { x: -14, y: -14, width: 498, height: 375 },
    size: [996, 750], budget: 24000 },
];

const only = process.argv.slice(2);
const selected = only.length ? SHOTS.filter(s => only.includes(s.name)) : SHOTS;
if (!selected.length) {
  console.error(`landing-shots: pick from ${SHOTS.map(s => s.name).join(', ')}`);
  process.exit(1);
}
mkdirSync(RAW, { recursive: true });

// Serialised into playwright-cli's sandbox: no require, fetch or setTimeout.
async function runner(page, config) {
  const { shots, rawDir, baseUrl } = config;
  const HIDE = '.demo-bar, .toaster, jiro-toaster, .mobile-nav { display: none !important; }';
  const results = [];
  for (const shot of shots) {
    const vp = shot.viewport || { width: 1280, height: 800 };
    const ctx = await page.context().browser().newContext({
      viewport: vp, deviceScaleFactor: shot.scale || 2, reducedMotion: 'reduce',
    });
    const p = await ctx.newPage();
    try {
      await p.goto(baseUrl + '/');
      await p.getByRole('button', { name: 'Try the demo' }).click();
      await p.waitForURL('**/dashboard', { timeout: 30000 });
      for (const theme of ['light', 'dark']) {
        await p.evaluate(dark => {
          if (dark) localStorage.setItem('jiro_dark', '1');
          else localStorage.removeItem('jiro_dark');
        }, theme === 'dark');
        await p.goto(baseUrl + shot.path);
        await p.addStyleTag({ content: HIDE });
        await p.locator(shot.wait).first().waitFor({ state: 'visible', timeout: 15000 });
        if (shot.click) {
          await p.locator(shot.click).first().click();
          await p.locator(shot.clickWait).first().waitFor({ state: 'visible', timeout: 15000 });
        }
        await p.waitForLoadState('networkidle').catch(() => {});
        await p.evaluate(() => document.fonts.ready.then(() => true));
        await p.waitForTimeout(600);
        let clip = { x: 0, y: 0, width: vp.width, height: vp.height };
        if (shot.at) {
          const el = p.locator(shot.at).first();
          await el.scrollIntoViewIfNeeded();
          await p.waitForTimeout(150);
          const box = await el.boundingBox();
          clip = { x: box.x + shot.area.x, y: box.y + shot.area.y, width: shot.area.width, height: shot.area.height };
        }
        const file = rawDir + '/' + shot.name + '-' + theme + '.png';
        await p.screenshot({ path: file, clip, animations: 'disabled', caret: 'hide' });
      }
      results.push({ name: shot.name, ok: true });
    } catch (e) {
      results.push({ name: shot.name, ok: false, error: String(e && e.message || e).split('\n')[0] });
    }
    await ctx.close();
  }
  return { results };
}

const config = { shots: selected, rawDir: RAW, baseUrl: BASE_URL };
const script = `async page => {\n  const config = ${JSON.stringify(config)};\n  const runner = ${runner.toString()};\n  return JSON.stringify(await runner(page, config));\n}\n`;
const scriptPath = join(tmpdir(), `landing-shots-${process.pid}.js`);
writeFileSync(scriptPath, script);

const cli = (...args) => spawnSync('playwright-cli', ['-s=landing-shots', ...args], { encoding: 'utf8', shell: true });
cli('close');
const opened = cli('open');
if (opened.status !== 0) {
  console.error(`landing-shots: playwright-cli open failed:\n${opened.stderr || opened.stdout}`);
  process.exit(1);
}
console.log(`landing-shots: ${selected.length} shot(s), light and dark ...`);
const run = cli('--raw', 'run-code', `--filename=${scriptPath}`);
cli('close');
rmSync(scriptPath, { force: true });

let out;
try {
  out = JSON.parse(run.stdout.trim());
  if (typeof out === 'string') out = JSON.parse(out);
} catch {
  console.error(`landing-shots: run-code failed:\n${run.stdout}\n${run.stderr}`);
  process.exit(1);
}
const failed = out.results.filter(r => !r.ok);
for (const r of failed) console.log(`  FAIL ${r.name}: ${r.error}`);

// Resize to the exact size and step the quality down until the file fits its budget.
const PY = `
import json, os, sys
from PIL import Image
raw, out, shots = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
for s in shots:
    for theme in ("light", "dark"):
        img = Image.open(f"{raw}/{s['name']}-{theme}.png").convert("RGB")
        if img.size != tuple(s["size"]):
            img = img.resize(tuple(s["size"]), Image.LANCZOS)
        dst = f"{out}/{s['name']}-{theme}.webp"
        for q in (82, 78, 74, 70, 66, 62, 58, 54, 50):
            img.save(dst, "WEBP", quality=q, method=6)
            if os.path.getsize(dst) <= s["budget"]:
                break
        print(f"  {s['name']}-{theme}.webp  {img.width}x{img.height}  {os.path.getsize(dst)} bytes  q{q}")
`;
const done = selected.filter(s => !failed.some(f => f.name === s.name))
  .map(({ name, size, budget }) => ({ name, size, budget }));
if (done.length) {
  const py = spawnSync('python', ['-c', PY, RAW, OUT, JSON.stringify(done)], { encoding: 'utf8' });
  process.stdout.write(py.stdout);
  if (py.status !== 0) {
    console.error(py.stderr);
    process.exit(1);
  }
}
process.exit(failed.length ? 1 : 0);
