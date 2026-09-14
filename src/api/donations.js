// 投喂 API：POST /api/donation、DELETE /api/donation/:id
import { ok, fail, ERR, readJson } from "../lib/resp.js";
import { clean, yuanToCents, isValidPaymentMethod, isValidSlug, LIMITS } from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { getIp, computeDailyKey } from "../lib/ip.js";
import { randomToken } from "../lib/slug.js";
import { getBowlBySlug } from "../lib/db.js";

// POST /api/donation —— 投一口
// 平台不碰钱：钱是用户直接给摆碗的兄弟伙的，这里只"记一笔"，等后台审核。
export async function createDonation(request, env) {
  const ip = getIp(request);
  const body = await readJson(request);
  if (!body) return fail(ERR.VALIDATION_ERROR, "数据没传对头，再整一哈嘛。");

  // 1. Turnstile 服务端验证
  const tsOk = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!tsOk) return fail(ERR.TURNSTILE_FAILED, "先证明你不是机器人嘛。", 403);

  // 2. 参数检查
  if (!body.slug || !isValidSlug(body.slug)) {
    return fail(ERR.VALIDATION_ERROR, "这个饭碗儿好像没摆起。");
  }
  const bowl = await getBowlBySlug(env.DB, body.slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  if (bowl.status !== "active") {
    return fail(ERR.CONFLICT, "这个饭碗儿已经收摊了，投不得喽。", 409);
  }

  const amountCents = yuanToCents(body.amount);
  if (amountCents === null) return fail(ERR.VALIDATION_ERROR, "你这个金额有点不对头哈。");

  const message = clean(body.message, LIMITS.messageMax);
  const nickname = clean(body.nickname, LIMITS.nicknameMax);
  const paymentMethod = body.paymentMethod;
  if (!isValidPaymentMethod(paymentMethod)) {
    return fail(ERR.VALIDATION_ERROR, "啷个投的选一个嘛。");
  }
  const txid = clean(body.txid, LIMITS.txidMax);
  const isAnonymous = body.isAnonymous ? 1 : 0;

  // IP 不存明文：投喂记录也只落哈希（莫让别个从库里扒出你的 IP）
  const { key: ipHash } = await computeDailyKey(ip, env.SERVER_SECRET);

  // 3. 写入 donations（pending，等后台审核）
  const deleteToken = randomToken();
  const res = await env.DB.prepare(
    `INSERT INTO donations
       (bowl_id, nickname, amount_cents, message, payment_method, txid, is_anonymous, status, ip_hash, delete_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  )
    .bind(bowl.id, nickname, amountCents, message, paymentMethod, txid, isAnonymous, ipHash.slice(0, 32), deleteToken)
    .run();

  return ok({ id: res.meta.last_row_id, deleteToken }, 201);
}

// DELETE /api/donation/:id?token=xxx —— 投喂人自己撤（仅 pending 可撤）
export async function deleteDonation(request, env, id) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const row = await env.DB.prepare("SELECT * FROM donations WHERE id = ?").bind(id).first();
  if (!row) return fail(ERR.NOT_FOUND, "这笔投喂没找到。", 404);
  if (row.status !== "pending") {
    return fail(ERR.CONFLICT, "这口饭已经被端走了，撤不脱喽。", 409);
  }
  if (!token || token !== row.delete_token) {
    return fail(ERR.UNAUTHORIZED, "这不是你投的那口。", 401);
  }
  await env.DB.prepare("DELETE FROM donations WHERE id = ? AND status = 'pending'").bind(id).run();
  return ok({ id: Number(id) });
}
