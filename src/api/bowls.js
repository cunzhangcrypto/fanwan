// 饭碗儿 API：列表 / 创建 / 详情 / 编辑
import { ok, fail, ERR, readJson } from "../lib/resp.js";
import {
  clean,
  yuanToCents,
  isLocalImageUrl,
  isValidSlug,
  isValidBep20Address,
  RESERVED_SLUGS,
  LIMITS,
} from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { getIp, computeDailyKey } from "../lib/ip.js";
import { randomSlug, randomToken } from "../lib/slug.js";
import { getBowlBySlug, formatBowl, formatDonation, isUniqueConflict } from "../lib/db.js";

export async function handleConfig(env) {
  return ok({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    maxAmountYuan: env.MAX_AMOUNT_YUAN || LIMITS.amountMaxYuan,
  });
}

// GET /api/bowl?status=active&sort=newest|hottest|soonest&page=1&pageSize=10
export async function listBowls(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "active";
  const sort = url.searchParams.get("sort") || "newest";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    LIMITS.pageSizeMax,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || "10", 10) || 10)
  );

  // 懒更新：先把过期的饭碗儿标记为 expired
  await env.DB.prepare(
    `UPDATE bowls SET status='expired', updated_at=datetime('now')
     WHERE status='active' AND deadline IS NOT NULL AND deadline < datetime('now')`
  ).run();

  const where = status === "all" ? "" : "WHERE status = ?";
  const params = status === "all" ? [] : [status];

  let orderBy = "created_at DESC";
  if (sort === "hottest") orderBy = "current_cents DESC";
  else if (sort === "soonest") orderBy = "deadline ASC NULLS LAST";

  const totalRes = await env.DB.prepare(`SELECT COUNT(*) AS c FROM bowls ${where}`)
    .bind(...params)
    .first();
  const rows = await env.DB.prepare(
    `SELECT * FROM bowls ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all();

  // 耿直人人数：approved 投喂去重（匿名按 IP 算、留名的按昵称算）
  const ids = rows.results.map((r) => r.id);
  const donorMap = {};
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const d = await env.DB.prepare(
      `SELECT bowl_id,
              COUNT(DISTINCT CASE WHEN is_anonymous = 1 THEN 'a:' || ip_hash ELSE 'n:' || nickname END) AS donors
       FROM donations
       WHERE status = 'approved' AND bowl_id IN (${ph})
       GROUP BY bowl_id`
    )
      .bind(...ids)
      .all();
    for (const r of d.results) donorMap[r.bowl_id] = Number(r.donors || 0);
  }

  return ok({
    total: totalRes?.c || 0,
    page,
    pageSize,
    items: rows.results.map((r) => ({
      ...formatBowl(r),
      donorCount: donorMap[r.id] || 0,
    })),
  });
}

// POST /api/bowl 创建饭碗儿
export async function createBowl(request, env) {
  const ip = getIp(request);
  const body = await readJson(request);
  if (!body) return fail(ERR.VALIDATION_ERROR, "数据没传对头，再整一哈嘛。");

  // 1. Turnstile 服务端验证
  const tsOk = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!tsOk) return fail(ERR.TURNSTILE_FAILED, "先证明你不是机器人嘛。", 403);

  // 2. 字段校验
  const title = clean(body.title, LIMITS.titleMax);
  const want = clean(body.want, LIMITS.wantMax);
  const reason = clean(body.reason, LIMITS.reasonMax);
  const nickname = clean(body.nickname, LIMITS.nicknameMax);
  const targetCents = yuanToCents(body.targetAmount);

  // 自定义后缀（可选）：留空就随机整个 8 位的
  const slugOpt =
    body.slug !== undefined && body.slug !== null
      ? String(body.slug).trim().toLowerCase()
      : "";
  if (slugOpt && !isValidSlug(slugOpt)) {
    return fail(ERR.VALIDATION_ERROR, "后缀只准用英文小写字母、数字和短横杠（-），3 到 20 位，不能以横杠开头结尾哈。");
  }
  if (slugOpt && RESERVED_SLUGS.has(slugOpt)) {
    return fail(ERR.VALIDATION_ERROR, "这个后缀遭系统留到起在，换个嘛。");
  }

  if (!title) return fail(ERR.VALIDATION_ERROR, "饭碗儿总得喊个啥子嘛。");
  if (!reason) return fail(ERR.VALIDATION_ERROR, "为啥子要吃，总要说两句嘛。");
  if (!nickname) return fail(ERR.VALIDATION_ERROR, "叫啥子嘛，总得留个名字。");
  if (targetCents === null) return fail(ERR.VALIDATION_ERROR, "你这个金额有点不对头哈。");

  // 收款方式：三种都可选可不选，图也不是必须的，莫得收款方式一样能摆
  if (body.wechatQr && !isLocalImageUrl(body.wechatQr)) {
    return fail(ERR.VALIDATION_ERROR, "微信收款码图片没传对头。");
  }
  if (body.alipayQr && !isLocalImageUrl(body.alipayQr)) {
    return fail(ERR.VALIDATION_ERROR, "支付宝收款码图片没传对头。");
  }
  if (body.usdtQr && !isLocalImageUrl(body.usdtQr)) {
    return fail(ERR.VALIDATION_ERROR, "USDT 收款图没传对头。");
  }
  if (body.usdtAddress && (typeof body.usdtAddress !== "string" || body.usdtAddress.trim().length > 64)) {
    return fail(ERR.VALIDATION_ERROR, "USDT 地址没填对头，看清楚再填。");
  }
  if (body.usdtBep20Address && !isValidBep20Address(body.usdtBep20Address)) {
    return fail(ERR.VALIDATION_ERROR, "USDT BEP20 地址没填对头，0x 开头 42 位，看清楚哈。");
  }
  if (body.usdtBep20Qr && !isLocalImageUrl(body.usdtBep20Qr)) {
    return fail(ERR.VALIDATION_ERROR, "USDT BEP20 收款图没传对头。");
  }

  const avatarUrl = body.avatarUrl && isLocalImageUrl(body.avatarUrl) ? body.avatarUrl : "";
  let deadline = null;
  if (body.deadline) {
    const d = new Date(body.deadline);
    if (Number.isNaN(d.getTime())) {
      return fail(ERR.VALIDATION_ERROR, "截止时间没填对头。");
    }
    deadline = d.toISOString();
  }

  // 3. IP 日限：直接 INSERT，靠 UNIQUE 兜底并发
  const { key: dailyKey, date } = await computeDailyKey(ip, env.SERVER_SECRET);
  let limitInserted = false;
  try {
    const r = await env.DB.prepare(
      "INSERT INTO daily_bowl_limits (daily_key, date) VALUES (?, ?)"
    )
      .bind(dailyKey, date)
      .run();
    limitInserted = r.success;
  } catch (err) {
    if (isUniqueConflict(err)) {
      return fail(ERR.RATE_LIMITED, "你今天已经摆过饭碗儿了哈。一个饭碗儿一天摆一次，莫一天到黑摆起耍。", 429);
    }
    return fail(ERR.SERVER_ERROR, "饭碗儿没摆稳，再整一哈嘛。", 500);
  }

  // 4. 创建用户 + 饭碗儿（slug 冲突重试）
  const editToken = randomToken();
  try {
    const userRes = await env.DB.prepare(
      "INSERT INTO users (nickname, avatar_url, ip_hash) VALUES (?, ?, ?)"
    )
      .bind(nickname, avatarUrl, dailyKey.slice(0, 32))
      .run();
    const userId = userRes.meta.last_row_id;

    for (let attempt = 0; attempt < (slugOpt ? 1 : 3); attempt++) {
      const slug = slugOpt || randomSlug();
      try {
        await env.DB.prepare(
          `INSERT INTO bowls
             (slug, user_id, title, want, reason, target_cents, deadline,
              wechat_qr, alipay_qr, usdt_address, usdt_qr, usdt_bep20_address, usdt_bep20_qr, nickname, avatar_url, status, edit_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
        )
          .bind(
            slug,
            userId,
            title,
            want,
            reason,
            targetCents,
            deadline,
            body.wechatQr || "",
            body.alipayQr || "",
            body.usdtAddress ? body.usdtAddress.trim() : "",
            body.usdtQr || "",
            body.usdtBep20Address ? body.usdtBep20Address.trim().toLowerCase() : "",
            body.usdtBep20Qr || "",
            nickname,
            avatarUrl,
            editToken
          )
          .run();
        return ok({ slug, editToken }, 201);
      } catch (err) {
        if (!isUniqueConflict(err)) throw err;
        if (slugOpt) {
          // 用户自定的后缀被占了：把日限退掉，莫白占别个一天一次的配额
          await env.DB.prepare("DELETE FROM daily_bowl_limits WHERE daily_key = ? AND date = ?")
            .bind(dailyKey, date)
            .run();
          return fail(ERR.CONFLICT, "这个后缀已经遭别个占起了，换一个嘛。", 409);
        }
        // 随机 slug 撞了，换个再试
      }
    }
    throw new Error("slug conflict after retries");
  } catch (err) {
    // 建失败了，把日限记录退掉，莫白占别个一天一次的配额
    await env.DB.prepare("DELETE FROM daily_bowl_limits WHERE daily_key = ? AND date = ?")
      .bind(dailyKey, date)
      .run();
    return fail(ERR.SERVER_ERROR, "饭碗儿没摆稳，再整一哈嘛。", 500);
  }
}

