// 앱을 단일 HTML로 빌드한다: pnpm single (또는 node scripts/build-single.mjs)
// 결과: single/index.html (이 파일 하나만 있으면 브라우저로 바로 열린다)
import { build } from 'vite';
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appDir = resolve(root, 'src');
const outDir = resolve(root, '.single-build');
process.env.APP_DIR = appDir;
await build({
  root: appDir,
  configFile: resolve(root, 'scripts/single.config.ts'),
  logLevel: 'warn',
  build: { outDir },
});
const html = resolve(outDir, 'index.html');
const target = resolve(root, 'single', 'index.html');
await mkdir(resolve(root, 'single'), { recursive: true });
await copyFile(html, target);
await rm(outDir, { recursive: true, force: true });
const { size } = await stat(target);
console.log(`single/index.html (${(size / 1024 / 1024).toFixed(1)} MB)`);
