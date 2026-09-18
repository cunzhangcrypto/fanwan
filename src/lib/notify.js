// 留言通知：有新投喂留言时，推给碗主人（企业微信机器人 / Telegram / Server酱 / 邮箱）
// 全部走 ctx.waitUntil 异步外呼，失败静默，绝不拖慢投喂主流程、不重试（免得重复轰炸）

const TELEGRAM_API = "https://api.telegram.org";
const SERVERCHAN_API = "https://sctapi.ftqq.com";

function buildText(bowl, donation, host) {
  const who = donation.isAnonymous ? "一个匿名耿直人" : `「${donation.nickname || "路过滴耿直人"}」`;
  const lines = [
    "🍚 有人在你碗儿头留言了！",
    "",
    `${who}说：${donation.message || "（没说啥子，就是投了一口）"}`,
    `金额：¥${donation.amountYuan}`,
    "",
    `快去放行：https://${host}/${bowl.slug}`,
  ];
  return lines.join("\n");
}

export function notifyDonation(env, ctx, bowl, donation, host) {
  const text = buildText(bowl, donation, host);
  const tasks = [];

  if (bowl.notify_wecom) tasks.push(sendWecom(bowl.notify_wecom, text));
  if (bowl.notify_telegram && env.TELEGRAM_BOT_TOKEN) {
    tasks.push(sendTelegram(env.TELEGRAM_BOT_TOKEN, bowl.notify_telegram.trim(), text));
  }
  if (bowl.notify_serverchan) tasks.push(sendServerChan(bowl.notify_serverchan.trim(), text));
  // 邮件走碗主人自己配的 HTTP 邮件 API（Resend 兼容），跟平台莫得关系、莫得额度
  if (bowl.notify_email && bowl.email_api_url && bowl.email_api_key) {
    tasks.push(sendEmail(bowl, text));
  }

  if (tasks.length) ctx.waitUntil(Promise.allSettled(tasks));
}

async function sendWecom(webhook, text) {
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content: text } }),
  });
}

async function sendTelegram(token, chatId, text) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

async function sendServerChan(sendKey, text) {
  const [title, ...rest] = text.split("\n");
  await fetch(`${SERVERCHAN_API}/${sendKey}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title, desp: rest.join("\n") }),
  });
}

async function sendEmail(bowl, text) {
  await fetch(bowl.email_api_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bowl.email_api_key}`,
    },
    body: JSON.stringify({
      from: bowl.email_from || "饭碗儿 <onboarding@resend.dev>",
      to: [bowl.notify_email.trim()],
      subject: "🍚 有人在你碗儿头留言了！",
      text,
    }),
  });
}
