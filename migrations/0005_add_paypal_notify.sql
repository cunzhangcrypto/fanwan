-- 0005：PayPal 收款 + 留言通知渠道 + donations 表支持 paypal 支付方式
-- 注意：SQLite 改不了 CHECK 约束，donations 表整体重建（数据原样搬）

ALTER TABLE bowls ADD COLUMN paypal_link TEXT;
ALTER TABLE bowls ADD COLUMN paypal_qr TEXT;
ALTER TABLE bowls ADD COLUMN notify_wecom TEXT;
ALTER TABLE bowls ADD COLUMN notify_telegram TEXT;
ALTER TABLE bowls ADD COLUMN notify_serverchan TEXT;
ALTER TABLE bowls ADD COLUMN notify_email TEXT;

-- donations：payment_method 加 paypal，重建表
CREATE TABLE donations_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  bowl_id        INTEGER NOT NULL REFERENCES bowls(id) ON DELETE CASCADE,
  nickname       TEXT NOT NULL DEFAULT '',
  amount_cents   INTEGER NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 100000),
  message        TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL CHECK(payment_method IN ('wechat','alipay','usdt','usdt_bep20','paypal')),
  txid           TEXT NOT NULL DEFAULT '',
  is_anonymous   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','approved','rejected')),
  ip_hash        TEXT NOT NULL DEFAULT '',
  delete_token   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at    TEXT
);

INSERT INTO donations_new SELECT * FROM donations;
DROP TABLE donations;
ALTER TABLE donations_new RENAME TO donations;

CREATE INDEX idx_donations_bowl ON donations(bowl_id, status, created_at DESC);
CREATE INDEX idx_donations_pending ON donations(status, created_at) WHERE status = 'pending';
