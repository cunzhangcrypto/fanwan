/* 🍚 饭碗儿 —— 首页 */
(() => {
  const { $, get, yuan, fmtTime, mealState, pick } = FW;

  // 底部土味口号：从 /tips.md 随机轮换（每 3 秒一句）
  const FALLBACK_TIPS = [
    "今天吃啥子？先把饭碗儿摆起再说。🍚",
    "人可以莫得钱，饭碗儿还是要有。🍚",
    "出来混，饭还是要吃的。🥢",
    "生活已经够恼火了，饭碗儿不能再空起。😮‍💨",
  ];
  let tips = FALLBACK_TIPS;
  let lastTip = -1;
  const sloganEl = $("#slogan");
  function showTip() {
    if (!tips.length) return;
    let i;
    do {
      i = Math.floor(Math.random() * tips.length);
    } while (tips.length > 1 && i === lastTip);
    lastTip = i;
    sloganEl.textContent = tips[i];
    sloganEl.classList.remove("fade");
    void sloganEl.offsetWidth;
    sloganEl.classList.add("fade");
  }
  showTip();
  fetch("/tips.md")
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error("no tips"))))
    .then((t) => {
      tips = t.split("\n").map((s) => s.trim()).filter(Boolean);
      showTip(); // 拉到了就先换一句，莫让用户干等 8 秒
    })
    .catch(() => {})
    .finally(() => setInterval(showTip, 8000));

  const STATUS_TEXT = {
    active: "🍚 还在讨生活",
    completed: "🍚 吃饱喽，收碗！",
    expired: "🍚 饭凉了，收碗了",
    hidden: "🍚 收摊了",
  };

  let page = 1;
  let total = 0;
  const pageSize = 9;

  async function load(reset = false) {
    if (reset) { page = 1; $("#bowl-list").innerHTML = ""; }
    const box = $("#bowl-list");
    if (page === 1) box.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await get(`/api/bowl?status=active&sort=newest&page=${page}&pageSize=${pageSize}`);
      total = data.total;
      $("#bowl-count").textContent = total ? `共 ${total} 个饭碗儿摆起` : "";

      if (reset) box.innerHTML = "";
      data.items.forEach(renderCard);

      if (box.children.length === 0) {
        $("#empty-box").classList.remove("hidden");
      } else {
        $("#empty-box").classList.add("hidden");
      }
      const hasMore = page * pageSize < total;
      $("#load-more").classList.toggle("hidden", !hasMore);
      page++;
    } catch (e) {
      if (page === 1) {
        box.innerHTML = `
          <div class="empty" style="grid-column:1/-1;">
            <img src="/img/bowl.svg" alt="空碗" />
            <h2>哎呀，饭碗没接住。</h2>
            <p>${e.message || "网络这哈有点恼火，再整一哈嘛。"}</p>
            <button class="btn" onclick="location.reload()">再整一次</button>
          </div>`;
      }
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderCard(b) {
    const statusTxt = STATUS_TEXT[b.status] || "还在讨生活";
    const pct = b.percent || 0;
    const deadlineTxt = b.deadline
      ? `截止 ${new Date(b.deadline).getMonth() + 1}月${new Date(b.deadline).getDate()}日`
      : "没得截止，慢慢等";

    const el = document.createElement("a");
    el.className = "bowl-card";
    el.href = `/${b.slug}`;
    el.innerHTML = `
      <div class="row">
        ${b.avatarUrl
          ? `<img class="avatar" src="${b.avatarUrl}" alt="头像" />`
          : `<span class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:20px;">🍚</span>`}
        <h3>${escapeHtml(b.title)}</h3>
        <span class="status-tag">${statusTxt}</span>
      </div>
      <div class="meta"><b style="color:var(--gold-deep)">${mealState(pct)}</b> · ¥${yuan(b.currentYuan)} / ¥${yuan(b.targetYuan)} · ${deadlineTxt}</div>
      <div class="progress">
        <div class="fill ${pct >= 100 ? "full" : ""}" style="width:${pct}%"></div>
        <span class="pct">${pct}%</span>
      </div>
      <div class="foot">
        <span class="who">👨‍💻 ${b.donorCount || 0} 个耿直人投过</span>
        <span style="color:var(--gold-deep); font-weight:700;">进去瞅一哈 →</span>
      </div>
    `;
    $("#bowl-list").appendChild(el);
  }

  $("#load-more-btn").addEventListener("click", () => load());
  load(true);
})();
