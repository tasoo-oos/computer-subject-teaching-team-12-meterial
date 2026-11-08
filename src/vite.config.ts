// 앱 Vite 설정 (docs/live-api.md §6.6, §14 #36): base '/' + 게임 서버 프록시.
// 포트 체계: 운영 = 게임 서버 단독 8091. 개발 = 게임 서버 8092(pnpm server:dev) + Vite 5173이
// GAME_PORT(기본 8092)로 넘긴다. 단일 HTML 빌드(scripts/single.config.ts)는 base './'를 유지한다.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const gamePort = process.env.GAME_PORT ?? '8092';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/socket.io': { target: `http://localhost:${gamePort}`, ws: true },
      '/api': `http://localhost:${gamePort}`,
    },
  },
});
