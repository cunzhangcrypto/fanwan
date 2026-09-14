/* 🍚 饭碗儿 —— 公共前端工具 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- fetch 封装 ---------- */
  async function request(method, path, body, raw) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.body = raw ? body : JSON.stringify(body);
      if (!raw) {
        opts.headers["Content-Type"] = "application/json";
      } else if (body?.type) {
        // raw 上传（File/Blob）显式带类型，避免个别浏览器不自动带
        opts.headers["Content-Type"] = body.type;
      }
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch {
      throw { network: true, message: "哎呀，饭还没送到，网络先遭饿到了。" };
    }
    let data = null;
    try { data = await res.json(); } catch { /* 非 JSON */ }
    if (!res.ok || !data || data.ok !== true) {
      const msg = data?.error?.message || fallbackMsg(res.status);
      throw { status: res.status, code: data?.error?.code, message: msg };
    }
    return data.data;
  }

  const get = (p) => request("GET", p);
  const post = (p, b) => request("POST", p, b);
  const put = (p, b) => request("PUT", p, b);
  const del = (p) => request("DELETE", p);
  const upload = (p, file) => request("POST", p, file, true);

  function fallbackMsg(status) {
    if (status === 429) return "整得有点多了，歇一哈嘛。";
    if (status === 401) return "钥匙没对头。";
    if (status === 404) return "这口饭好像没摆在这儿。";
    if (status >= 500) return "哎呀，饭碗没接住。再整一哈嘛。";
    return "有点不对头，再试哈嘛。";
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- 中间提示弹窗（出问题了一哈就看得到） ---------- */
  let alertMask = null;
  function alertCenter(msg) {
    if (!alertMask || !alertMask.isConnected) {
      alertMask = document.createElement("div");
      alertMask.className = "alert-mask";
      alertMask.innerHTML = `
        <div class="alert-pop">
          <button class="alert-close" data-close>×</button>
          <p class="alert-msg"></p>
          <button class="btn btn-sm btn-primary alert-ok">晓得了</button>
        </div>`;
      alertMask.addEventListener("click", (e) => {
        if (e.target === alertMask || e.target.dataset.close !== undefined || e.target.classList.contains("alert-ok")) {
          alertMask.classList.remove("show");
        }
      });
      document.body.appendChild(alertMask);
    }
    alertMask.querySelector(".alert-msg").textContent = msg;
    alertMask.classList.add("show");
  }

  /* ---------- 金额格式化 ---------- */
  function yuan(n) {
    const v = Number(n || 0);
    return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  }

  /* ---------- 时间 ---------- */
  function fmtTime(iso) {
    if (!iso) return "";
    const s = String(iso);
    // 库内存的是 UTC：无时区标记的串（"YYYY-MM-DD HH:MM:SS"）按 UTC 解析；
    // 带 Z / 偏移的（deadline 的 ISO 串）标准解析。统一转北京时间显示。
    const t = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)
      ? new Date(s.replace(" ", "T") + "Z").getTime()
      : new Date(s).getTime();
    const d = new Date(t + 8 * 3600 * 1000);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }

  /* ---------- 进度文案（按比例随机一句） ---------- */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 金额状态短语：还没吃上一口 → 开始有饭了 → …… → 吃饱喽！
  function mealState(percent) {
    if (percent >= 100) return "吃饱喽！";
    if (percent >= 90) return "差最后一口";
    if (percent >= 60) return "马上吃饱";
    if (percent >= 30) return "饭有着落了";
    if (percent > 0) return "开始有饭了";
    return "还没吃上一口";
  }

  function progressText(percent) {
    if (percent >= 100) return "吃饱喽！收碗！🍚";
    if (percent >= 90) return pick(["马上吃饱，哪个再来补一口？", "就差临门一口了！"]);
    if (percent >= 60) return pick(["稳了稳了，再整两口。", "有点东西了，饭快有着落了。"]);
    if (percent >= 30) return pick(["有点东西了，饭快有着落了。", "几个耿直人已经开投了。"]);
    if (percent > 0) return pick(["有几个耿直人开始投了。", "开张了，慢慢来嘛。"]);
    return pick(["一口都还莫得，开局有点惨。", "碗摆起了，就等第一个耿直人。"]);
  }

  window.FW = { $, $$, get, post, put, del, upload, toast, alertCenter, yuan, fmtTime, progressText, mealState, pick };
})();
