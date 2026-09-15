# 🍚 饭碗儿
<p align="center">
  <img src="static/img/pic.png" alt="饭碗儿首页" width="720" />
</p>
> 没得饭吃啷个办？先把饭碗儿摆出来嘛。

一个有点重庆味的开源在线饭碗儿。

没得啥子复杂东西。

你可以：

- 摆个饭碗儿
- 说哈自己想吃啥子
- 留个收款方式
- 把饭碗儿甩出去
- 等哪个耿直人来投一口
- 看哈哪些兄弟伙来过

没有 VPS。

没有复杂后端。

没有支付系统。

没有区块链实时监听。

没有钱包私钥。

就是一个简单、轻量、有点土、但是能真正跑起来的互联网饭碗儿。

## 🍚 为啥子叫饭碗儿？

因为人活到嘛，总归要吃饭。

以前我们说：

"搞钱。"

现在换个说法：

"先把饭碗儿端稳。"

互联网这么大。

有人写代码。

有人做视频。

有人搞开源。

有人创业。

有人刚好今天没得饭吃。

那就：

**先把饭碗儿摆出来嘛。**

---

## ✨ 特性

- 🍚 **摆饭碗儿**：写清楚想吃啥、为啥吃、想整多少钱、啷个收，甩个链接出去
- 💰 **投一口**：看到微信/支付宝收款码或 USDT 地址（TRC20 / BEP20），自己去外面付款，回来报个到
- 📝 **投喂记录**：每个饭碗儿都有耿直人记录 + 排行榜（哪些兄弟伙最耿直）
- 🛡️ **防刷**：Turnstile 人机验证 + 每 IP 每天只能摆一个饭碗儿（IP 只存哈希）
- 🖼️ **OG 分享图**：每个饭碗儿自动生成 1200×630 分享图（微信/Telegram/X 都认）
- 📱 **移动端**：原生 HTML/CSS/JS，零构建，手机上一样巴适

## 🏗️ 技术栈

| 层 | 用的啥子 |
|---|---|
| 前端 | 纯 HTML/CSS/JS，零构建 |
| API / 托管 | Cloudflare Worker（单 Worker 一体托管） |
| 数据库 | Cloudflare D1（SQLite） |
| 图片 / 字体 | Cloudflare R2 |
| 人机验证 | Cloudflare Turnstile |
| OG 图 | cf-workers-og（Satori + resvg WASM） |
| 代码 | GitHub + MIT 开源 |

## 📁 目录结构

```
饭碗儿/
├── wrangler.toml              # Worker / assets / D1 / R2 / vars 配置
├── schema.sql                 # 完整建表 DDL（与 migrations 同步）
├── migrations/0001_init.sql   # D1 迁移
├── src/
│   ├── index.js               # Worker 入口：/api/*、/i/*、/og/*、静态资源分流
│   ├── assets.js              # 静态资源 + bowl.html 的 OG meta 动态注入
│   ├── api/                   # bowls / donations / upload / admin / og
│   └── lib/                   # resp / validate / turnstile / ip / slug / db / og-render
├── static/
│   ├── index.html             # 首页（大饭桌）
│   ├── create.html            # 摆个饭碗儿
│   ├── bowl.html              # 饭碗儿详情
│   ├── admin.html             # 后台
│   ├── 404.html               # 饭碗儿遭你整丢了
│   ├── css/style.css          # 土味精致主题
│   ├── js/                    # api.js / index.js / create.js / bowl.js / admin.js
│   └── img/                   # logo / 碗 / 米粒 SVG
├── scripts/
│   ├── download-font.mjs      # 下载中文字体到本地
│   └── upload-font.mjs        # 上传字体到 R2
└── .github/workflows/deploy.yml  # 手动 Run workflow 才迁移 D1 + 部署（不自动触发）
```

## 🚀 本地跑起来

