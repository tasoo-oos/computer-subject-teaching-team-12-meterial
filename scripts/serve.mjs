// 정적 서버: node scripts/serve.mjs <앱 폴더> <포트>
// dist를 서비스하고, SPA 라우팅을 위해 없는 경로는 index.html로 돌려준다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const [app, portArg] = process.argv.slice(2);
if (!app || !portArg) {
  console.error('사용법: node scripts/serve.mjs src1 8091');
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..', app, 'dist');
const port = Number(portArg);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

async function send(res, file, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store, must-revalidate',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, rel);
    if (rel.endsWith('/')) file = join(file, 'index.html');
    let info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) {
      const maybeIndex = join(file, 'index.html');
      info = await stat(maybeIndex).catch(() => null);
      if (info) file = maybeIndex;
    }
    if (!info) {
      // SPA fallback
      await send(res, join(root, 'index.html'), 200);
      return;
    }
    await send(res, file);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`서버 오류: ${err.message}`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`serving ${root} on http://0.0.0.0:${port}`);
});
