// 앱 Vite 설정 (docs/live-api.md §6.6, §14 #36): base '/' + 게임 서버 프록시.
// 게임 서버 포트는 환경변수 GAME_PORT(기본 8091). 단일 HTML 빌드(scripts/single.config.ts)는 base './'를 유지한다.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const gamePort = process.env.GAME_PORT ?? '8091';

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
