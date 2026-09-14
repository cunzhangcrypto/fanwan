/* 🍚 饭碗儿 —— 饭碗儿详情页 */
(() => {
  const { $, $$, get, post, toast, yuan, fmtTime, mealState, progressText, pick } = FW;

  // 兼容两种入口：老式 /bowl.html?slug=xxx 和新式 /cunzhang
  const slug =
    new URLSearchParams(location.search).get("slug") ||
    location.pathname.replace(/^\//, "").split("/")[0] ||
    "";
  let bowl = null;
  let donations = [];
  let payMethod = "wechat";
  let turnstileToken = "";
  let turnstileWidget = null;

  const STATUS_MAP = {
    active: ["🍚 还在讨生活", "s-active"],
    completed: ["🍚 吃饱喽，收碗！", "s-done"],
    expired: ["🍚 饭凉了，收碗了", "s-cold"],
    hidden: ["🍚 收摊了", "s-cold"],
  };

  const PAY_LABEL = { wechat: "微信", alipay: "支付宝", usdt: "USDT(TRC20)", usdt_bep20: "USDT(BEP20)" };

  /* ---------- 加载数据 ---------- */
  async function load() {
    if (!slug) {
      location.href = "/";
      return;
    }
    try {
      const data = await get(`/api/bowl/${slug}`);
      bowl = data.bowl;
      donations = data.donations || [];
      render();
      $("#loading").classList.add("hidden");
      $("#detail").classList.remove("hidden");
    } catch (e) {
      $("#loading").classList.add("hidden");
      document.querySelector(".detail-wrap").innerHTML = `
        <div class="empty" style="margin-top:40px;">
          <img src="/img/bowl.svg" alt="空碗" />
          <h2>哎呀，饭碗儿遭你整丢了。</h2>
          <p>你找的这口饭，好像没摆在这儿。</p>
          <div class="btn-row" style="justify-content:center;">
            <a class="btn btn-primary" href="/">🍚 回去吃饭</a>
            <a class="btn" href="/#bowls">👀 去瞅哈别人的饭碗</a>
          </div>
        </div>`;
    }
  }

  function render() {
    const pct = bowl.percent;
    $("#d-title").textContent = bowl.title;
    $("#d-state").textContent = mealState(pct);
    $("#d-current").textContent = `¥${yuan(bowl.currentYuan)}`;
    $("#d-target").textContent = `¥${yuan(bowl.targetYuan)}`;

    const [stText, stCls] = STATUS_MAP[bowl.status] || STATUS_MAP.active;
    const st = $("#d-status");
    st.textContent = stText;
    st.className = `detail-status ${stCls}`;

    $("#d-fill").style.width = `${pct}%`;
    $("#d-fill").classList.toggle("full", pct >= 100);
    $("#d-pct").textContent = `${pct}%`;
    $("#d-progress-text").textContent = progressText(pct);

    $("#d-want").textContent = bowl.want || "";
    $("#d-reason").textContent = bowl.reason || "";

    const kv = [];
    if (bowl.deadline) kv.push(`⏰ 截止 ${fmtTime(bowl.deadline)}`);
    if (bowl.nickname) kv.push(`哪个的碗：${escapeHtml(bowl.nickname)} 摆的碗`);
    $("#d-kv").innerHTML = kv.join(" · ");

    // 摆碗的本人可见"改一哈" + "复制管理链接"
    const token = getEditToken(slug);
    if (token) {
      const btn = $("#btn-edit");
      btn.classList.remove("hidden");
      btn.onclick = () => {
        location.href = `/create.html?edit=${slug}&token=${encodeURIComponent(token)}`;
      };
      // 把这个带令牌的管理链接抄下来存起，以后随便哪个浏览器打开都是管理界面
      const btnM = $("#btn-manage-link");
      btnM.classList.remove("hidden");
      btnM.onclick = async () => {
        await copyText(`${location.origin}/${slug}?token=${encodeURIComponent(token)}`);
        toast("管理链接抄到起了，打开就直接是管理界面，随便哪个浏览器都行。");
      };
      renderPending(token);
    }

    renderRecords();
  }

  function getEditToken(slug2) {
    // 优先认链接里甩进来的 ?token=（管理链接），再认本地存的
    const urlToken = new URLSearchParams(location.search).get("token") || "";
    let stored = "";
    try {
      const raw = localStorage.getItem("bowl_edit_token");
      if (raw) {
        const item = JSON.parse(raw);
        if (item.slug === slug2) stored = item.token;
      }
    } catch {}
    const token = urlToken || stored;
    if (token && token !== stored) {
      // 记住这个浏览器，下次直接打开碗页就是管理界面
      try { localStorage.setItem("bowl_edit_token", JSON.stringify({ slug: slug2, token })); } catch {}
    }
    return token;
  }

  /* ---------- 待放行投喂（仅摆碗的本人可见） ---------- */
  async function renderPending(token) {
    const section = $("#pending-section");
    const list = $("#pending-list");
    section.classList.remove("hidden");
    list.innerHTML = '<div class="spinner"></div>';
    let items = [];
    try {
      const data = await get(`/api/bowl/${slug}/pending?token=${encodeURIComponent(token)}`);
      items = data.items || [];
    } catch (e) {
      list.innerHTML = `<p style="color:var(--muted);">${escapeHtml(e.message || "没拉到待放行的。")}</p>`;
      return;
    }
    if (!items.length) {
      list.innerHTML = '<div class="empty" style="padding:24px 20px;"><h2 style="font-size:18px;">现在没得待放行的。</h2><p style="margin-bottom:0;">干净得很。</p></div>';
      return;
    }
    list.innerHTML = "";
    items.forEach((d) => {
      const el = document.createElement("div");
      el.className = "record pending-record";
      el.innerHTML = `
        <div class="r-avatar">🍚</div>
        <div class="r-main">
          <div class="r-name">${escapeHtml(d.nickname)}<span class="amt" style="color:var(--gold-deep);">投了 ¥${yuan(d.amountYuan)}</span><small style="color:var(--muted);">${PAY_LABEL[d.paymentMethod] || d.paymentMethod}</small></div>
          ${d.message ? `<div class="r-msg">“${escapeHtml(d.message)}”</div>` : ""}
          <div class="r-time">${fmtTime(d.createdAt)}${d.txid ? ` · TXID：${escapeHtml(d.txid)}` : ""}</div>
          <div class="pending-actions">
            <button class="btn btn-sm btn-gold" data-act="approve" data-id="${d.id}">放他过</button>
            <button class="btn btn-sm" data-act="reject" data-id="${d.id}">这个不行</button>
          </div>
        </div>`;
      el.querySelector("[data-act='approve']").addEventListener("click", async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await post(`/api/bowl/${slug}/approve`, { id: d.id, editToken: token });
          toast("放他过了，饭钱记上了。");
          load();
        } catch (err) {
          b.disabled = false;
          toast(err.message || "没放行起。");
        }
      });
      el.querySelector("[data-act='reject']").addEventListener("click", async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await post(`/api/bowl/${slug}/reject`, { id: d.id, editToken: token });
          toast("这口没要。");
          renderPending(token);
        } catch (err) {
          b.disabled = false;
          toast(err.message || "没操作起。");
        }
      });
      list.appendChild(el);
    });
  }

  /* ---------- 投喂记录 + 排行榜 ---------- */
  function renderRecords() {
    const list = $("#record-list");
    list.innerHTML = "";
    if (donations.length) {
      $("#record-empty").classList.add("hidden");
      $("#r-count").textContent = `共 ${donations.length} 笔`;
    } else {
      $("#record-empty").classList.remove("hidden");
      $("#r-count").textContent = "";
    }

    donations.forEach((d) => {
      const el = document.createElement("div");
      el.className = "record";
      el.innerHTML = `
        <div class="r-avatar">${d.anonymous ? "🙈" : "🍚"}</div>
        <div class="r-main">
          <div class="r-name">${escapeHtml(d.nickname)}<span class="amt">投了 ¥${yuan(d.amountYuan)}</span>${d.paymentMethod === "usdt" || d.paymentMethod === "usdt_bep20" ? ` <small style='color:var(--muted)'>${PAY_LABEL[d.paymentMethod]}</small>` : ""}</div>
          ${d.message ? `<div class="r-msg">“${escapeHtml(d.message)}”</div>` : ""}
          <div class="r-time">${fmtTime(d.createdAt)}</div>
        </div>`;
      list.appendChild(el);
    });

    // 排行榜：前 3 耿直人
    const top = [...donations].sort((a, b) => b.amountYuan - a.amountYuan).slice(0, 3);
    const medals = ["🥇 头号耿直人", "🥈 二号耿直人", "🥉 三号耿直人"];
    const rank = $("#rank-list");
    rank.innerHTML = "";
    top.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "rank-item";
      el.innerHTML = `<span>${medals[i]}</span><b>${escapeHtml(d.nickname)}</b><span style="color:var(--gold-deep);">¥${yuan(d.amountYuan)}</span>`;
      rank.appendChild(el);
    });
    if (!top.length) rank.innerHTML = '<p style="color:var(--muted); font-size:14px;">还没得排行，等第一个耿直人。</p>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- 分享 ---------- */
  const shareMask = $("#share-mask");
  $("#btn-share").addEventListener("click", () => {
    const url = `${location.origin}/${slug}`;
    $("#share-url").textContent = url;
    $("#share-copied").classList.add("hidden");
    shareMask.classList.add("show");
  });

  $("#btn-copy-share").addEventListener("click", async () => {
    await copyText($("#share-url").textContent);
    $("#share-copied").classList.remove("hidden");
  });

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  }

  /* ---------- 投一口 ---------- */
  const donateMask = $("#donate-mask");
  const modal = $("#donate-modal");
  let done = false;

  $("#btn-donate").addEventListener("click", () => {
    if (bowl.status !== "active") {
      toast("这个饭碗儿已经收摊了，投不得喽。");
      return;
    }
    const anyPay = bowl.wechatQr || bowl.alipayQr || bowl.usdtQr || bowl.usdtAddress || bowl.usdtBep20Qr || bowl.usdtBep20Address;
    if (!anyPay) {
      toast("摆碗的兄弟伙还没留收款方式，先精神支持一哈。");
      return;
    }
    done = false;
    showStep("pay");
    donateMask.classList.add("show");
  });

  $$("#donate-pay-tabs .pay-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$("#donate-pay-tabs .pay-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      payMethod = tab.dataset.pay;
    });
  });

  $("#btn-next").addEventListener("click", () => {
    // 先检查这个方式到底留没留
    const has = payMethod === "wechat" ? bowl.wechatQr : payMethod === "alipay" ? bowl.alipayQr : payMethod === "usdt" ? (bowl.usdtQr || bowl.usdtAddress) : (bowl.usdtBep20Qr || bowl.usdtBep20Address);
    if (!has) { toast("摆碗的莫得留这个收款方式。"); return; }
    renderReportStep();
    showStep("report");
  });

  let reportUsdtAddr = "";

  function renderReportStep() {
    const isUsdt = payMethod === "usdt" || payMethod === "usdt_bep20";
    const usdtAddr = payMethod === "usdt" ? bowl.usdtAddress : bowl.usdtBep20Address;
    const usdtQr = payMethod === "usdt" ? bowl.usdtQr : bowl.usdtBep20Qr;
    reportUsdtAddr = usdtAddr || "";
    $("#r-pay-title").textContent = isUsdt ? "有币的兄弟伙，也可以整一口。" : "扫嘛，莫客气。";
    $("#r-pay-lead").textContent = "钱直接甩给摆碗的兄弟伙，饭碗儿这里只记一笔。";
    $("#r-pay-now").textContent = isUsdt ? "转完了回来报个到。" : "扫完了记得回来报个到。";
    // 有图显示图（微信/支付宝/USDT 都有图）；USDT 还可能有地址
    $("#r-qr-box").classList.toggle("hidden", !((!isUsdt && (payMethod === "wechat" ? bowl.wechatQr : bowl.alipayQr)) || (isUsdt && usdtQr)));
    $("#r-usdt-box").classList.toggle("hidden", !(isUsdt && usdtAddr));
    $("#rd-txid-field").classList.toggle("hidden", !isUsdt);

    if (isUsdt) {
      $("#r-usdt-net").textContent = payMethod === "usdt" ? "链：TRC20（T 开头）" : "链：BEP20（币安智能链）";
      $("#r-usdt-addr").textContent = usdtAddr;
      if (usdtQr) {
        $("#r-qr-box").innerHTML = `<img src="${usdtQr}" alt="USDT收款码" /><p class="qr-tip" style="margin-top:10px;">扫起，扫码就是干。</p>`;
      } else {
        $("#r-qr-box").innerHTML = `<p class="qr-tip">只留了地址，莫得图，照着地址转就是。</p>`;
      }
    } else {
      const url = payMethod === "wechat" ? bowl.wechatQr : bowl.alipayQr;
      $("#r-qr-box").innerHTML = url
        ? `<img src="${url}" alt="${payMethod === "wechat" ? "微信" : "支付宝"}收款码" /><p class="qr-tip" style="margin-top:10px;">扫起，扫码就是干。</p>`
        : `<p class="qr-tip">莫得收款码图片……</p>`;
    }
  }

  $("#btn-copy-usdt").addEventListener("click", async () => {
    await copyText(reportUsdtAddr);
    toast("地址已经抄到起了。");
  });

  /* ---------- 报到（提交投喂） ---------- */
  async function initTurnstile() {
    try {
      const cfg = await get("/api/config");
      const key = cfg.turnstileSiteKey;
      if (!key || typeof window.turnstile === "undefined") return;
      turnstileWidget = window.turnstile.render($("#turnstile-wrap"), {
        sitekey: key,
        callback: (t) => { turnstileToken = t; },
        "error-callback": () => { turnstileToken = ""; },
        "expired-callback": () => { turnstileToken = ""; },
      });
    } catch { }
  }
  initTurnstile();

  $("#btn-submit-donation").addEventListener("click", async () => {
    const btn = $("#btn-submit-donation");
    const amount = $("#rd-amount").value;
    const nickname = $("#rd-nickname").value.trim();
    const message = $("#rd-message").value.trim();
    const txid = $("#rd-txid").value.trim();
    const isAnonymous = $("#rd-anon").checked;

    if (!amount || Number(amount) <= 0) { toast("金额还是要填一个嘛，多少随你。"); return; }
    if (Number(amount) > 1000) { toast("一口顶天 1000 块，莫把别个吓到了。"); return; }
    if (!isAnonymous && !nickname) { toast("叫啥子嘛，留个名字，或者勾莫留名字。"); return; }

    btn.disabled = true;
    btn.textContent = "报到中……";
    try {
      const data = await post("/api/donation", {
        slug,
        nickname,
        amount: Number(amount),
        message,
        paymentMethod: payMethod,
        txid: txid || undefined,
        isAnonymous,
        turnstileToken: turnstileToken || undefined,
      });
      localStorage.setItem(`donation_delete_${data.id}`, data.deleteToken);
      // 成功动画：米粒掉进饭碗 + 碗轻轻晃一哈
      await playDing();
      $("#done-title").textContent = "🍚 这口饭，我给你记到起了。";
      $("#done-sub").textContent = "收到，记到饭碗儿头了。等摆碗的兄弟伙点个“放行”就显示出来。";
      showStep("done");
      // 刷新数据（一次请求）
      refresh();
    } catch (e) {
      toast(e.message || "没报到起，再整一哈。");
    } finally {
      btn.disabled = false;
      btn.textContent = "我已经投了，回来报个到";
    }
  });

  /* ---------- 投喂成功动画：米粒 + 叮 ---------- */
  function playDing() {
    return new Promise((resolve) => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1568, ctx.currentTime); // G6
        osc.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      } catch { /* 没声音就没声音嘛 */ }

      $$("#ding-scene .rice").forEach((r, i) => {
        r.classList.remove("drop");
        void r.offsetWidth;
        setTimeout(() => r.classList.add("drop"), i * 140);
      });
      // 米粒落到碗头，碗轻轻晃一下
      setTimeout(() => $("#ding-scene").classList.add("wobble"), 320);
      setTimeout(resolve, 850);
    });
  }

  async function refresh() {
    try {
      const data = await get(`/api/bowl/${slug}`);
      bowl = data.bowl;
      donations = data.donations || [];
      render();
    } catch { }
  }

  /* ---------- 弹窗开关 ---------- */
  function showStep(step) {
    ["pay", "report", "done"].forEach((s) => {
      $(`#step-${s}`).classList.toggle("hidden", s !== step);
    });
  }

  [shareMask, donateMask].forEach((mask) => {
    mask.addEventListener("click", (e) => {
      if (e.target === mask || e.target.dataset.close !== undefined) {
        mask.classList.remove("show");
      }
    });
  });

  // 关闭后若投喂成功过，顺手刷新列表展示最新记录
  donateMask.addEventListener("click", (e) => {
    if (e.target === donateMask || e.target.dataset.close !== undefined) {
      if (done) refresh();
    }
  });

  load();
})();
