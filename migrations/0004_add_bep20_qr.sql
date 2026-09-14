-- 饭碗儿 V1.3：USDT BEP20 收款图
-- 应用方式：wrangler d1 migrations apply fanwaner --local / --remote
ALTER TABLE bowls ADD COLUMN usdt_bep20_qr TEXT NOT NULL DEFAULT '';
