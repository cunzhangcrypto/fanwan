// IP 提取与日限哈希：不保存明文 IP

export function getIp(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

// 北京时间日期（用户直觉的"一天"）
export function beijingDate(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// daily_key = sha256(ip | 北京时间日期 | SERVER_SECRET)
export async function computeDailyKey(ip, secret) {
  const date = beijingDate();
  const data = `${ip}|${date}|${secret}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return {
    key: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    date,
  };
}
