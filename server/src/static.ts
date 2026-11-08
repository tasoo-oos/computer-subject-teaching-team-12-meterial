// 정적 파일 + 캐시 헤더 + 알려진 경로만 앱 (docs/live-api.md §6.1, §6.5).
// scripts/serve.mjs의 역할을 흡수한다(§14 #37). 404 정책: 아래 표의 경로만 앱으로 보낸다.
import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';

const TYPES: Record<string, string> = {
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

/** 학생 코드 주소: /<숫자 4자리> (§6.1). 전부 4자리 숫자 패턴으로만 판별한다(§8.4). */
export function isClassCodePath(pathname: string): boolean {
  return /^\/[0-9]{4}$/.test(pathname);
}

export interface StaticHandler {
  (req: IncomingMessage, res: ServerResponse, pathname: string): void;
}

/**
 * 정적 핸들러를 만든다. 알려진 경로(`/`, `/<4자리>`, `/stage`, `/control`, `/dev`,
 * `/solo`(SOLO_ENABLED))는 index.html을 `no-store`로, `/assets/*`는 dist/assets에서
 * `immutable`로 서빙하고, 나머지는 전부 404 (§6.1 404 정책).
 */
export function createStaticHandler(distDir: string, soloEnabled: boolean): StaticHandler {
  const root = resolve(distDir);
  const indexFile = join(root, 'index.html');

  const appPaths = new Set(['/', '/stage', '/control', '/dev']);
  if (soloEnabled) appPaths.add('/solo');

  return (_req, res, pathname) => {
    try {
      if (appPaths.has(pathname) || isClassCodePath(pathname)) {
        serveFile(res, indexFile, 200, 'no-store');
        return;
      }
      if (pathname.startsWith('/assets/')) {
        // 경로 조작 방지: 정규화 뒤 root 안인지 확인한다.
        const rel = normalize(decodeURIComponent(pathname)).replace(/^([.][.][/\\])+/, '');
        const file = resolve(join(root, rel));
        if (file !== root && !file.startsWith(root + sep)) {
          notFound(res);
          return;
        }
        let info;
        try {
          info = statSync(file);
        } catch {
          notFound(res);
          return;
        }
        if (!info.isFile()) {
          notFound(res);
          return;
        }
        serveFile(res, file, 200, 'public, max-age=31536000, immutable');
        return;
      }
      notFound(res);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('서버 오류');
    }
  };
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('404 Not Found');
}

function serveFile(res: ServerResponse, file: string, status: number, cacheControl: string): void {
  try {
    const stat = statSync(file);
    res.writeHead(status, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': cacheControl,
    });
    const stream: Readable = createReadStream(file);
    stream.pipe(res); // HEAD 요청이면 Node가 body를 버린다(ServerResponse._hasBody)
    stream.on('error', () => {
      res.destroy();
    });
  } catch {
    notFound(res);
  }
}
