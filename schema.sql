-- 饭碗儿 V1 完整 schema（与 migrations/0001_init.sql 同步，供阅读参考）
-- 应用用：wrangler d1 migrations apply fanwaner --local / --remote

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname   TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  ip_hash    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bowls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  user_id       INTEGER REFERENCES users(id),
  title         TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 50),
  want          TEXT NOT NULL DEFAULT '',
  reason        TEXT NOT NULL DEFAULT '',
  target_cents  INTEGER NOT NULL CHECK(target_cents > 0 AND target_cents <= 100000),
  current_cents INTEGER NOT NULL DEFAULT 0,
  deadline      TEXT,
  wechat_qr     TEXT NOT NULL DEFAULT '',
  alipay_qr     TEXT NOT NULL DEFAULT '',
  usdt_address      TEXT NOT NULL DEFAULT '',
  usdt_qr           TEXT NOT NULL DEFAULT '',
  usdt_bep20_address TEXT NOT NULL DEFAULT '',
  usdt_bep20_qr      TEXT NOT NULL DEFAULT '',
  nickname          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active','completed','expired','hidden')),
  edit_token    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bowls_status_created ON bowls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bowls_hot ON bowls(current_cents DESC);

CREATE TABLE IF NOT EXISTS donations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  bowl_id        INTEGER NOT NULL REFERENCES bowls(id) ON DELETE CASCADE,
  nickname       TEXT NOT NULL DEFAULT '',
  amount_cents   INTEGER NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 100000),
  message        TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL CHECK(payment_method IN ('wechat','alipay','usdt','usdt_bep20')),
  txid           TEXT NOT NULL DEFAULT '',
  is_anonymous   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','approved','rejected')),
  ip_hash        TEXT NOT NULL DEFAULT '',
  delete_token   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_donations_bowl ON donations(bowl_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_pending ON donations(status, created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS daily_bowl_limits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_key  TEXT NOT NULL,
  date       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(daily_key, date)
);

CREATE INDEX IF NOT EXISTS idx_dbl_date ON daily_bowl_limits(date);

CREATE TABLE IF NOT EXISTS upload_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ul_ip_time ON upload_logs(ip_hash, created_at);
