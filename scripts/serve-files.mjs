// 파일 목록 서버: node scripts/serve-files.mjs <폴더> <포트> [제목]
import { createServer } from 'node:http';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const [dir, portArg, title = '파일'] = process.argv.slice(2);
if (!dir || !portArg) {
  console.error('사용법: node scripts/serve-files.mjs <폴더> <포트> [제목]');
  process.exit(1);
}
const root = resolve(dir);
const port = Number(portArg);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
};

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (path === '/' || path === '/index.html') {
    const names = (await readdir(root).catch(() => [])).filter((n) => !n.startsWith('.'));
    const rows = [];
    for (const name of names) {
      const st = await stat(join(root, name)).catch(() => null);
      if (!st) continue;
      rows.push(
        `<li><a href="/${encodeURIComponent(name)}">${esc(name)}</a> <span>${(st.size / 1024 / 1024).toFixed(1)} MB</span></li>`,
      );
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:40px auto;max-width:720px;padding:0 20px;color:#222}
h1{font-size:22px}li{margin:6px 0}span{color:#777;font-size:13px;margin-left:8px}</style>
<h1>${esc(title)}</h1><ul>${rows.join('')}</ul>`);
    return;
  }
  const file = join(root, path.replace(/^\/+/, ''));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  const body = await readFile(file).catch(() => null);
  if (!body) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('없는 파일');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
}).listen(port, '0.0.0.0', () => console.log(`files ${root} on http://0.0.0.0:${port}`));
