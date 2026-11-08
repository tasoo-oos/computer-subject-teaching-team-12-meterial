// 앱을 단일 HTML 파일로 빌드하는 설정.
// - 폰트는 woff2만 남기고 CSS에 data URI로 넣는다 (모던 브라우저는 woff2를 모두 지원).
// - 자바스크립트와 CSS는 vite-plugin-singlefile이 index.html 안으로 합친다.
import { defineConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

const cwd = process.env.APP_DIR ?? process.cwd();
const require = createRequire(join(cwd, 'package.json'));
const load = async (id: string) => (await import(pathToFileURL(require.resolve(id)).href)).default;
const react = await load('@vitejs/plugin-react');
const tailwindcss = await load('@tailwindcss/vite');

/** @fontsource CSS의 woff 대체 폰트 참조를 지운다 */
function dropWoff(): Plugin {
  return {
    name: 'drop-woff',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css')) return null;
      const next = code.replace(
        /,\s*url\((?:"|')?[^)"']*\.woff(?:\?[^)"']*)?(?:"|')?\)\s*format\((?:"|')woff(?:"|')\)/g,
        '',
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  root: cwd,
  base: './',
  plugins: [react(), tailwindcss(), dropWoff(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: process.env.OUT_DIR ?? 'dist-single',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
