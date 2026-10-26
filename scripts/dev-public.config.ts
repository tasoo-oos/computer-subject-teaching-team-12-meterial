// 외부 프록시(gagyebuN.taesoo.uk)로 접속할 수 있게 Host 제한을 푼 개발 서버 설정.
// 각 시안의 vite.config.ts는 건드리지 않고, 이 설정으로만 포트와 Host를 바꾼다.
import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.PORT ?? 8091);
const cwd = process.cwd();
const require = createRequire(join(cwd, 'package.json'));
const load = async (id: string) => (await import(pathToFileURL(require.resolve(id)).href)).default;
const react = await load('@vitejs/plugin-react');
const tailwindcss = await load('@tailwindcss/vite');

export default defineConfig({
  root: cwd,
  base: './',
  plugins: [react(), tailwindcss()],
  cacheDir: `/tmp/opencode/vite-cache-${port}`,
  server: { host: '0.0.0.0', port, strictPort: true, allowedHosts: true },
});
