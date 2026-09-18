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
      data.items.forEach((b) => renderCard(b));

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

  // 首页卡片动态留言的重庆土话：没放行的打赏 / 遭拒的留言
  // 文案从 /feed-texts.md 拉（静态文件，直接往里头加 - 行就行）；
  // 拉不到就用下面这份兜底，莫让卡片空起。
  let PENDING_TEXTS = [
    "好像有个耿直人打赏了，但碗主人不晓得一天忙些啥子，也不来确认一哈儿，真的是恼火哦",
    "有个耿直人投了钱，碗主人怕是去打麻将了，还没来确认哦",
    "打赏都到了，碗主人还在睡瞌睡，硬是莫得法",
    "钱都到手边了，碗主人还在耍手机，不慌不忙的哦",
    "有个耿直人给了赏钱，碗主人还影影儿都没来认领，急人",
    "莫不是碗主人把这事搞忘求了？有个耿直人还在等到起哦",
    "赏钱摆到那儿了，碗主人还在磨洋工，硬是心头不慌",
    "有个耿直人出手了，碗主人怕是还没睡醒，慢慢吞吞的",
    "打赏单都出来了，碗主人硬是稳得起，还没来点确认",
    "碗主人不晓得忙啥子去了，耿直人的赏钱都还没人认领",
    "有个耿直人投喂了，碗主人怕是去赶场了，还没回来",
    "赏钱都到了，碗主人还在拖，硬是急死人",
    "碗主人莫不是把手机撇脱了？耿直人的打赏还没人确认",
    "有个耿直人掏了腰包，碗主人还在那里磨皮擦痒",
    "打赏到了半天，碗主人硬是没得反应，像没得这回事样",
    "碗主人还在摆龙门阵？有个耿直人的赏钱等到起在哦",
    "耿直人的钱都给了，碗主人还在犹豫啥子嘛，快点确认",
    "有个耿直人打赏了，碗主人还在数毛毛钱，忘了来确认",
    "赏钱都到了，碗主人硬是稳如泰山，还不来确认一哈",
    "碗主人怕是忙到起加班，耿直人的打赏都还没人来接",
  ];
  let REJECTED_TEXTS = [
    "这个人不老实，没给钱就留言，真是个瓜娃子",
    "一分钱没花就想留言？老子看都不看，直接拒了",
    "想白嫖？我手一抖就给他拒了",
    "莫得钱还来装耿直人，我心头冒火，拒求了",
    "空手就想来整两句？门儿都莫得，我直接拒了",
    "这个人不安逸，没投喂就想留言，我看他都不顺眼",
    "没给钱就想留话？我毛了，直接不认",
    "想混水摸鱼？我一眼就看穿了，拒了",
    "白吃白喝还想留句好听的？莫想，我给他打回去了",
    "这个瓜娃子，一分钱莫得就想来留言，我心头都替他臊皮",
    "没诚意还来留言，我看都懒得看，拒求了",
    "想捡耙活？莫门，我亲自给他拒了",
    "不耿直的人莫来沾边，留言我甩都懒得甩",
    "我没放行就是嫌他不老实，莫怪我无情",
    "这种空手套白狼的，我见一个拒一个",
    "想白吃这碗饭？留言我先扣到起，再给他拒了",
    "这个人怕是不晓得锅儿是铁打的，没给钱就留言，遭我拒了",
    "一分钱都舍不得花还想留言？我心头不爽，拒了",
    "莫得投喂就想留话？我直接给他按到拒了",
    "这个人不耿直，我心头有数，留言莫想放行",
  ];
  const pickText = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 从 /feed-texts.md 拉文案：`# 没放行` / `# 遭拒` 分节，`- ` 开头是条目
  async function loadFeedTexts() {
    try {
      const res = await fetch("/feed-texts.md", { cache: "no-store" });
      if (!res.ok) return;
      const text = await res.text();
      const pending = [];
      const rejected = [];
      let section = "pending";
      for (const line of text.split("\n")) {
        const t = line.trim();
        // 分区标题是 ## 开头（比如 ## 没放行、## 遭拒），用 startsWith("#") 才匹配得到
        if (t.startsWith("#")) {
          section = /遭拒|拒绝/.test(t) ? "rejected" : "pending";
        } else if (t.startsWith("- ")) {
          const item = t.slice(2).trim();
          if (item) (section === "rejected" ? rejected : pending).push(item);
        }
      }
      if (pending.length) PENDING_TEXTS = pending;
      if (rejected.length) REJECTED_TEXTS = rejected;
      load(true); // 文案更新了，重新渲染一哈
    } catch { /* 拉不到就用兜底文案 */ }
  }

  // 组装一张卡片的动态留言队列：没放行（优先）→ 遭拒（只有没 pending 才显示）→ 已放行的留言内容
  function buildFeed(b) {
    const items = [];
    if (b.pendingCount > 0) {
      items.push({ text: pickText(PENDING_TEXTS) });
    } else if (b.rejectedCount > 0) {
      items.push({ text: pickText(REJECTED_TEXTS) });
    }
    (b.recentMessages || []).forEach((m) => {
      const who = m.isAnonymous ? "匿名耿直人" : m.nickname || "路过滴耿直人";
      items.push({ text: `${who}留言：${m.message || "投了一口，莫得话说"}` });
    });
    return items;
  }

  // 留言长了就从右到左滚起来，短的就老实停起
  // itemEl 是 .who-txt：宽度 = 内容全宽；可视窗口是父容器 .who（overflow:hidden 裁切）
  // 所以溢出判定：内容宽(scrollWidth) > 窗口宽(who.clientWidth)
  function applyScroll(itemEl) {
    const win = itemEl.parentElement || itemEl;
    itemEl.classList.remove("scrolling");
    itemEl.style.animationDuration = "";
    if (itemEl.scrollWidth > win.clientWidth) {
      itemEl.classList.add("scrolling");
      // 持续滚动：右侧滑入 → 左侧滑出，位移 = 2 倍文字宽；速度 20px/s 慢点好读
      const distance = itemEl.scrollWidth * 2;
      itemEl.style.animationDuration = Math.max(10, Math.round(distance / 20)) + "s";
    }
  }

  // 动态留言轮播：和「N 个耿直人投过」在同一位置轮换
  // 切换时长不固定：短内容 6 秒；长内容等它滚完一遍再加 2 秒缓冲，免得没看完就跳
  function initFeed(card, queue) {
    const who = card.querySelector(".who-txt");
    if (!who || queue.length <= 1) return;
    let i = 0;
    let timer = null;
    const show = () => {
      who.style.opacity = "0";
      setTimeout(() => {
        who.textContent = queue[i].text;
        applyScroll(who);
        who.style.opacity = "1";
        schedule();
      }, 240);
    };
    const schedule = () => {
      const dur = parseFloat(who.style.animationDuration || "0") || 0;
      const wait = dur > 0 ? dur * 1000 + 2000 : 6000;
      timer = setTimeout(() => { i = (i + 1) % queue.length; show(); }, wait);
    };
    // 首条也走同样的动态时长：先量溢出再排下一次切换
    setTimeout(() => {
      applyScroll(who);
      schedule();
    }, 0);
  }

  function renderCard(b, list) {
    const feed = buildFeed(b);
    const queue = [{ text: `${b.donorCount || 0} 个耿直人投过` }, ...feed];
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
        <div class="foot-main">
          <span class="who-icon">👨‍💻</span>
          <span class="who"><span class="who-txt">${escapeHtml(queue[0].text)}</span></span>
        </div>
        <span class="go-btn">进去瞅一哈 →</span>
      </div>
    `;
    (list || $("#bowl-list")).appendChild(el);
    initFeed(el, queue);
  }

  // 吃饱收摊的碗（completed / expired / hidden），默认折叠起，点开才看
  async function loadDone() {
    const box = $("#done-list");
    try {
      const data = await get(`/api/bowl?status=completed,expired,hidden&sort=newest&page=1&pageSize=50`);
      const items = data.items || [];
      $("#done-count").textContent = items.length ? `共 ${data.total || items.length} 个碗吃饱收摊了` : "";
      if (!items.length) {
        box.innerHTML = '<div class="empty" style="padding:20px;"><p style="margin:0;">还没得碗吃饱收摊。头一个吃饱的，怕是快了。</p></div>';
        return;
      }
      items.forEach((b) => renderCard(b, box));
    } catch { /* 拉不到就算了，莫影响主页 */ }
  }

  $("#load-more-btn").addEventListener("click", () => load());
  load(true);
  loadDone();
  loadFeedTexts();
})();
