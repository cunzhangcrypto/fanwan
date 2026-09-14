// 从 GitHub Actions Secrets 生成线上配置文件 wrangler.prod.toml。
// 这样部署者不需要本地装 wrangler、不需要改 wrangler.toml：
// 所有环境相关值（D1 库 ID、Turnstile、SITE_URL、R2 桶名）都在仓库 Settings 里配。
// 缺失的键保留 wrangler.toml 原值，方便作者本地跑 dev。
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("wrangler.toml", "utf8");

const env = (k, fb) => {
  const v = (process.env[k] || "").trim();
  return v ? v : fb;
};

const map = {
  database_id: env("D1_DATABASE_ID"),
  TURNSTILE_SITE_KEY: env("TURNSTILE_SITE_KEY"),
  bucket_name: env("R2_BUCKET"),
};

let out = src;
const injected = [];
for (const [key, value] of Object.entries(map)) {
  if (!value) continue; // 缺省保留原值
  const re = new RegExp(`(${key}\\s*=\\s*")[^"]*(")`);
  if (re.test(out)) {
    out = out.replace(re, (m, p1, p2) => p1 + value + p2);
    injected.push(key);
  }
}

writeFileSync("wrangler.prod.toml", out);
console.log(
  "wrangler.prod.toml 生成好了，注入的配置：" +
    (injected.length ? injected.join(", ") : "（没注入任何值）")
);
