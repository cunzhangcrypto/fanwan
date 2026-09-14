// 🍚 饭碗儿 —— Worker 入口
// 单 Worker 一体托管：静态资源（Workers Static Assets）+ /api/* + /i/* + /og/*。
import { fail, ERR } from "./lib/resp.js";
import { handleConfig, listBowls, createBowl, getBowl, updateBowl, getPendingDonations, approveOwnDonation, rejectOwnDonation } from "./api/bowls.js";
import { createDonation, deleteDonation } from "./api/donations.js";
import { uploadImage } from "./api/upload.js";
import { pendingDonations, getBowlForAdmin, approveDonation, rejectDonation, deleteItem } from "./api/admin.js";
import { handleOg } from "./api/og.js";
import { serveBowHtml, serveStatic } from "./assets.js";
import { RESERVED_SLUGS } from "./lib/validate.js";

// 自定义后缀饭碗儿：/cunzhang
// 注意：不要用 SLUG_RE.source 拼（它自带 ^ 锚点，拼进去就成了"必须从头匹配"，永远撞不上）
const SLUG_PATH_RE = /^\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // 公开配置
      if (method === "GET" && path === "/api/config") {
        return handleConfig(env);
      }

      // 饭碗儿 API
      if (path.startsWith("/api/bowl")) {
        const rest = path.slice("/api/bowl".length);
        if (method === "GET" && rest === "") return listBowls(request, env);
        if (method === "POST" && rest === "") return createBowl(request, env);
        // 摆碗的本人：待放行投喂
        let m = rest.match(/^\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])\/pending$/);
        if (method === "GET" && m) return getPendingDonations(request, env, m[1]);
        m = rest.match(/^\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])\/approve$/);
        if (method === "POST" && m) return approveOwnDonation(request, env, m[1]);
        m = rest.match(/^\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])\/reject$/);
        if (method === "POST" && m) return rejectOwnDonation(request, env, m[1]);
        const slug = rest.startsWith("/") ? rest.slice(1) : "";
        if (method === "GET" && slug) return getBowl(request, env, slug);
        if (method === "PUT" && slug) return updateBowl(request, env, slug);
        return fail(ERR.NOT_FOUND, "没得这个接口。", 404);
      }

      // 投喂 API
      if (path.startsWith("/api/donation")) {
        if (method === "POST" && path === "/api/donation") return createDonation(request, env);
        const m = path.match(/^\/api\/donation\/(\d+)$/);
        if (method === "DELETE" && m) return deleteDonation(request, env, Number(m[1]));
        return fail(ERR.NOT_FOUND, "没得这个接口。", 404);
      }

      // 图片上传
      if (method === "POST" && path === "/api/upload") {
        return uploadImage(request, env);
      }

      // 后台
      if (path.startsWith("/api/admin")) {
        if (method === "GET" && path === "/api/admin/pending") return pendingDonations(request, env);
        const adminBowl = path.match(/^\/api\/admin\/bowl\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])$/);
        if (method === "GET" && adminBowl) return getBowlForAdmin(request, env, adminBowl[1]);
        if (method === "POST" && path === "/api/admin/approve") return approveDonation(request, env);
        if (method === "POST" && path === "/api/admin/reject") return rejectDonation(request, env);
        if (method === "POST" && path === "/api/admin/delete") return deleteItem(request, env);
        return fail(ERR.NOT_FOUND, "没得这个接口。", 404);
      }

      // R2 图片读取
      const imgMatch = path.match(/^\/i\/(.+)$/);
      if (imgMatch) {
        return serveImage(env, imgMatch[1]);
      }

      // OG 分享图
      const ogMatch = path.match(/^\/og\/([a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9])\.png$/);
      if (ogMatch) {
        return handleOg(env, ogMatch[1]);
      }

      // 饭碗儿详情页（OG meta 动态注入）：老式 /bowl.html?slug=xxx 兼容
      if (method === "GET" && path === "/bowl.html") {
        return serveBowHtml(env, request);
      }

      // 自定义后缀饭碗儿详情页：/cunzhang
      const slugPath = path.match(SLUG_PATH_RE);
      if (method === "GET" && slugPath && !RESERVED_SLUGS.has(slugPath[1])) {
        return serveBowHtml(env, request, slugPath[1]);
      }

      // 其余静态资源
      return serveStatic(env, request);
    } catch (err) {
      console.error("碗儿翻了：", err);
      return fail(ERR.SERVER_ERROR, "哎呀，饭碗没接住。网络这哈有点恼火，再整一哈嘛。", 500);
    }
  },
};

async function serveImage(env, key) {
  const obj = await env.BUCKET.get(key).catch(() => null);
  if (!obj) {
    return new Response("这口饭（图）没找到。", { status: 404 });
  }
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}
