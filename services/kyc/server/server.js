// Workzone KYC — standalone server (Docker slice).
// Serves:
//   /api/auth/*   → login, me, change-password
//   /api/kyc/*    → KYC routes
//   everything else → static files from /app/public/

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db-pg');
const auth = require('./auth');
const routesKyc = require('./routes-kyc');

const PORT = parseInt(process.env.PORT || '3388', 10);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Anthropic-Key');
}

function respond(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) { req.destroy(); resolve({}); } });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

// ─── Static file serving ─────────────────────────────────────────────────
function sendStatic(req, res, parsedUrl) {
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  // basic traversal guard
  if (pathname.includes('..')) { res.writeHead(400); res.end('Bad path'); return; }
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(400); res.end('Bad path'); return; }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ─── Router ──────────────────────────────────────────────────────────────
async function requireUser(req, res) {
  const u = auth.getUser(req);
  if (!u) { respond(res, 401, { error: 'Unauthorized' }); return null; }
  return u;
}

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const route = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ─── AUTH ────────────────────────────────────────────────────────
  if (route === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const result = await auth.login(body.email, body.password);
    if (result.error) return respond(res, result.code, { error: result.error });
    return respond(res, 200, result);
  }

  if (route === '/api/auth/me' && method === 'GET') {
    const u = auth.getUser(req);
    return respond(res, 200, { authenticated: !!u, user: u || null });
  }

  if (route === '/api/auth/change-password' && method === 'POST') {
    const u = await requireUser(req, res); if (!u) return;
    const body = await parseBody(req);
    const r = await auth.changePassword(u.sub, body.currentPassword, body.newPassword);
    if (r.error) return respond(res, r.code, { error: r.error });
    return respond(res, 200, { ok: true });
  }

  // ─── KYC (protected) ─────────────────────────────────────────────
  if (route.startsWith('/api/kyc/')) {
    const user = auth.getUser(req);
    if (!user) return respond(res, 401, { error: 'Unauthorized' });
    const parsedURL = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const ctx = {
      route,
      url: parsedURL,
      method,
      parseBody,
      respond,
      user,
    };
    try {
      const handled = await routesKyc.handle(req, res, ctx);
      if (!handled) return respond(res, 404, { error: 'Not found' });
      return;
    } catch (e) {
      console.error('[kyc route error]', e);
      if (!res.headersSent) return respond(res, 500, { error: e.message });
      try { res.end(); } catch {}
      return;
    }
  }

  if (route.startsWith('/api/')) return respond(res, 404, { error: 'Not found' });

  // ─── Static ──────────────────────────────────────────────────────
  return sendStatic(req, res, parsedUrl);
}

// ─── Boot ────────────────────────────────────────────────────────────────
async function boot() {
  // Wait for DB ready (docker-compose healthcheck should already gate this, but be defensive)
  for (let i = 0; i < 30; i++) {
    try {
      await db.query('SELECT 1');
      break;
    } catch (e) {
      console.log(`[boot] waiting for DB (${i + 1}/30)...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await auth.seedAdminIfEmpty();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      console.error('[unhandled]', e);
      if (!res.headersSent) respond(res, 500, { error: 'internal' });
      try { res.end(); } catch {}
    });
  });
  server.listen(PORT, () => {
    console.log(`[kyc] listening on :${PORT}`);
  });
}

boot().catch((e) => { console.error('[boot fatal]', e); process.exit(1); });
