// OG 分享图接口：GET /og/:slug.png
// 懒生成：首次请求渲染出 PNG 存 R2，之后直接读缓存（10 分钟自然过期）。
import { renderOg } from "../lib/og-render.js";
import { getBowlBySlug } from "../lib/db.js";
import { isValidSlug } from "../lib/validate.js";

export async function handleOg(env, slug) {
  if (!isValidSlug(slug)) return notFound();

  // 先读 R2 缓存
  const cached = await env.BUCKET.get(`og/${slug}.png`).catch(() => null);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  }

  const bowl = await getBowlBySlug(env.DB, slug);
  if (!bowl) return notFound();

  const percent = Math.min(100, Math.round((bowl.current_cents / bowl.target_cents) * 100));
  let statusText = "还在讨生活";
  if (bowl.status === "completed") statusText = "吃饱喽！收碗！";
  else if (bowl.status === "expired") statusText = "这口饭已经凉了。";
  else if (bowl.status === "hidden") statusText = "这口饭收起来了。";

  const res = await renderOg(env, {
    title: bowl.title,
    currentYuan: bowl.current_cents / 100,
    targetYuan: bowl.target_cents / 100,
    percent,
    statusText,
  });

  // 存 R2 供后续直接读
  const png = await res.arrayBuffer();
  await env.BUCKET.put(`og/${slug}.png`, png, {
    httpMetadata: { contentType: "image/png" },
  }).catch(() => {});

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600",
    },
  });
}

function notFound() {
  return new Response(null, { status: 404 });
}