// GET /api/bowl/:slug
export async function getBowl(request, env, slug) {
  if (!isValidSlug(slug)) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);

  // 懒更新状态
  let status = bowl.status;
  if (status === "active") {
    if (bowl.deadline && bowl.deadline < new Date().toISOString()) {
      status = "expired";
    } else if (bowl.current_cents >= bowl.target_cents) {
      status = "completed";
    }
    if (status !== bowl.status) {
      await env.DB.prepare("UPDATE bowls SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(status, bowl.id)
        .run();
      bowl.status = status;
    }
  }

  const donations = await env.DB.prepare(
    `SELECT * FROM donations WHERE bowl_id = ? AND status = 'approved'
     ORDER BY created_at DESC LIMIT 20`
  )
    .bind(bowl.id)
    .all();

  return ok({
    bowl: formatBowl(bowl),
    donations: donations.results.map(formatDonation),
  });
}

// PUT /api/bowl/:slug（编辑：标题/想吃啥/为啥/金额/截止时间/收款方式/昵称）
export async function updateBowl(request, env, slug) {
  if (!isValidSlug(slug)) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  if (bowl.status !== "active") {
    return fail(ERR.CONFLICT, "这个饭碗儿已经收摊了，改不得喽。", 409);
  }

  const body = await readJson(request);
  if (!body) return fail(ERR.VALIDATION_ERROR, "数据没传对头，再整一哈嘛。");
  if (!body.editToken || body.editToken !== bowl.edit_token) {
    return fail(ERR.UNAUTHORIZED, "这个饭碗儿不是你的哈。", 401);
  }

  const title = clean(body.title, LIMITS.titleMax);
  const want = clean(body.want, LIMITS.wantMax);
  const reason = clean(body.reason, LIMITS.reasonMax);
  const nickname = clean(body.nickname, LIMITS.nicknameMax);
  const targetCents = yuanToCents(body.targetAmount);

  if (!title) return fail(ERR.VALIDATION_ERROR, "饭碗儿总得喊个啥子嘛。");
  if (!reason) return fail(ERR.VALIDATION_ERROR, "为啥子要吃，总要说两句嘛。");
  if (!nickname) return fail(ERR.VALIDATION_ERROR, "叫啥子嘛，总得留个名字。");
  if (targetCents === null) return fail(ERR.VALIDATION_ERROR, "你这个金额有点不对头哈。");
  if (targetCents < bowl.current_cents) {
    return fail(ERR.VALIDATION_ERROR, "目标金额不能低于已经收到的。");
  }
  if (body.wechatQr && !isLocalImageUrl(body.wechatQr)) {
    return fail(ERR.VALIDATION_ERROR, "微信收款码图片没传对头。");
  }
  if (body.alipayQr && !isLocalImageUrl(body.alipayQr)) {
    return fail(ERR.VALIDATION_ERROR, "支付宝收款码图片没传对头。");
  }
  if (body.usdtQr && !isLocalImageUrl(body.usdtQr)) {
    return fail(ERR.VALIDATION_ERROR, "USDT 收款图没传对头。");
  }
  if (body.usdtBep20Address && !isValidBep20Address(body.usdtBep20Address)) {
    return fail(ERR.VALIDATION_ERROR, "USDT BEP20 地址没填对头，0x 开头 42 位，看清楚哈。");
  }
  if (body.usdtBep20Qr && !isLocalImageUrl(body.usdtBep20Qr)) {
    return fail(ERR.VALIDATION_ERROR, "USDT BEP20 收款图没传对头。");
  }

  let deadline = bowl.deadline;
  if (body.deadline) {
    const d = new Date(body.deadline);
    if (Number.isNaN(d.getTime())) return fail(ERR.VALIDATION_ERROR, "截止时间没填对头。");
    deadline = d.toISOString();
  }

  await env.DB.prepare(
    `UPDATE bowls SET title=?, want=?, reason=?, target_cents=?, deadline=?,
       wechat_qr=?, alipay_qr=?, usdt_address=?, usdt_qr=?, usdt_bep20_address=?, usdt_bep20_qr=?, nickname=?, updated_at=datetime('now')
     WHERE id=?`
  )
    .bind(
      title,
      want,
      reason,
      targetCents,
      deadline,
      body.wechatQr || bowl.wechat_qr,
      body.alipayQr || bowl.alipay_qr,
      body.usdtAddress ? body.usdtAddress.trim() : bowl.usdt_address,
      body.usdtQr || bowl.usdt_qr,
      body.usdtBep20Address ? body.usdtBep20Address.trim().toLowerCase() : bowl.usdt_bep20_address,
      body.usdtBep20Qr || bowl.usdt_bep20_qr,
      nickname,
      bowl.id
    )
    .run();

  return ok({ slug });
}

