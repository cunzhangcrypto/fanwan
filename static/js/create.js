/* 🍚 饭碗儿 —— 摆个饭碗儿 */
(() => {
  const { $, $$, post, put, get, upload, toast, alertCenter } = FW;

  /* ---------- 编辑模式 ---------- */
  const params = new URLSearchParams(location.search);
  const editSlug = params.get("edit");
  const editToken = params.get("token") || "";
  let editBowl = null;
  const uploads = { avatar: "", wechat_qr: "", alipay_qr: "", usdt_qr: "", usdt_bep20_qr: "" };

  async function initEdit() {
    if (!editSlug || !editToken) return;
    try {
      // 后缀摆起就定死了，改不得（链接都散出去了）
      $("#slug-field").classList.add("hidden");
      const data = await get(`/api/bowl/${editSlug}`);
      editBowl = data.bowl;
      $("#title").value = editBowl.title;
      $("#want").value = editBowl.want;
      $("#reason").value = editBowl.reason;
      $("#targetAmount").value = editBowl.targetYuan;
      if (editBowl.deadline) {
        const d = new Date(editBowl.deadline);
        const p = (x) => String(x).padStart(2, "0");
        $("#deadline").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      }
      $("#nickname").value = editBowl.nickname;
      $("#usdtAddress").value = editBowl.usdtAddress || "";
      $("#usdtBep20Address").value = editBowl.usdtBep20Address || "";
      $("#title-count").textContent = editBowl.title.length;
      $("#want-count").textContent = editBowl.want.length;
      $("#reason-count").textContent = editBowl.reason.length;

      // 收款方式随便补：摆碗时没留的，编辑时一样可以后头加
      $$("#pay-tabs .pay-tab").forEach((t) => { t.style.display = ""; });
      $("#submit").textContent = "🍚 改好喽";
      document.querySelector(".card-panel h2").textContent = "🍚 改一哈这个饭碗儿";
      document.querySelector(".card-panel .lead").textContent = "原来的钱还是记到的，只改内容哈。";
      // 不想改的话，可以直接去管理页放行/复制链接
      const jump = document.createElement("a");
      jump.className = "btn btn-sm btn-ghost";
      jump.style.marginTop = "10px";
      jump.href = `/${editSlug}?token=${encodeURIComponent(editToken)}`;
      jump.textContent = "→ 不想改了，去管理页（放行投喂 / 复制链接）";
      document.querySelector(".card-panel .lead").after(jump);
      if (editBowl.currentYuan > 0) {
        $("#targetAmount").setAttribute("min", editBowl.currentYuan);
        const hint = document.createElement("small");
        hint.className = "hint";
        hint.textContent = `已经收到 ¥${editBowl.currentYuan}，目标不能低于这个数。`;
        $("label[for='targetAmount']").appendChild(hint);
      }

      // 回显已有的收款图 / 头像
      ["wechat_qr", "alipay_qr", "usdt_qr", "usdt_bep20_qr", "avatar"].forEach((k) => {
        const field = { wechat_qr: "wechatQr", alipay_qr: "alipayQr", usdt_qr: "usdtQr", usdt_bep20_qr: "usdtBep20Qr", avatar: "avatarUrl" }[k];
        const url = editBowl[field];
        if (!url) return;
        uploads[k] = url;
        const box = document.querySelector(`.upload-box[data-upload="${k}"]`);
        if (!box) return;
        const thumb = box.querySelector("[data-thumb]");
        if (thumb) {
          thumb.innerHTML = "";
          const img = document.createElement("img");
          img.src = url;
          img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
          thumb.appendChild(img);
        }
      });
    } catch (e) {
      toast(e.message || "没拉到饭碗儿。");
    }
  }
  initEdit();

  /* ---------- 字符计数 ---------- */
  const counts = [
    ["#title", "#title-count"],
    ["#want", "#want-count"],
    ["#reason", "#reason-count"],
  ];
  counts.forEach(([input, out]) => {
    $(input).addEventListener("input", () => { $(out).textContent = $(input).value.length; });
  });

  /* ---------- 收款方式切换 ---------- */
  let payMethod = "wechat";
  const payBoxes = { wechat: "pay-wechat", alipay: "pay-alipay", usdt: "pay-usdt", usdt_bep20: "pay-usdt_bep20" };

  $$("#pay-tabs .pay-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$("#pay-tabs .pay-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      payMethod = tab.dataset.pay;
      Object.entries(payBoxes).forEach(([k, id]) => {
        const el = $(`#${id}`);
        if (k === payMethod) {
          el.classList.remove("hidden");
          if (k === "wechat") el.classList.add("wechat-on");
          if (k === "alipay") el.classList.add("alipay-on");
        } else {
          el.classList.add("hidden");
        }
      });
    });
  });

  /* ---------- 图片上传 ---------- */
  // 上传前统一处理：超大图压到 1500px 内 + 全部转成 webp。
  // 这样 R2 只存 webp（比 jpg/png 平均省一半以上），上传流量也省；小图提醒扫码不清。
  async function prepareImage(file) {
    try {
      const bmp = await createImageBitmap(file);
      const { width, height } = bmp;
      const shortest = Math.min(width, height);
      if (shortest < 300) {
        toast("图有点小，扫码怕是看不清楚，建议换张高清的。");
      }
      const scale = Math.min(1, 1500 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.9));
      return blob || file;
    } catch {
      return file; // 老浏览器转不动就原样传（后端会拦非 webp）
    }
  }

  $$(".upload-box").forEach((box) => {
    const input = box.querySelector('input[type="file"]');
    box.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const kind = box.dataset.upload;
      box.style.opacity = "0.6";
      try {
        const prepared = await prepareImage(file);
        const data = await upload(`/api/upload?kind=${kind}`, prepared);
        uploads[kind] = data.url;
        const thumb = box.querySelector("[data-thumb]");
        thumb.innerHTML = "";
        const img = document.createElement("img");
        img.src = data.url;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
        thumb.appendChild(img);
        toast("图片传上去了。");
      } catch (e) {
        toast(e.message || "图片没传上去。");
      } finally {
        box.style.opacity = "1";
      }
    });
  });

  /* ---------- Turnstile ---------- */
  let turnstileToken = "";
  let turnstileWidget = null;

  async function initTurnstile() {
    try {
      const cfg = await FW.get("/api/config");
      const key = cfg.turnstileSiteKey;
      if (!key || typeof window.turnstile === "undefined") return;
      turnstileWidget = window.turnstile.render($("#turnstile-wrap"), {
        sitekey: key,
        callback: (token) => { turnstileToken = token; },
        "error-callback": () => { turnstileToken = ""; },
        "expired-callback": () => { turnstileToken = ""; },
      });
    } catch { /* 拿不到配置就算了，后端有 secret 时会拦 */ }
  }
  initTurnstile();

  /* ---------- 自定义后缀 ---------- */
  const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
  const slugInput = $("#slug");
  const slugPreview = $("#slug-preview");

  slugInput.addEventListener("input", () => {
    // 只留英文小写 / 数字 / 短横杠，顺手转小写
    slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
    const v = slugInput.value.trim();
    slugPreview.textContent = v ? `${location.origin}/${v}` : "";
  });

  /* ---------- 提交 ---------- */
  $("#submit").addEventListener("click", async () => {
    const errBox = $("#form-error");
    errBox.textContent = "";
    const btn = $("#submit");
    btn.disabled = true;
    btn.textContent = "摆起中……";

    const isEdit = !!(editSlug && editToken);
    const title = $("#title").value.trim();
    const want = $("#want").value.trim();
    const reason = $("#reason").value.trim();
    const targetAmount = $("#targetAmount").value;
    const nickname = $("#nickname").value.trim();
    const deadline = $("#deadline").value || null;
    const usdtAddress = $("#usdtAddress").value.trim();
    const usdtBep20Address = $("#usdtBep20Address").value.trim();
    const slugVal = $("#slug").value.trim().toLowerCase();

    const BEP20_RE = /^0x[a-fA-F0-9]{40}$/;

    if (!title) errBox.textContent = "饭碗儿总得喊个啥子嘛。";
    else if (!want) errBox.textContent = "想吃啥子还是要说清楚点嘛。";
    else if (!reason) errBox.textContent = "为啥子要吃，总要说两句嘛。";
    else if (!targetAmount || Number(targetAmount) <= 0) errBox.textContent = "目标金额要大于 0 哦。";
    else if (Number(targetAmount) > 1000) errBox.textContent = "胃口莫太大，1000 块封顶了哈。";
    else if (!nickname) errBox.textContent = "叫啥子嘛，总得留个名字。";
    else if (usdtBep20Address && !BEP20_RE.test(usdtBep20Address)) errBox.textContent = "BEP20 地址不对头，0x 开头 42 位，看清楚哈。";
    else if (slugVal && !SLUG_RE.test(slugVal)) errBox.textContent = "后缀只准用英文小写字母、数字和短横杠，3 到 20 位哈。";

    if (errBox.textContent) {
      // 错误跳转到对应字段并高亮
      const errEl =
        (errBox.textContent === "饭碗儿总得喊个啥子嘛。" && $("#title")) ||
        (errBox.textContent === "想吃啥子还是要说清楚点嘛。" && $("#want")) ||
        (errBox.textContent === "为啥子要吃，总要说两句嘛。" && $("#reason")) ||
        (errBox.textContent === "目标金额要大于 0 哦。" && $("#targetAmount")) ||
        (errBox.textContent === "胃口莫太大，1000 块封顶了哈。" && $("#targetAmount")) ||
        (errBox.textContent === "叫啥子嘛，总得留个名字。" && $("#nickname")) ||
        (errBox.textContent === "BEP20 地址不对头，0x 开头 42 位，看清楚哈。" && $("#usdtBep20Address")) ||
        (errBox.textContent === "后缀只准用英文小写字母、数字和短横杠，3 到 20 位哈。" && $("#slug"));
      if (errEl) {
        errEl.scrollIntoView({ behavior: "smooth", block: "center" });
        errEl.classList.add("field-error");
        setTimeout(() => errEl.classList.remove("field-error"), 2200);
        const inp = errEl.querySelector ? errEl.querySelector("input, textarea") : null;
        if (inp) inp.focus({ preventScroll: true });
        else if (errEl.focus) errEl.focus({ preventScroll: true });
      }
      btn.disabled = false;
      btn.textContent = isEdit ? "🍚 改好喽" : "🍚 把饭碗儿摆起";
      return;
    }

    const payload = {
      title,
      want,
      reason,
      targetAmount: Number(targetAmount),
      deadline,
      wechatQr: uploads.wechat_qr || undefined,
      alipayQr: uploads.alipay_qr || undefined,
      usdtQr: uploads.usdt_qr || undefined,
      usdtAddress: usdtAddress || undefined,
      usdtBep20Qr: uploads.usdt_bep20_qr || undefined,
      usdtBep20Address: usdtBep20Address || undefined,
      nickname,
      slug: slugVal || undefined,
      turnstileToken: turnstileToken || undefined,
    };

    try {
      if (isEdit) {
        payload.editToken = editToken;
        delete payload.turnstileToken;
        delete payload.slug;
        await put(`/api/bowl/${editSlug}`, payload);
        // 记住这个浏览器，下次直接打开碗页就是管理界面
        localStorage.setItem("bowl_edit_token", JSON.stringify({ slug: editSlug, token: editToken }));
        toast("改好喽。");
        location.href = `/${editSlug}?token=${encodeURIComponent(editToken)}`;
        return;
      }

      payload.avatarUrl = uploads.avatar || undefined;
      const data = await post("/api/bowl", payload);

      localStorage.setItem("bowl_edit_token", JSON.stringify({ slug: data.slug, token: data.editToken }));
      $("#goto-bowl").href = `/${data.slug}`;
      $("#success-mask").classList.add("show");
      document.querySelector("#copy-link").dataset.slug = data.slug;
      document.querySelector("#copy-manage").dataset.slug = data.slug;
      document.querySelector("#copy-manage").dataset.token = data.editToken;
    } catch (e) {
      // 服务端报错（如一天摆一次的限制）在屏幕中间弹出来，莫贴到最上面看球不到
      alertCenter(e.message || "饭碗儿没摆稳，再整一哈嘛。");
    } finally {
      btn.disabled = false;
      btn.textContent = isEdit ? "🍚 改好喽" : "🍚 把饭碗儿摆起";
    }
  });

  /* ---------- 成功弹窗 ---------- */
  const mask = $("#success-mask");

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  $("#copy-link").addEventListener("click", async (e) => {
    await copyText(`${location.origin}/${e.currentTarget.dataset.slug}`);
    $("#copy-tip").style.display = "block";
  });

  // 管理链接：里面有令牌，打开就是管理界面（放行/复制链接）。存好，丢了就找不回了。
  $("#copy-manage").addEventListener("click", async (e) => {
    const { slug, token } = e.currentTarget.dataset;
    await copyText(`${location.origin}/${slug}?token=${encodeURIComponent(token)}`);
    $("#manage-tip").style.display = "block";
  });

  $("#another-bowl").addEventListener("click", () => location.reload());

  mask.addEventListener("click", (e) => {
    if (e.target === mask) mask.classList.remove("show");
  });
})();
