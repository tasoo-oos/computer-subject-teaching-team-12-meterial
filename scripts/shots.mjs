// 시안 스크린숏: node scripts/shots.mjs src1 [--only=id1,id2] [--viewports=laptop,tablet,phone]
// 결과: shots/<app>/<fixture>--<viewport>.png
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const VIEWPORTS = {
  laptop: { width: 1366, height: 768 },
  tablet: { width: 1024, height: 768 },
  tabletPortrait: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
};

const [app, ...rest] = process.argv.slice(2);
if (!app || !/^src[1-3]$/.test(app)) {
  console.error('사용법: node scripts/shots.mjs src1 [--only=id1,id2] [--viewports=laptop,tablet,phone]');
  process.exit(1);
}
const opt = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const viewports = (opt.viewports ?? 'laptop,tablet,phone').split(',');
const only = opt.only ? opt.only.split(',') : null;

const root = resolve(import.meta.dirname, '..', app);
const outDir = resolve(import.meta.dirname, '..', 'shots', app);
await mkdir(outDir, { recursive: true });

const { FIXTURES } = await import(resolve(import.meta.dirname, '..', 'packages/core/src/fixtures.ts')).catch(() => ({ FIXTURES: null }));

const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { port: 5190 + Number(app.slice(3)), strictPort: false },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch();
try {
  let ids = only;
  if (!ids) {
    // core를 직접 import할 수 없으면 페이지에서 목록을 읽는다
    if (FIXTURES) ids = FIXTURES.map((f) => f.id);
    else {
      const p = await browser.newPage();
      await p.goto(`${base}?shot`);
      ids = await p.evaluate(async () => (await import('/@id/@gagyebu/core')).FIXTURES.map((f) => f.id));
      await p.close();
    }
  }
  const errors = [];
  for (const vp of viewports) {
    const size = VIEWPORTS[vp];
    if (!size) throw new Error(`알 수 없는 viewport: ${vp}`);
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(`[${vp}] ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${vp}] console: ${m.text()}`));
    for (const id of ids) {
      await page.goto(`${base}?shot#/${id}`);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(Number(opt.wait ?? 600));
      const file = resolve(outDir, `${id}--${vp}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await page.close();
  }
  if (errors.length) {
    console.error('\n페이지 오류:');
    for (const e of [...new Set(errors)]) console.error(' ', e);
    process.exitCode = 2;
  }
} finally {
  await browser.close();
  await server.close();
}
