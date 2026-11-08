// 외부 프록시(gagyebu.taesoo.uk)로 접속할 수 있게 Host 제한을 푼 개발 서버 설정.
// 앱의 vite.config.ts와 같은 규칙을 따른다: base '/', 게임 서버 프록시(/socket.io ws + /api → GAME_PORT, 기본 8091).
import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.PORT ?? 8091);
const gamePort = process.env.GAME_PORT ?? '8091';
const cwd = process.cwd();
const require = createRequire(join(cwd, 'package.json'));
const load = async (id: string) => (await import(pathToFileURL(require.resolve(id)).href)).default;
const react = await load('@vitejs/plugin-react');
const tailwindcss = await load('@tailwindcss/vite');

export default defineConfig({
  root: cwd,
  base: '/',
  plugins: [react(), tailwindcss()],
  cacheDir: `/tmp/opencode/vite-cache-${port}`,
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/socket.io': { target: `http://localhost:${gamePort}`, ws: true },
      '/api': `http://localhost:${gamePort}`,
    },
  },
});
