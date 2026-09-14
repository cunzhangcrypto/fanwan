// 一次性脚本：把本地字体上传到 R2（供 OG 分享图渲染中文）。
// 前置：wrangler login 已登录、r2 bucket 已创建（wrangler r2 bucket create fanwaner-assets）。
// 用法：npm run font:upload
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const BUCKET = process.env.R2_BUCKET || "fanwaner-assets";
const FONT_KEY = "fonts/NotoSansSC-Regular.otf"; // 与 wrangler.toml 的 R2_FONT_KEY 保持一致
const FONT_FILE = "fonts/NotoSansSC-Regular.otf";

if (!existsSync(FONT_FILE)) {
  console.error(`没找到 ${FONT_FILE}，先跑 npm run font:download（或者手动把字体放到这个路径）。`);
  process.exit(1);
}

console.log(`上传 ${FONT_FILE} → ${BUCKET}/${FONT_KEY} ...`);
execSync(`wrangler r2 object put ${BUCKET}/${FONT_KEY} --file=${FONT_FILE}`, {
  stdio: "inherit",
});
console.log("字体传好了。重新部署后，/og/:slug.png 就能渲染中文了。");
