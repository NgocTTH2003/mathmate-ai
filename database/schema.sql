-- Database MathMate (Cloudflare D1): lưu sự kiện để làm báo cáo thống kê
-- Chạy an toàn nhiều lần: chỉ tạo bảng nếu chưa có.

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,              -- page_view, signup, login, practice_submit, soon_click
  page       TEXT NOT NULL DEFAULT '',   -- trang phát sinh sự kiện, ví dụ /lam-bai.html
  sid        TEXT NOT NULL DEFAULT '',   -- mã ẩn danh của trình duyệt (không phải tên, email)
  role       TEXT NOT NULL DEFAULT 'guest', -- guest, student, teacher
  grade      TEXT NOT NULL DEFAULT '',   -- lớp của học sinh (9–12)
  data       TEXT NOT NULL DEFAULT '{}', -- thông tin thêm dạng JSON (điểm, tính năng được bấm...)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))  -- giờ UTC
);

CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at);

-- ══════════ Tài khoản người dùng ══════════
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,              -- luôn lưu chữ thường
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student',   -- student, teacher, admin
  grade         TEXT NOT NULL DEFAULT '',          -- học sinh: 9–12
  school        TEXT NOT NULL DEFAULT '',          -- giáo viên: trường
  teach         TEXT NOT NULL DEFAULT '',          -- giáo viên: khối dạy
  approved      INTEGER NOT NULL DEFAULT 0,        -- giáo viên đã được duyệt chưa
  email_verified INTEGER NOT NULL DEFAULT 0,
  pw_hash       TEXT NOT NULL,                     -- PBKDF2-SHA256, không lưu mật khẩu gốc
  pw_salt       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- Phiên đăng nhập: chỉ lưu bản băm của mã phiên (mã gốc nằm trong cookie của người dùng)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  remember   INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Đăng nhập sai: chặn dò mật khẩu (5 lần sai / 15 phút)
CREATE TABLE IF NOT EXISTS login_fails (
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_fails ON login_fails(email, created_at);
