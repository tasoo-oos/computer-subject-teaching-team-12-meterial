// 시안을 단일 HTML로 빌드한다: node scripts/build-single.mjs src1 [src2 src3]
// 결과: single/<앱>.html (이 파일 하나만 있으면 브라우저로 바로 열린다)
import { build } from 'vite';
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const apps = process.argv.slice(2).filter((a) => /^src[1-3]$/.test(a));
if (!apps.length) {
  console.error('사용법: node scripts/build-single.mjs src1 [src2 src3]');
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'single'), { recursive: true });

for (const app of apps) {
  const appDir = resolve(root, app);
  const outDir = resolve(root, '.single-build', app);
  process.env.APP_DIR = appDir;
  await build({
    root: appDir,
    configFile: resolve(root, 'scripts/single.config.ts'),
    logLevel: 'warn',
    build: { outDir },
  });
  const html = resolve(outDir, 'index.html');
  const target = resolve(root, 'single', `${app}.html`);
  await copyFile(html, target);
  await rm(outDir, { recursive: true, force: true });
  const { size } = await stat(target);
  console.log(`${app} → single/${app}.html (${(size / 1024 / 1024).toFixed(1)} MB)`);
}
