/**
 * Tài khoản MathMate: đăng ký, đăng nhập, phiên, hồ sơ, đổi mật khẩu.
 * - Mật khẩu: PBKDF2-SHA256, 100.000 vòng, salt riêng cho từng người.
 * - Phiên: mã ngẫu nhiên 32 byte trong cookie HttpOnly; DB chỉ lưu bản băm.
 */
const COOKIE = 'mm_session';
const ITER = 100000;
const DAY = 86400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GRADES = new Set(['9', '10', '11', '12']);
const TEACH = new Set(['', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'Nhiều khối']);
const enc = new TextEncoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const str = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : rand(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function strongPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

// Thông tin người dùng trả về cho trình duyệt (không bao giờ kèm mật khẩu)
const publicUser = (u) => ({
  name: u.name, email: u.email, role: u.role, grade: u.grade,
  school: u.school, teach: u.teach, approved: !!u.approved,
});

function readCookie(request, name) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}

function sessionCookie(token, remember, secure) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (remember) parts.push(`Max-Age=${30 * DAY}`);
  return parts.join('; ');
}
const clearCookie = (secure) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

async function createSession(env, request, userId, remember) {
  const token = hex(rand(32));
  const days = remember ? 30 : 1;
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, remember, user_agent)
     VALUES (?, ?, datetime('now', ?), ?, ?)`
  ).bind(await sha256(token), userId, `+${days} days`, remember ? 1 : 0, str(request.headers.get('User-Agent'), 200)).run();
  await env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(userId).run();
  return sessionCookie(token, remember, new URL(request.url).protocol === 'https:');
}

// Người dùng đang đăng nhập (hoặc null)
export async function currentUser(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
  ).bind(await sha256(token)).first();
}

// ══════════ Các API ══════════
async function register(request, env, body) {
  const email = str(body.email, 120).toLowerCase();
  const name = str(body.name, 80);
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  const errors = {};
  if (name.length < 2) errors.name = 'Nhập họ và tên của bạn';
  if (!EMAIL_RE.test(email)) errors.email = 'Nhập email đúng định dạng, ví dụ ban@gmail.com';
  if (!strongPassword(body.password)) errors.password = 'Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số';
  const grade = str(body.grade, 4), school = str(body.school, 120), teach = str(body.teach, 20);
  if (role === 'student' && !GRADES.has(grade)) errors.grade = 'Chọn lớp bạn đang học';
  if (role === 'teacher' && school.length < 3) errors.school = 'Nhập tên trường bạn đang dạy';
  if (role === 'teacher' && !TEACH.has(teach)) errors.teach = 'Chọn khối lớp';
  if (Object.keys(errors).length) return json({ error: 'Thông tin chưa hợp lệ', fields: errors }, 400);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return json({ error: 'Email này đã được đăng ký', fields: { email: 'Email này đã được đăng ký. Bạn thử đăng nhập nhé.' } }, 409);

  const pw = await hashPassword(body.password);
  const res = await env.DB.prepare(
    `INSERT INTO users (email, name, role, grade, school, teach, pw_hash, pw_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(email, name, role, role === 'student' ? grade : '', role === 'teacher' ? school : '', role === 'teacher' ? teach : '', pw.hash, pw.salt).run();
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(res.meta.last_row_id).first();
  const cookie = await createSession(env, request, user.id, true);
  return json({ user: publicUser(user) }, 201, { 'Set-Cookie': cookie });
}

async function login(request, env, body) {
  const email = str(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || !password) return json({ error: 'Email hoặc mật khẩu không đúng' }, 401);

  const fails = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_fails WHERE email = ? AND created_at > datetime('now', '-15 minutes')`
  ).bind(email).first();
  if (fails && fails.n >= 5) return json({ error: 'Bạn đã nhập sai quá nhiều lần. Thử lại sau 15 phút nhé.' }, 429);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // Vẫn tính băm khi không có tài khoản, để thời gian phản hồi giống nhau
  const check = await hashPassword(password, user ? user.pw_salt : b64(rand(16)));
  if (!user || !sameBytes(check.hash, user.pw_hash)) {
    await env.DB.prepare('INSERT INTO login_fails (email) VALUES (?)').bind(email).run();
    return json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_fails WHERE email = ?').bind(email).run();
  const cookie = await createSession(env, request, user.id, body.remember !== false);
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': cookie });
}

async function logout(request, env) {
  const token = readCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(new URL(request.url).protocol === 'https:') });
}

async function updateProfile(env, user, body) {
  const name = str(body.name, 80);
  const errors = {};
  if (name.length < 2) errors.name = 'Nhập họ và tên của bạn';
  let grade = user.grade, school = user.school;
  if (user.role === 'student') {
    grade = str(body.grade, 4);
    if (!GRADES.has(grade)) errors.grade = 'Chọn lớp bạn đang học';
  } else if (user.role === 'teacher') {
    school = str(body.school, 120);
    if (school.length < 3) errors.school = 'Nhập tên trường bạn đang dạy';
  }
  if (Object.keys(errors).length) return json({ error: 'Thông tin chưa hợp lệ', fields: errors }, 400);
  await env.DB.prepare('UPDATE users SET name = ?, grade = ?, school = ? WHERE id = ?').bind(name, grade, school, user.id).run();
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return json({ user: publicUser(fresh) });
}

async function changePassword(request, env, user, body) {
  const cur = typeof body.current === 'string' ? body.current : '';
  const check = await hashPassword(cur, user.pw_salt);
  if (!sameBytes(check.hash, user.pw_hash)) return json({ error: 'Mật khẩu hiện tại không đúng', fields: { current: 'Mật khẩu hiện tại không đúng' } }, 400);
  if (!strongPassword(body.password)) return json({ error: 'Mật khẩu mới chưa đủ mạnh', fields: { password: 'Mật khẩu mới cần ít nhất 8 ký tự, có cả chữ và số' } }, 400);
  if (body.password === cur) return json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại', fields: { password: 'Mật khẩu mới phải khác mật khẩu hiện tại' } }, 400);
  const pw = await hashPassword(body.password);
  await env.DB.prepare('UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?').bind(pw.hash, pw.salt, user.id).run();
  // Đăng xuất mọi thiết bị khác, giữ lại phiên hiện tại
  const token = readCookie(request, COOKIE);
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, await sha256(token)).run();
  return json({ ok: true });
}

// Bộ định tuyến /api/auth/*
export async function handleAuth(request, env, path) {
  // Chống giả mạo yêu cầu từ trang khác (CSRF): chỉ nhận yêu cầu từ chính web MathMate
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Yêu cầu không hợp lệ' }, 403);

  let body = {};
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > 4000) return json({ error: 'Dữ liệu quá lớn' }, 413);
    try { body = text ? JSON.parse(text) : {}; } catch (_) { return json({ error: 'Dữ liệu không hợp lệ' }, 400); }
  }

  if (path === '/api/auth/register' && request.method === 'POST') return register(request, env, body);
  if (path === '/api/auth/login' && request.method === 'POST') return login(request, env, body);
  if (path === '/api/auth/logout' && request.method === 'POST') return logout(request, env);

  const user = await currentUser(request, env);
  if (path === '/api/auth/me') return json({ user: user ? publicUser(user) : null });
  if (!user) return json({ error: 'Bạn cần đăng nhập' }, 401);
  if (path === '/api/auth/profile' && request.method === 'POST') return updateProfile(env, user, body);
  if (path === '/api/auth/password' && request.method === 'POST') return changePassword(request, env, user, body);
  return json({ error: 'Không tìm thấy' }, 404);
}
