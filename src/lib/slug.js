// 短 ID / 令牌生成

const SLUG_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function randomSlug(len = 8) {
  const rand = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[rand[i] % 36];
  return s;
}

export function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
