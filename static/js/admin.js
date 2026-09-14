/* 🍚 饭碗儿 —— 后台 */
(() => {
  const { $, get, post, toast, yuan, fmtTime } = FW;

  const KEY = "admin_key";
  let adminKey = sessionStorage.getItem(KEY) || "";

  /* ---------- 登录 ---------- */
  function tryEnter(showErr) {
    adminKey = $("#admin-key").value.trim();
    if (!adminKey && showErr) {
      $("#login-error").textContent = "钥匙还是填一个嘛。";
      return;
    }
    sessionStorage.setItem(KEY, adminKey);
    $("#login-box").classList.add("hidden");
    $("#admin-panel").classList.remove("hidden");
    loadPending();
  }

  $("#btn-login").addEventListener("click", () => tryEnter(true));
  $("#admin-key").addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(true); });

  if (adminKey) {
    $("#admin-key").value = adminKey;
    tryEnter(false);
  }

  /* ---------- 待审核 ---------- */
  async function loadPending() {
    const wrap = $("#pending-wrap");
    wrap.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await authGet("/api/admin/pending");
      wrap.innerHTML = "";
      if (!data.items.length) {
        wrap.innerHTML = '<div class="empty" style="padding:36px 20px;"><h2 style="font-size:20px;">现在没得待审核的。</h2><p style="margin-bottom:0;">干净得很。</p></div>';
        return;
      }
      const table = document.createElement("table");
      table.className = "admin-table";
      table.innerHTML = `
        <thead><tr>
          <th>时间</th><th>饭碗儿</th><th>谁</th><th>金额</th><th>留言</th><th>方式</th><th>操作</th>
        </tr></thead><tbody></tbody>`;
      const tbody = table.querySelector("tbody");

      data.items.forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><small>${fmtTime(d.createdAt)}</small></td>
          <td><a href="/${d.slug}" target="_blank">${esc(d.bowlTitle)}</a><br/><small>${d.slug}</small></td>
          <td>${esc(d.nickname)}${d.anonymous ? " <small>(匿名)</small>" : ""}</td>
          <td><b style="color:var(--gold-deep);">¥${yuan(d.amountYuan)}</b></td>
          <td>${esc(d.message) || "<small>—</small>"}</td>
          <td><small>${PAY[d.paymentMethod] || d.paymentMethod}${d.txid ? "<br/>" + esc(d.txid) : ""}</small></td>
          <td>
            <div class="actions">
              <button class="btn btn-sm btn-gold" data-act="approve" data-id="${d.id}">放他过</button>
              <button class="btn btn-sm" data-act="reject" data-id="${d.id}">这个不行</button>
              <button class="btn btn-sm btn-ghost" data-act="delete" data-id="${d.id}">端走</button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });

      table.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-act]");
        if (!btn) return;
        const { act, id } = btn.dataset;
        btn.disabled = true;
        try {
          if (act === "approve") {
            await authPost("/api/admin/approve", { id: Number(id) });
            toast("放他过了。");
          } else if (act === "reject") {
            await authPost("/api/admin/reject", { id: Number(id) });
            toast("这口没要。");
          } else {
            if (!confirm("这口饭不对头，要不要端走？")) { btn.disabled = false; return; }
            await authPost("/api/admin/delete", { id: Number(id), type: "donation" });
            toast("端走了。");
          }
          loadPending();
        } catch (err) {
          btn.disabled = false;
          toast(err.message || "没操作起。");
        }
      });

      wrap.appendChild(table);
    } catch (e) {
      wrap.innerHTML = `<div class="empty" style="padding:36px 20px;"><h2 style="font-size:20px;">${esc(e.message || "没进到后台。")}</h2><p style="margin-bottom:0;">检查一哈后台钥匙。</p></div>`;
    }
  }

  /* ---------- 端走饭碗儿 ---------- */
  $("#btn-find-bowl").addEventListener("click", async () => {
    const slug = $("#bowl-slug").value.trim();
    const box = $("#bowl-result");
    if (!slug) { toast("slug 还是要填一个嘛。"); return; }
    box.innerHTML = '<div class="spinner" style="margin:14px auto;"></div>';
    try {
      const b = await authGet(`/api/admin/bowl/${slug}`);
      box.innerHTML = `
        <table class="admin-table" style="margin-top:12px;">
          <tr><th>id</th><td>${b.id}</td></tr>
          <tr><th>标题</th><td>${esc(b.title)}</td></tr>
          <tr><th>状态</th><td>${STATUS[b.status] || b.status}</td></tr>
          <tr><th>金额</th><td>¥${yuan(b.currentYuan)} / ¥${yuan(b.targetYuan)}</td></tr>
          <tr><th>已放行投喂</th><td>${b.approvedDonations} 笔</td></tr>
          <tr><th>操作</th><td>
            <button class="btn btn-sm" id="btn-remove-bowl">端走（隐藏）</button>
          </td></tr>
        </table>`;
      $("#btn-remove-bowl").addEventListener("click", async () => {
        if (!confirm("真要把这个饭碗儿端走嗦？")) return;
        try {
          await authPost("/api/admin/delete", { id: b.id, type: "bowl" });
          toast("端走了，收起来喽。");
          box.innerHTML = "";
        } catch (e) {
          toast(e.message || "没端走起。");
        }
      });
    } catch (e) {
      box.innerHTML = `<div class="alert alert-red" style="margin-top:12px;">${esc(e.message || "没查到，是不是 slug 不对？")}</div>`;
    }
  });

  /* ---------- 鉴权请求 ---------- */
  function authHeaders() {
    return { Authorization: `Bearer ${adminKey}` };
  }

  async function authGet(path) {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      throw { message: data?.error?.message || "钥匙不对头。" };
    }
    return data.data;
  }

  async function authPost(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      throw { message: data?.error?.message || "钥匙不对头。" };
    }
    return data.data;
  }

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const PAY = { wechat: "微信", alipay: "支付宝", usdt: "USDT(TRC20)", usdt_bep20: "USDT(BEP20)" };
  const STATUS = { active: "还在讨生活", completed: "吃饱喽", expired: "凉了", hidden: "收起来了" };
})();