前置：装好 [Node.js 18+](https://nodejs.org/)、`wrangler login` 登录了 Cloudflare 账号。

```bash
# 1. 拉代码装依赖
git clone <你的仓库地址> && cd 饭碗儿
npm i

# 2. 创建 D1 数据库和 R2 桶，把返回的 database_id 填进 wrangler.toml
wrangler d1 create fanwaner
wrangler r2 bucket create fanwaner-assets

# 3. 建 Turnstile 站点（https://dash.cloudflare.com → Turnstile → 添加站点）
#    拿到 Site Key 填到 wrangler.toml 的 TURNSTILE_SITE_KEY

# 4. 本地密钥（复制 .env.example 为 .dev.vars，填三个 secret）
cp .env.example .dev.vars

# 5. 建本地表 + 起开发服务
npm run db:local
npm run dev
```

打开 `http://localhost:8787`，走一遍：摆个饭碗儿 → 详情 → 投一口 → 后台审核。

> 本地开发时 Turnstile 没配 secret 会自动跳过人机验证，方便调试；线上必须配。

## ☁️ 部署到 Cloudflare（纯线上，小白友好）

**全程网页操作，不用装任何东西、不用敲一行命令。**

### 1. Fork 仓库

到 [GitHub 仓库页](https://github.com/cunzhangcrypto/fanwan) 点右上角 **Fork**，Fork 到自己的账号下。

### 2. Cloudflare 控制台准备（约 5 分钟，全网页点）

打开 [dash.cloudflare.com](https://dash.cloudflare.com)：

1. **创建 D1 数据库**：Workers & Pages → D1 → Create database，名字随便（如 `fanwaner`）→ 创建后**复制 Database ID**
2. **创建 R2 桶**：R2 → Create bucket，名字 `fanwaner-assets`（可改）
3. **创建 Turnstile 站点**：Turnstile → Add site，域名先填 `*` 或你的 workers.dev 域名 → 拿到 **Site Key** 和 **Secret Key**
4. **创建 API Token**：右上头像 → My Profile → API Tokens → Create Token → 选模板 **Edit Cloudflare Workers** → Create → **复制 Token**
5. **复制 Account ID**：控制台首页右下角

### 3. GitHub 仓库填 Secrets

在自己 Fork 的仓库 → Settings → Secrets and variables → Actions → **New repository secret**，加 9 个：

| Secret 名 | 填啥子 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 第 2 步的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 第 2 步的 Account ID |
| `D1_DATABASE_ID` | 第 2 步的 Database ID |
| `R2_BUCKET` | 桶名（默认 `fanwaner-assets`） |
| `TURNSTILE_SITE_KEY` | Turnstile Site Key |
| `TURNSTILE_SECRET_KEY` | Turnstile Secret Key |
| `SERVER_SECRET` | 随便编一串乱码（IP 哈希盐） |
| `ADMIN_KEY` | 随便编一串（后台钥匙） |

> `SITE_URL` 不用配：分享图链接自动取当前访问域名生成，绑自定义域名也自动正确。

### 4. 触发部署

自己仓库 → Actions → 左侧 **Deploy** → **Run workflow**。

等 1-2 分钟，Actions 全绿就部署好了：自动完成建表 → 传字体 → 设密钥 → 上线。

### 5. 打开验证

部署日志里会出现 `https://fanwaner.你的用户名.workers.dev`，打开就能用了。OG 分享图链接会自动用当前域名拼，不用额外配置。

> 想绑自己的域名：Workers → fanwaner → Settings → Domains & Routes → Add 自定义域名即可，分享链接同样自动跟着新域名走。

---

## 🧑‍💻 命令行部署（进阶，作者/开发者用）

```bash
# 1. 三个密钥（不要写进仓库）
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put SERVER_SECRET      # 随便一串随机字符，用于 IP 哈希
wrangler secret put ADMIN_KEY          # 后台管理钥匙（Bearer Token）

# 2. 同步线上表结构
npm run db:remote

# 3. 上传中文字体（OG 分享图用，约 16MB）
npm run font:download
npm run font:upload

# 4. 部署
npm run deploy
```

然后把 `SITE_URL`（如 `https://fanwaner.你的名字.workers.dev`）填进 `wrangler.toml` 的 `[vars]`，再 deploy 一次，让 OG 图链接拼对。

想绑定自定义域名，在 `wrangler.toml` 里加：

```toml
routes = [{ pattern = "fanwaner.example.com", custom_domain = true }]
```

## 🔑 环境变量

| 变量 | 放哪 | 说明 |
|---|---|---|
| `TURNSTILE_SITE_KEY` | `wrangler.toml` `[vars]` | Turnstile 站点公开 key（前端用） |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile 服务端校验 key |
| `SERVER_SECRET` | Secret | IP 日限哈希盐，随机字符串 |
| `ADMIN_KEY` | Secret | 后台 Bearer Token |
| `MAX_AMOUNT_YUAN` | `[vars]` | 金额上限（默认 1000 元） |
| `MAX_UPLOAD_BYTES` | `[vars]` | 图片上传上限（默认 2MB） |
| `R2_FONT_KEY` | `[vars]` | OG 字体在 R2 的 key |

> OG 图链接不需要 `SITE_URL`：`assets.js` 直接用当前请求域名拼，部署/绑域名都自动正确。

## 🔌 API

统一返回 `{ ok, data }` 或 `{ ok: false, error: { code, message } }`。

| 接口 | 说明 |
|---|---|
| `GET /api/config` | 下发 Turnstile sitekey、金额上限等公开配置 |
| `GET /api/bowl` | 饭碗儿列表（支持 `?status=&sort=&page=`） |
| `POST /api/bowl` | 摆个饭碗儿（Turnstile + IP 日限 + 字段校验） |
| `GET /api/bowl/:slug` | 饭碗儿详情（含已放行的投喂记录；状态懒更新：过期/吃饱） |
| `PUT /api/bowl/:slug` | 改饭碗儿（需 editToken） |
| `POST /api/donation` | 投一口（写入待审核） |
| `DELETE /api/donation/:id` | 撤回自己的投喂（需 deleteToken，仅待审核可删） |
| `POST /api/upload` | 图片上传到 R2（头像/收款码） |
| `GET /api/admin/pending` | 后台：待审核投喂（Bearer ADMIN_KEY） |
| `POST /api/admin/approve` | 放他过（累加金额，幂等） |
| `POST /api/admin/reject` | 这个不行 |
| `POST /api/admin/delete` | 端走（投喂或饭碗儿） |
| `GET /i/:key` | 读取 R2 图片（immutable 缓存） |
| `GET /og/:slug.png` | 饭碗儿 OG 分享图（懒生成 + R2 缓存） |

## 🛡️ 防刷与安全

- **Turnstile**：创建饭碗儿、投一口都要过；前端 `GET /api/config` 拿 sitekey，Worker 端再用 secret 二次验证
- **IP 日限**：`daily_key = SHA-256(ip + 日期 + SERVER_SECRET)`，DB 唯一约束兜底并发；IP 不明文落库（投喂记录也只存哈希）
- **XSS**：所有用户内容用 `textContent` 渲染
- **后台**：`ADMIN_KEY` 走 Bearer Token，只存在 Worker Secret
- **上传**：前端统一转 webp（canvas）+ 后端魔数校验只收 webp + 2MB 上限 + 轻量 IP 限流

## 🍚 赏口饭吃

写代码的也要吃饭嘛。觉得饭碗儿好用、帮到了你，欢迎赏一口，让作者也端稳饭碗儿。

| 微信 | 支付宝 |
|---|---|
| <img src="static/img/donate/wechat.png" width="180" alt="微信打赏" /> | <img src="static/img/donate/alipay.png" width="180" alt="支付宝打赏" /> |

| USDT (TRC20) | USDT (BEP20) |
|---|---|
| <img src="static/img/donate/trc20.png" width="180" alt="USDT TRC20 打赏" /> | <img src="static/img/donate/bep20.png" width="180" alt="USDT BEP20 打赏" /> |

**USDT 地址（转之前看清楚哈）：**

- TRC20：`TLRi2gcqVmmgqtXBYyHuviLRxY2eeiuXk9`
- BEP20：`0x88f9908344E711bffcB95b26aeF54fe3d56b919B`

## ⚠️ 免责声明

饭碗儿不是支付平台，不收钱、不托管钱、不监听链上。

投一口的钱是你**直接**给饭碗儿主人的，饭碗儿这里只负责记一笔"有人投过"。

USDT 地址转之前看清楚哈，地址错了，饭碗儿也救不回来。

## 🔍 验收清单（需求文档 §71 简版）

- [x] 首页重庆土味、Logo 是饭碗儿
- [x] 按钮叫"摆个饭碗" / "投一口"
- [x] 无轮询、无 WebSocket、无支付网关、无余额系统
- [x] Turnstile 生效、每 IP 每天只能摆一个饭碗儿
- [x] 可创建 / 分享 / 投一口 / 审核 / 排行榜 / 空状态 / 重庆味 404 / 分享卡片
- [x] 手机端正常、GitHub README 完整、Cloudflare 可直接部署

## 📄 License

[MIT](LICENSE)

---

> 莫问，问就是先吃饭。🍚
