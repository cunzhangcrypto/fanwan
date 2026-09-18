// 字段校验规则与工具

export const LIMITS = {
  titleMax: 50,
  wantMax: 200,
  reasonMax: 500,
  nicknameMax: 30,
  messageMax: 200,
  txidMax: 128,
  amountMaxYuan: 1000, // 元
  amountMaxCents: 100000, // 分
  pageSizeMax: 20,
};

// 清洗文本：去首尾空白 + 截断
export function clean(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

// 金额（元，字符串/数字）→ 分（整数）；非法返回 null
export function yuanToCents(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  if (cents <= 0 || cents > LIMITS.amountMaxCents) return null;
  // 最多两位小数
  if (Math.abs(n * 100 - cents) > 1e-6) return null;
  return cents;
}

export function isValidPaymentMethod(m) {
  return m === "wechat" || m === "alipay" || m === "usdt" || m === "usdt_bep20" || m === "paypal";
}

// PayPal 收款：paypal.me / paypal.com 链接，或者邮箱
export function isValidPayPalLink(u) {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s || s.length > 128) return false;
  if (/^https?:\/\/[a-z0-9.-]*(?:paypal\.me|paypal\.com)[a-zA-Z0-9/._?&=%-]*$/i.test(s)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// 企业微信机器人 webhook：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
export function isValidWecomWebhook(u) {
  return typeof u === "string" && /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]{1,80}$/.test(u.trim());
}

// Telegram chat_id：纯数字或 -100 开头的群 id
export function isValidTelegramChatId(s) {
  return typeof s === "string" && /^-?\d{5,15}$/.test(s.trim());
}

// Server酱 SendKey：SCT + 32 位十六进制（兼容老式 SCU + 数字）
export function isValidServerChanKey(s) {
  return typeof s === "string" && /^(SCT\d+[A-Za-z0-9]+|SCU\d{10,}[A-Za-z0-9]*)$/.test(s.trim());
}

// 邮箱（通知用，宽松校验）
export function isValidEmail(s) {
  return typeof s === "string" && s.trim().length <= 128 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

// 邮件 API 地址（Resend 兼容 HTTP 发信接口）：必须 https 开头
export function isValidEmailApiUrl(u) {
  return typeof u === "string" && u.trim().length <= 200 && /^https:\/\/[^\s]+\.[^\s]{2,}$/.test(u.trim());
}

// 邮件 API Key（碗主人自己的，宽松校验：re_ 开头或任意非空字符）
export function isValidEmailApiKey(k) {
  return typeof k === "string" && k.trim().length >= 6 && k.trim().length <= 128;
}

// 发件人（可选）：纯邮箱，或「别名 <邮箱>」
export function isValidEmailFrom(f) {
  const s = f.trim();
  if (s.length > 128) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || /^.{1,60}\s*<[^\s@]+@[^\s@]+\.[^\s@]{2,}>$/.test(s);
}

// BEP20 地址：0x + 40 位十六进制（总共 42 个字符）
export function isValidBep20Address(u) {
  return typeof u === "string" && /^0x[a-fA-F0-9]{40}$/.test(u);
}

// 校验本站图片 URL（只允许 /i/ 开头的相对路径）
export function isLocalImageUrl(u) {
  return typeof u === "string" && /^\/i\/[A-Za-z0-9/_.-]+$/.test(u);
}

// 自定义后缀：3-20 位，英文小写 + 数字 + 短横杠，不能以横杠开头结尾
// （老版随机 8 位 slug 也满足这个规则，向后兼容）
export const SLUG_MAX = 20;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9]$/;

// 占用了的路由/静态路径，不让用户拿去当后缀
export const RESERVED_SLUGS = new Set([
  "api", "i", "og", "css", "js", "img", "fonts", "favicon",
  "index", "bowl", "create", "admin", "404", "robots", "tips",
]);

export function isValidSlug(s) {
  return typeof s === "string" && SLUG_RE.test(s);
}
