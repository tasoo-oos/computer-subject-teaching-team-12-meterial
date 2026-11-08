// 외부 프록시(gagyebu.taesoo.uk)로 접속할 수 있게 Host 제한을 푼 개발 서버 설정.
// 앱의 vite.config.ts와 같은 규칙을 따른다: base '/', 게임 서버 프록시(/socket.io ws + /api → GAME_PORT).
// 포트 체계: 운영 = 게임 서버 단독 8091(src/dist 서비스). 개발 = 게임 서버 8092(PORT=8092) +
// Vite(이 설정의 PORT, 기본 8091 = LAN 공개)가 GAME_PORT(기본 8092)로 넘긴다.
// 기본값끼리는 Vite가 자기 자신(8091)으로 프록시하지 않게 GAME_PORT 기본을 8092로 둔다.
import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.PORT ?? 8091);
const gamePort = process.env.GAME_PORT ?? '8092';
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
