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
