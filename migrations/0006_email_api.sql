-- 0006：邮件提醒改为碗主人自配 HTTP 邮件 API（Resend 兼容）
-- email_api_url  : 发信接口地址，如 https://api.resend.com/emails
-- email_api_key  : 碗主人自己的 API Key（敏感，不对外返回）
-- email_from     : 发件人（可选，如 饭碗儿 <onboarding@resend.dev>）

ALTER TABLE bowls ADD COLUMN email_api_url TEXT NOT NULL DEFAULT '';
ALTER TABLE bowls ADD COLUMN email_api_key TEXT NOT NULL DEFAULT '';
ALTER TABLE bowls ADD COLUMN email_from TEXT NOT NULL DEFAULT '';