// —— 摆碗的本人（edit_token）查看并放行自家饭碗的投喂 ——

// GET /api/bowl/:slug/pending?token=xxx —— 自家的待放行投喂
export async function getPendingDonations(request, env, slug) {
  if (!isValidSlug(slug)) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token || token !== bowl.edit_token) {
    return fail(ERR.UNAUTHORIZED, "这个饭碗儿不是你的哈。", 401);
  }
  const rows = await env.DB.prepare(
    `SELECT * FROM donations WHERE bowl_id = ? AND status = 'pending'
     ORDER BY created_at ASC`
  ).bind(bowl.id).all();
  return ok({ items: rows.results.map(formatDonation) });
}

// 校验 edit_token + 这笔投喂确实是投到自家饭碗的
async function ownDonation(env, bowl, body) {
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return { err: fail(ERR.VALIDATION_ERROR, "id 没传对头。") };
  if (!body?.editToken || body.editToken !== bowl.edit_token) {
    return { err: fail(ERR.UNAUTHORIZED, "这个饭碗儿不是你的哈。", 401) };
  }
  const row = await env.DB.prepare("SELECT * FROM donations WHERE id = ?").bind(id).first();
  if (!row || row.bowl_id !== bowl.id) {
    return { err: fail(ERR.NOT_FOUND, "这笔投喂没找到。", 404) };
  }
  return { row };
}

// POST /api/bowl/:slug/approve {id, editToken} —— 放他过（幂等：只处理 pending）
export async function approveOwnDonation(request, env, slug) {
  if (!isValidSlug(slug)) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const { row, err } = await ownDonation(env, bowl, await readJson(request));
  if (err) return err;

  const res = await env.DB.prepare(
    `UPDATE donations SET status='approved', approved_at=datetime('now')
     WHERE id=? AND status='pending'`
  ).bind(row.id).run();

  if (res.meta.changes > 0) {
    await env.DB.prepare(
      `UPDATE bowls SET current_cents = current_cents + ?
       WHERE id = ?`
    ).bind(row.amount_cents, bowl.id).run();
  }
  return ok({ id: row.id });
}

// POST /api/bowl/:slug/reject {id, editToken} —— 这个不行
export async function rejectOwnDonation(request, env, slug) {
  if (!isValidSlug(slug)) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  const { row, err } = await ownDonation(env, bowl, await readJson(request));
  if (err) return err;

  await env.DB.prepare(
    `UPDATE donations SET status='rejected' WHERE id=? AND status='pending'`
  ).bind(row.id).run();
  return ok({ id: row.id });
}
