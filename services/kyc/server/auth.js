// Simple JWT auth: login + middleware. No reset tokens, no invites.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db-pg');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('FATAL: JWT_SECRET not set (or too short). Set a long random string in .env');
  process.exit(1);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)kyc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function getUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  return verifyToken(token);
}

async function login(email, password) {
  if (!email || !password) return { error: 'email y contraseña requeridos', code: 400 };
  const { rows } = await db.query(
    'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) return { error: 'Credenciales inválidas', code: 401 };
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { error: 'Credenciales inválidas', code: 401 };
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  return {
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

async function createUser({ email, password, name, role = 'user' }) {
  if (!email || !password || !name) throw new Error('email, password, name required');
  if (password.length < 8) throw new Error('password min 8 chars');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, name, role`,
    [email, hash, name, role]
  );
  return rows[0] || null;
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) return { error: 'Ambas contraseñas requeridas', code: 400 };
  if (newPassword.length < 8) return { error: 'Mínimo 8 caracteres', code: 400 };
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) return { error: 'Usuario no encontrado', code: 404 };
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return { error: 'Contraseña actual incorrecta', code: 403 };
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
  return { ok: true };
}

async function seedAdminIfEmpty() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c > 0) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || !password) {
    console.warn('[auth] No admin seeded — ADMIN_EMAIL/ADMIN_PASSWORD not set.');
    return;
  }
  await createUser({ email, password, name, role: 'admin' });
  console.log(`[auth] Seeded admin user ${email}`);
}

module.exports = {
  login,
  createUser,
  changePassword,
  getUser,
  signToken,
  verifyToken,
  extractToken,
  seedAdminIfEmpty,
};
