// D1 查询小工具

// 判断 D1 异常是否为 UNIQUE 约束冲突
export function isUniqueConflict(err) {
  const m = err?.message || "";
  return m.includes("UNIQUE constraint failed") || m.includes("constraint failed");
}

export async function getBowlBySlug(db, slug) {
  return db
    .prepare("SELECT * FROM bowls WHERE slug = ?")
    .bind(slug)
    .first();
}

export function formatBowl(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    want: row.want,
    reason: row.reason,
    targetYuan: row.target_cents / 100,
    currentYuan: row.current_cents / 100,
    percent: Math.min(100, Math.round((row.current_cents / row.target_cents) * 100)),
    deadline: row.deadline,
    wechatQr: row.wechat_qr,
    alipayQr: row.alipay_qr,
    usdtAddress: row.usdt_address,
    usdtQr: row.usdt_qr,
    usdtBep20Address: row.usdt_bep20_address,
    usdtBep20Qr: row.usdt_bep20_qr,
    paypalLink: row.paypal_link,
    paypalQr: row.paypal_qr,
    notifyWecom: row.notify_wecom,
    notifyTelegram: row.notify_telegram,
    notifyServerchan: row.notify_serverchan,
    notifyEmail: row.notify_email,
    emailApiUrl: row.email_api_url,
    emailFrom: row.email_from,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatDonation(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.is_anonymous ? "匿名耿直人" : row.nickname || "路过滴耿直人",
    amountYuan: row.amount_cents / 100,
    message: row.message,
    paymentMethod: row.payment_method,
    txid: row.txid,
    anonymous: !!row.is_anonymous,
    status: row.status,
    createdAt: row.created_at,
  };
}
