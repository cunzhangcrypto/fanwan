// OG 分享图生成：cf-workers-og（Satori + resvg WASM）渲染 1200×630 PNG
// 中文字体从 R2 加载（不打包进 Worker，控制体积），模块级缓存字体字节。
import { ImageResponse, CustomFont } from "cf-workers-og/html";

const FONT_NAME = "NotoSansSC";
const fontCache = new Map(); // R2_FONT_KEY -> ArrayBuffer

async function loadFont(bucket, key) {
  if (fontCache.has(key)) return fontCache.get(key);
  const obj = await bucket.get(key);
  if (!obj) return null;
  const buf = await obj.arrayBuffer();
  fontCache.set(key, buf);
  return buf;
}

// 去掉 emoji 等非常规字符，避免 OG 图渲染出豆腐块
function stripEmoji(s) {
  return String(s).replace(
    /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1FA00}-\u{1FAFF}]/gu,
    ""
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// 饭碗插画（右侧大碗 + 米粒 + 筷子 + 小辣椒）
function bowlIllustration() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <ellipse cx="210" cy="318" rx="168" ry="58" fill="#f4e3c0"/>
  <path d="M42 280 Q210 370 378 280 L356 352 Q210 420 64 352 Z" fill="#faf4e6" stroke="#d9c39a" stroke-width="6"/>
  <path d="M64 352 Q210 420 356 352 Q210 398 64 352 Z" fill="#e8d3ab"/>
  <ellipse cx="210" cy="272" rx="168" ry="62" fill="#fffdf6" stroke="#e0cd9f" stroke-width="5"/>
  <path d="M70 280 Q210 330 350 280" fill="none" stroke="#e0cd9f" stroke-width="5"/>
  <g fill="#fdf6e3">
    <ellipse cx="140" cy="262" rx="26" ry="15"/>
    <ellipse cx="210" cy="256" rx="26" ry="15"/>
    <ellipse cx="280" cy="262" rx="26" ry="15"/>
    <ellipse cx="175" cy="292" rx="26" ry="15"/>
    <ellipse cx="245" cy="292" rx="26" ry="15"/>
  </g>
  <g stroke="#b98d4f" stroke-width="7" stroke-linecap="round">
    <path d="M322 150 L266 200"/>
    <path d="M338 162 L282 212"/>
  </g>
  <path d="M150 120 q18 -30 40 -12 q-4 24 -26 30 Z" fill="#e23a3a"/>
  <path d="M160 126 q4 18 -6 26" stroke="#c02626" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;
}

// 饭碗儿 Logo（小碗，OG 图左上角用）
function logoDataUri() {
  return svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <ellipse cx="48" cy="76" rx="34" ry="12" fill="#f4e3c0"/>
  <path d="M14 64 Q48 84 82 64 L78 80 Q48 96 18 80 Z" fill="#faf4e6" stroke="#d9c39a" stroke-width="3"/>
  <ellipse cx="48" cy="60" rx="34" ry="14" fill="#fffdf6" stroke="#e0cd9f" stroke-width="2.5"/>
  <g fill="#f6e8c8">
    <ellipse cx="38" cy="57" rx="6" ry="3.6"/>
    <ellipse cx="50" cy="54" rx="6" ry="3.6"/>
    <ellipse cx="58" cy="59" rx="6" ry="3.6"/>
  </g>
  <path d="M58 20 q6 -12 14 -4 q-2 9 -10 11 Z" fill="#e23a3a"/>
</svg>`);
}

// 生成 OG 图 HTML（Satori 子集：flexbox + 基础样式）
export function ogHtml({ title, currentYuan, targetYuan, percent, statusText }) {
  const t = stripEmoji(title).slice(0, 50) || "今天想吃口饭";
  const c = Number(currentYuan || 0).toFixed(0);
  const g = Number(targetYuan || 0).toFixed(0);
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const barColor = p >= 100 ? "#e23a3a" : "#e8a33d";
  const status = statusText || (p >= 100 ? "吃饱喽！收碗！" : "还在讨生活");
  const state = p >= 100 ? "吃饱喽！" : p >= 90 ? "差最后一口" : p >= 60 ? "马上吃饱" : p >= 30 ? "饭有着落了" : p > 0 ? "开始有饭了" : "还没吃上一口";

  return `<div style="display:flex; flex-direction:row; width:1200px; height:630px; background:#fbf4e4; padding:64px 72px; font-family:'${FONT_NAME}'">
    <div style="display:flex; flex-direction:column; flex:1; justify-content:space-between; height:100%;">
      <div style="display:flex; flex-direction:row; align-items:center; gap:16px;">
        <img src="${logoDataUri()}" style="width:56px; height:56px;" />
        <span style="font-size:30px; color:#a5712f;">饭碗儿</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px;">
        <div style="font-size:52px; line-height:1.35; color:#5a4632; font-weight:700; max-width:640px; display:flex; flex-wrap:wrap;">${escapeHtml(t)}</div>
        <div style="display:flex; flex-direction:row; align-items:baseline; gap:6px; font-size:30px; color:#8a6d4d;"><span style="color:#d98a1f; font-weight:700;">${state}</span> · ¥${c} / ¥${g}</div>
        <div style="display:flex; flex-direction:row; align-items:center; gap:20px;">
          <div style="display:flex; flex:1; height:22px; background:#efe0c0; border-radius:11px; overflow:hidden;">
            <div style="width:${p}%; height:100%; background:${barColor}; border-radius:11px;"></div>
          </div>
          <span style="font-size:32px; color:#a5712f; font-weight:700;">${p}%</span>
        </div>
        <div style="display:flex; font-size:28px; color:#a5712f;">${escapeHtml(status)}</div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:16px;">
      <img src="${svgDataUri(bowlIllustration())}" style="width:420px; height:420px;" />
      <span style="font-size:26px; color:#c9a86b;">饭碗儿</span>
    </div>
  </div>`;
}

// 渲染 PNG（返回 Response）
export async function renderOg(env, data) {
  const fontKey = env.R2_FONT_KEY || "fonts/NotoSansSC-Regular.otf";
  const fontBuf = await loadFont(env.BUCKET, fontKey);
  const fonts = fontBuf
    ? [new CustomFont(FONT_NAME, fontBuf, { weight: 400 })]
    : undefined; // 没配字体也能出图（英文/数字），中文会变豆腐块，README 会说明

  return ImageResponse.create(ogHtml(data), {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600",
    },
  });
}
