// 一次性脚本：下载 NotoSansSC（CJK 中文字体）到本地 fonts/ 目录。
// 来源：notofonts/noto-cjk 官方仓库的 OTF 单文件（约 16MB，含简体中文全集）。
// 用法：npm run font:download
import { mkdirSync, writeFileSync } from "node:fs";

const FONT_URL =
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf";
const OUT = "fonts/NotoSansSC-Regular.otf"; // 与 wrangler.toml 的 R2_FONT_KEY 保持一致

console.log("正在下载中文字体（约 16MB，耐心等一哈）...");
const res = await fetch(FONT_URL);
if (!res.ok) {
  console.error("下载失败：", res.status, res.statusText);
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
mkdirSync("fonts", { recursive: true });
writeFileSync(OUT, buf);

console.log(`搞定，字体已存到 ${OUT}（${(buf.length / 1024 / 1024).toFixed(1)} MB）`);
console.log("下一步：npm run font:upload 传到 R2");
