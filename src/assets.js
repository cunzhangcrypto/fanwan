// 静态资源服务 + bowl.html 的 OG meta 动态注入
import { getBowlBySlug } from "./lib/db.js";
import { isValidSlug } from "./lib/validate.js";

const OG_PLACEHOLDERS = [
  "__TITLE__",
  "__OG_DESC__",
  "__OG_IMAGE__",
  "__OG_URL__",
  "__META_DESC__",
];

// bowl.html 是静态文件，OG meta 写死没用；这里从 D1 取数据替换占位符，
// 让微信/Telegram/X 等爬虫能读到正确的标题和分享图。
// pathSlug 支持两种入口：老式 /bowl.html?slug=xxx（不传）和 新式 /cunzhang（传 slug）。
export async function serveBowHtml(env, request, pathSlug) {
  const url = new URL(request.url);
  const slug = pathSlug || url.searchParams.get("slug") || "";

  // 永远取 bowl.html 静态文件（路径式 /cunzhang 在 ASSETS 里本来就没得这个文件）
  const res = await env.ASSETS.fetch(new Request(new URL("/bowl.html", url), request));
  if (!res.ok) return res;
  const html = await res.text();

  if (!isValidSlug(slug)) {
    let out = html;
    for (const p of OG_PLACEHOLDERS) out = out.replaceAll(p, "");
    return new Response(
      out,
      { status: res.status, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const bowl = await getBowlBySlug(env.DB, slug).catch(() => null);
  // OG 链接用当前请求域名动态拼：爬虫抓的 host 就是部署域名，绑不绑自定义域名都自动正确，
  // 不需要配 SITE_URL。
  const siteUrl = new URL(request.url).origin;
  const percent = bowl
    ? Math.min(100, Math.round((bowl.current_cents / bowl.target_cents) * 100))
    : 0;

  // 页面标题按人生成：村花的饭碗儿｜吃个串串
  const title = bowl ? `${bowl.nickname}的饭碗儿｜${bowl.title}` : "饭碗儿 —— 没得饭吃啷个办？";
  const state = percent >= 100 ? "吃饱喽！" : percent >= 90 ? "差最后一口" : percent >= 60 ? "马上吃饱" : percent >= 30 ? "饭有着落了" : percent > 0 ? "开始有饭了" : "还没吃上一口";
  // 每个饭碗儿描述不一样：谁摆的，哪个来投喂一口
  const metaDesc = bowl
    ? `${bowl.nickname}摆的饭碗儿，哪个来投喂一口`
    : "互联网人的在线饭碗儿。摆个饭碗儿，等个耿直人投一口。";
  const ogDesc = bowl
    ? `${bowl.nickname}摆的饭碗儿，哪个来投喂一口 · ${state}（¥${(bowl.current_cents / 100).toFixed(0)} / ¥${(bowl.target_cents / 100).toFixed(0)}，${percent}%）`
    : "没得饭吃啷个办？先把饭碗儿摆出来嘛。";
  const image = bowl ? `${siteUrl}/og/${slug}.png` : `${siteUrl}/favicon.svg`;
  const canonical = `${siteUrl}/${slug}`;

  const replaced = html
    .replaceAll("__TITLE__", escapeAttr(title))
    .replaceAll("__OG_DESC__", escapeAttr(ogDesc))
    .replaceAll("__OG_IMAGE__", escapeAttr(image))
    .replaceAll("__OG_URL__", escapeAttr(canonical))
    .replaceAll("__META_DESC__", escapeAttr(metaDesc));

  return new Response(replaced, {
    status: res.status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 普通静态资源（含 404.html 兜底）
export async function serveStatic(env, request) {
  const url = new URL(request.url);
  // html_handling = "none" 后根路径不会自动映射 index.html，这里手动补
  const target =
    url.pathname === "/"
      ? new URL("/index.html" + url.search, url)
      : new Request(url, request);
  const res = await env.ASSETS.fetch(target);
  if (res.status === 404) {
    const notFound = await env.ASSETS.fetch(new URL("/404.html", request.url));
    if (notFound.ok) {
      return new Response(await notFound.arrayBuffer(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // 首页 OG meta：index.html 里是占位符，这里注入静态值，莫让爬虫看到 __OG_TITLE__ 字面量
  if (url.pathname === "/" && res.headers.get("Content-Type")?.includes("text/html")) {
    const html = await res.text();
    const siteUrl = new URL(request.url).origin;
    const out = html
      .replaceAll("__OG_TITLE__", escapeAttr("饭碗儿 —— 没得饭吃啷个办？先把饭碗儿摆出来嘛。"))
      .replaceAll("__OG_DESC__", escapeAttr("互联网人的在线饭碗儿。摆个饭碗儿，等个耿直人投一口。"))
      .replaceAll("__OG_IMAGE__", escapeAttr(`${siteUrl}/favicon.svg`))
      .replaceAll("__OG_URL__", escapeAttr(`${siteUrl}/`));
    return new Response(out, {
      status: res.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return res;
}
