// 슬라이드 표시기(SlideCanvas) 스모크: node scripts/smoke-slides.mjs
// /dev#/slides (시험용 sample 덱, 단계 공개 포함)를 laptop·tablet·tabletPortrait·phone 4크기로 찍는다.
// 찍는 중 [다음] 버튼으로 모든 비트(hello → why--0..2 → rules)를 순환하며 페이지 오류를 검사한다(M8 검증).
// 결과: shots/slides-smoke--<viewport>.png, 오류 있으면 종료 코드 2 (shots.mjs와 같은 규칙).
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

const root = resolve(import.meta.dirname, '..', 'src');
const outDir = resolve(import.meta.dirname, '..', 'shots');
await mkdir(outDir, { recursive: true });

const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { port: 5191, strictPort: false },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch();
const errors = [];
try {
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'control' }) }),
    );
    page.on('pageerror', (e) => errors.push(`[${vp}] ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${vp}] console: ${m.text()}`));
    await page.goto(`${base}dev#/slides`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // sample 덱은 비트 5개(hello, why--0..2, rules). [다음]으로 전부 순환한다
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('slide-next').click();
      await page.waitForTimeout(150);
    }
    const file = resolve(outDir, `slides-smoke--${vp}.png`);
    await page.screenshot({ path: file });
    console.log(file);
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
