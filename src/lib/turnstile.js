// Cloudflare Turnstile 服务端验证
// 前端只判断不算数，Worker 必须再次验证 token。

export async function verifyTurnstile(token, secret, remoteIp) {
  // 没配 secret（本地开发）时放行，方便跑通流程；生产必须配，配了就必须过。
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: remoteIp,
    });
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );
    const data = await res.json().catch(() => ({}));
    return !!data.success;
  } catch {
    return false;
  }
}
