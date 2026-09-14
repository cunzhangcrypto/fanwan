-- 饭碗儿 V1.1：USDT 收款图 + 收款方式放宽
-- 应用方式：wrangler d1 migrations apply fanwaner --local / --remote
ALTER TABLE bowls ADD COLUMN usdt_qr TEXT NOT NULL DEFAULT '';
