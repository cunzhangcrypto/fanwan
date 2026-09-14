// 饭碗儿后台 API（ADMIN_KEY 鉴权）
// 不要叫 Admin Dashboard，这里叫"饭碗儿后台"。
import { ok, fail, ERR, readJson } from "../lib/resp.js";

function auth(request, env) {
  const header = request.headers.get("Authorization") || "";
  return header === `Bearer ${env.ADMIN_KEY}`;
}

// GET /api/admin/pending —— 待审核投喂
export async function pendingDonations(request, env) {
  if (!auth(request, env)) return fail(ERR.UNAUTHORIZED, "后台钥匙没对头。", 401);
  const rows = await env.DB.prepare(
    `SELECT d.*, b.slug, b.title AS bowl_title
     FROM donations d JOIN bowls b ON b.id = d.bowl_id
     WHERE d.status = 'pending'
     ORDER BY d.created_at ASC`
  ).all();
  return ok({
    items: rows.results.map((r) => ({
      id: r.id,
      slug: r.slug,
      bowlTitle: r.bowl_title,
      nickname: r.nickname || "匿名",
      amountYuan: r.amount_cents / 100,
      message: r.message,
      paymentMethod: r.payment_method,
      txid: r.txid,
      anonymous: !!r.is_anonymous,
      createdAt: r.created_at,
    })),
  });
}

// GET /api/admin/bowl/:slug —— 后台查饭碗儿（端走用）
export async function getBowlForAdmin(request, env, slug) {
  if (!auth(request, env)) return fail(ERR.UNAUTHORIZED, "后台钥匙没对头。", 401);
  const row = await env.DB.prepare("SELECT * FROM bowls WHERE slug=?").bind(slug).first();
  if (!row) return fail(ERR.NOT_FOUND, "这个饭碗儿没找到。", 404);
  const cnt = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM donations WHERE bowl_id=? AND status='approved'"
  ).bind(row.id).first();
  return ok({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    currentYuan: row.current_cents / 100,
    targetYuan: row.target_cents / 100,
    approvedDonations: cnt?.c || 0,
  });
}

// POST /api/admin/approve {id} —— 放他过（幂等：只处理 pending）
export async function approveDonation(request, env) {
  if (!auth(request, env)) return fail(ERR.UNAUTHORIZED, "后台钥匙没对头。", 401);
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(ERR.VALIDATION_ERROR, "id 没传对头。");
  }

  // 先只转换 pending 状态（幂等闸门），变了才累加金额，避免重复审核把金额加两次
  const res = await env.DB.prepare(
    `UPDATE donations SET status='approved', approved_at=datetime('now')
     WHERE id=? AND status='pending'`
  )
    .bind(id)
    .run();

  if (res.meta.changes === 0) {
    return ok({ id, alreadyHandled: true });
  }

  await env.DB.prepare(
    `UPDATE bowls SET current_cents = current_cents +
       (SELECT amount_cents FROM donations WHERE id=?)
     WHERE id = (SELECT bowl_id FROM donations WHERE id=?)`
  )
    .bind(id, id)
    .run();

  return ok({ id });
}

// POST /api/admin/reject {id} —— 这个不行
export async function rejectDonation(request, env) {
  if (!auth(request, env)) return fail(ERR.UNAUTHORIZED, "后台钥匙没对头。", 401);
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(ERR.VALIDATION_ERROR, "id 没传对头。");
  }
  await env.DB.prepare(
    `UPDATE donations SET status='rejected' WHERE id=? AND status='pending'`
  )
    .bind(id)
    .run();
  return ok({ id });
}

// POST /api/admin/delete {id, type: 'bowl' | 'donation'} —— 端走
export async function deleteItem(request, env) {
  if (!auth(request, env)) return fail(ERR.UNAUTHORIZED, "后台钥匙没对头。", 401);
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(ERR.VALIDATION_ERROR, "id 没传对头。");
  }
  const type = body?.type;

  if (type === "bowl") {
    // 饭碗儿端走 = 隐藏（连带投喂不再展示）
    await env.DB.prepare("UPDATE bowls SET status='hidden', updated_at=datetime('now') WHERE id=?")
      .bind(id)
      .run();
    return ok({ id, type });
  }

  if (type === "donation") {
    // 端走一笔投喂：若已 approved，把金额从饭碗儿里扣回来
    const row = await env.DB.prepare("SELECT * FROM donations WHERE id=?").bind(id).first();
    if (!row) return fail(ERR.NOT_FOUND, "这笔投喂没找到。", 404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM donations WHERE id=?").bind(id),
      ...(row.status === "approved"
        ? [
            env.DB.prepare(
              "UPDATE bowls SET current_cents = MAX(0, current_cents - ?) WHERE id=?"
            ).bind(row.amount_cents, row.bowl_id),
          ]
        : []),
    ]);
    return ok({ id, type });
  }

  return fail(ERR.VALIDATION_ERROR, "type 没传对头（bowl / donation）。");
}
