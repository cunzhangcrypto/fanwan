-- 饭碗儿 V1.2：USDT BEP20 收款 + 编辑时收款方式随便补
-- 应用方式：wrangler d1 migrations apply fanwaner --local / --remote
ALTER TABLE bowls ADD COLUMN usdt_bep20_address TEXT NOT NULL DEFAULT '';

-- donations 的 payment_method CHECK 约束要放行 usdt_bep20，SQLite 不支持改约束，只能重建表
CREATE TABLE donations_new (
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

INSERT INTO donations_new (id, bowl_id, nickname, amount_cents, message, payment_method, txid, is_anonymous, status, ip_hash, delete_token, created_at, approved_at)
  SELECT id, bowl_id, nickname, amount_cents, message, payment_method, txid, is_anonymous, status, ip_hash, delete_token, created_at, approved_at FROM donations;

DROP TABLE donations;
ALTER TABLE donations_new RENAME TO donations;

CREATE INDEX IF NOT EXISTS idx_donations_bowl ON donations(bowl_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_pending ON donations(status, created_at) WHERE status = 'pending';
