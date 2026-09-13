import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

/**
 * Polyfills Express-like helper methods onto Node's res and req
 */
function enhanceRes(res) {
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    this.end(JSON.stringify(data));
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    // Parse body for POST/PUT/PATCH
    let body = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const rawBody = Buffer.concat(buffers).toString('utf-8');
        if (rawBody && rawBody.trim().length > 0) {
          body = JSON.parse(rawBody);
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    req.body = body;
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    // Dynamically resolve handler from api/ folder
    // e.g. /api/content -> api/content.js
    // e.g. /api/admin/login -> api/admin/login.js
    const relativeApi = pathname.replace(/^\/api\//, '');
    let apiFilePath = path.resolve(rootDir, 'api', `${relativeApi}.js`);

    if (!fs.existsSync(apiFilePath) && pathname.startsWith('/api/admin/')) {
      const route = pathname.replace(/^\/api\/admin\/?/, '');
      req.query = { ...req.query, route };
      apiFilePath = path.resolve(rootDir, 'api', 'admin', '[route].js');
    }

    if (fs.existsSync(apiFilePath)) {
      try {
        const module = await import(`file://${apiFilePath}?t=${Date.now()}`);
        const handler = module.default;
        if (typeof handler === 'function') {
          return await handler(req, res);
        }
      } catch (err) {
        console.error(`Error executing ${apiFilePath}:`, err);
        return res.status(500).json({ error: 'Internal server error executing API handler', details: err.message });
      }
    }

    return res.status(404).json({ error: `API route not found: ${pathname}` });
  }

  // Route /resume.pdf to api/resume.js
  if (pathname === '/resume.pdf') {
    try {
      const resumeModule = await import(`file://${path.resolve(rootDir, 'api/resume.js')}?t=${Date.now()}`);
      return await resumeModule.default(req, res);
    } catch (_) {}
  }

  // Rewrite /admin to /admin/index.html if exists, or /admin.html
  let filePath = path.join(publicDir, pathname);
  if (pathname === '/admin' || pathname === '/admin/') {
    filePath = path.join(publicDir, 'admin', 'index.html');
  } else if (pathname === '/' || pathname === '') {
    filePath = path.join(publicDir, 'index.html');
  }

  // Security check to avoid directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.status(403).end('Forbidden');
    return;
  }

  // Serve static file
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Check if path + .html exists
    if (fs.existsSync(`${filePath}.html`)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(`${filePath}.html`).pipe(res);
      return;
    }

    res.status(404).end('Not Found');
  }
});

server.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`🚀 Portfolio Dev Server running at http://localhost:${PORT}`);
  console.log(`• Public API: http://localhost:${PORT}/api/content`);
  console.log(`• Contact:    http://localhost:${PORT}/api/contact`);
  console.log(`• Admin:      http://localhost:${PORT}/admin`);
  console.log('====================================================');

  try {
    const { ensureSeeded } = await import('../api/_lib/seed.js');
    await ensureSeeded();
  } catch (err) {
    console.warn('Initial seed check:', err.message);
  }
});
