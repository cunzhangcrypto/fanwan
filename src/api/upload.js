// 图片上传 API：POST /api/upload?kind=avatar|wechat_qr|alipay_qr|usdt_qr|usdt_bep20_qr
// 前端直接传 raw body（webp 图片二进制），Worker 校验后写入 R2，返回 /i/... URL。
import { ok, fail, ERR } from "../lib/resp.js";
import { getIp, computeDailyKey } from "../lib/ip.js";

// 统一只存 webp：前端传图会自动转成 webp（canvas），这里魔数校验兜底，
// 保证 R2 里全是 webp，省空间也省流量。
function isWebp(buf) {
  if (buf.byteLength < 12) return false;
  const b = new Uint8Array(buf);
  // RIFF....WEBP
  return (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  );
}

const KINDS = ["avatar", "wechat_qr", "alipay_qr", "usdt_qr", "usdt_bep20_qr", "paypal_qr"];
const RATE_LIMIT_PER_MINUTE = 5;

export async function uploadImage(request, env) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  if (!KINDS.includes(kind)) {
    return fail(ERR.VALIDATION_ERROR, "图片类型没传对头。");
  }

  const ip = getIp(request);
  const { key: ipHash } = await computeDailyKey(ip, env.SERVER_SECRET);

  // 轻量 IP 限流：同一 IP 每分钟最多 5 张
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM upload_logs
     WHERE ip_hash = ? AND created_at > datetime('now', '-60 seconds')`
  )
    .bind(ipHash.slice(0, 32))
    .first();
  if ((recent?.c || 0) >= RATE_LIMIT_PER_MINUTE) {
    return fail(ERR.RATE_LIMITED, "传得有点多了，歇一哈嘛。", 429);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return fail(ERR.VALIDATION_ERROR, "图片没传起。");
  }
  if (body.byteLength > env.MAX_UPLOAD_BYTES) {
    return fail(ERR.VALIDATION_ERROR, "图片太大了，2MB 以内哈。");
  }

  // 只收 webp：魔数优先，header 不算数（莫让别个伪造 Content-Type 绕过）
  if (!isWebp(body)) {
    return fail(ERR.VALIDATION_ERROR, "图片格式没对头，现在只收 webp（前端传图会自动转成 webp，再选一张试试）。");
  }
  const contentType = "image/webp";
  const ext = "webp";

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `${kind}/${ym}/${crypto.randomUUID()}.${ext}`;

  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType },
  });
  await env.DB.prepare("INSERT INTO upload_logs (ip_hash) VALUES (?)").bind(ipHash.slice(0, 32)).run();

  return ok({ url: `/i/${key}` }, 201);
}
