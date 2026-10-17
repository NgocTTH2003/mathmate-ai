/**
 * MathMate Worker
 * - /api/track            : ghi một sự kiện (ai cũng gọi được, dữ liệu ẩn danh)
 * - /api/admin/check      : kiểm tra mật khẩu admin
 * - /api/admin/stats      : báo cáo thống kê (cần mật khẩu admin)
 * - Mọi đường dẫn khác    : file tĩnh trong thư mục public/
 *
 * Cấu hình trên Cloudflare: binding D1 tên DB, secret ADMIN_PASSWORD.
 */

const EVENT_TYPES = new Set(['page_view', 'signup', 'login', 'practice_submit', 'soon_click']);
const ROLES = new Set(['guest', 'student', 'teacher']);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

// So sánh mật khẩu không để lộ thông tin qua thời gian phản hồi
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map((x) => crypto.subtle.digest('SHA-256', enc.encode(x))));
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  return safeEqual(request.headers.get('X-Admin-Password') || '', env.ADMIN_PASSWORD);
}

// ══════════ Ghi sự kiện ══════════
async function track(request, env) {
  const text = await request.text();
  if (text.length > 2000) return json({ ok: false }, 413);
  let e;
  try { e = JSON.parse(text); } catch (_) { return json({ ok: false }, 400); }
  if (!e || !EVENT_TYPES.has(e.type)) return json({ ok: false }, 400);
  const role = ROLES.has(e.role) ? e.role : 'guest';
  const data = e.data && typeof e.data === 'object' ? JSON.stringify(e.data).slice(0, 1000) : '{}';
  await env.DB.prepare('INSERT INTO events (type, page, sid, role, grade, data) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(e.type, clip(e.page, 120), clip(e.sid, 40), role, clip(e.grade, 4), data)
    .run();
  return json({ ok: true });
}

// ══════════ Báo cáo thống kê ══════════
async function stats(request, env) {
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const days = Math.min(365, Math.max(1, parseInt(body.days, 10) || 30));
  const since = `-${days} days`;
  const W = `created_at >= datetime('now', ?)`;
  const q = (sql) => env.DB.prepare(sql).bind(since);

  const [overview, daily, signRole, signGrade, practice, wrongQ, pages, soon, recent] = await env.DB.batch([
    q(`SELECT
         SUM(type='page_view') AS views,
         COUNT(DISTINCT CASE WHEN type='page_view' THEN sid END) AS visitors,
         SUM(type='signup') AS signups,
         SUM(type='login') AS logins,
         SUM(type='practice_submit') AS submits,
         ROUND(AVG(CASE WHEN type='practice_submit' THEN json_extract(data,'$.ten') END), 2) AS avg_score,
         SUM(type='soon_click') AS soon_clicks
       FROM events WHERE ${W}`),
    q(`SELECT date(created_at, '+7 hours') AS d, COUNT(*) AS views, COUNT(DISTINCT sid) AS visitors
       FROM events WHERE type='page_view' AND ${W} GROUP BY d ORDER BY d`),
    q(`SELECT role, COUNT(*) AS n FROM events WHERE type='signup' AND ${W} GROUP BY role ORDER BY n DESC`),
    q(`SELECT grade, COUNT(*) AS n FROM events WHERE type='signup' AND role='student' AND ${W} GROUP BY grade ORDER BY grade`),
    q(`SELECT json_extract(data,'$.set') AS set_id, COUNT(*) AS n,
              ROUND(AVG(json_extract(data,'$.ten')), 2) AS avg_score,
              SUM(json_extract(data,'$.ten') >= 8) AS good
       FROM events WHERE type='practice_submit' AND ${W} GROUP BY set_id ORDER BY n DESC`),
    q(`SELECT j.value AS question, COUNT(*) AS n
       FROM events, json_each(events.data, '$.wrong') AS j
       WHERE events.type='practice_submit' AND events.${W} GROUP BY j.value ORDER BY n DESC LIMIT 10`),
    q(`SELECT page, COUNT(*) AS n FROM events WHERE type='page_view' AND ${W} GROUP BY page ORDER BY n DESC LIMIT 10`),
    q(`SELECT json_extract(data,'$.feature') AS feature, COUNT(*) AS n
       FROM events WHERE type='soon_click' AND ${W} GROUP BY feature ORDER BY n DESC LIMIT 10`),
    q(`SELECT type, page, role, grade, data, datetime(created_at, '+7 hours') AS at
       FROM events WHERE ${W} ORDER BY id DESC LIMIT 30`),
  ]);

  return json({
    days,
    overview: overview.results[0] || {},
    daily: daily.results,
    signupsByRole: signRole.results,
    signupsByGrade: signGrade.results,
    practice: practice.results,
    wrongQuestions: wrongQ.results,
    topPages: pages.results,
    soonFeatures: soon.results,
    recent: recent.results,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST' }, 405);
      if (!env.DB) return json({ error: 'Chưa gắn database D1 (binding DB)' }, 500);
      try {
        if (path === '/api/track') return await track(request, env);
        if (path === '/api/admin/check' || path === '/api/admin/stats') {
          if (!env.ADMIN_PASSWORD) return json({ error: 'Chưa cấu hình secret ADMIN_PASSWORD' }, 500);
          if (!(await isAdmin(request, env))) return json({ error: 'Sai mật khẩu' }, 401);
          return path === '/api/admin/check' ? json({ ok: true }) : await stats(request, env);
        }
        return json({ error: 'Không tìm thấy' }, 404);
      } catch (err) {
        return json({ error: (err && err.message) || String(err) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
