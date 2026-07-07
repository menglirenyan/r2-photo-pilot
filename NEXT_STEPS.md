# 图片上传展示 MVP 下一阶段台账

## 0. 最新公开只读验证

- 2026-07-06：`https://r2-photo-pilot.vercel.app` 返回 HTTP 200，HTML 包含 `R2 Photo Pilot`。
- 2026-07-06：`https://r2-photo-pilot.vercel.app/api/uploads` 返回 HTTP 200，`configured: true`，可读到 `codex-smoke` metadata 记录。
- 2026-07-06：R2 测试图片 public URL 返回 HTTP 200，`Content-Type: image/jpeg`。
- 2026-07-06：3.7MB 程序生成 JPEG 单图试跑通过：线上 `/api/sign-upload` 返回 signed URL，PUT R2 成功，`/api/uploads` 写入 Supabase 成功，展示 API 可回读 metadata。
- 2026-07-06：`C:\Users\xiaor\Pictures\Screenshots` 小批量试跑通过：28 张 PNG 全部上传成功，失败 0；Supabase 可回读 28 条 `screenshots-folder` metadata；抽样 3 张 R2 public URL 均返回 HTTP 200 / `image/png`。
- 2026-07-06：L3 判定通过。当前线上共有 30 条 metadata 记录，覆盖 API smoke、3.7MB 单图、28 张截图小批量上传。
- 当前结论：L3 核心链路验证成功；L4 已确认三类网络均可打开但国内直连慢；L5 已绑定 `huowu.org` / `www.huowu.org` 并通过 Cloudflare 橙云访问、R2 CORS、自定义域名上传烟测。下一步需要对比 `.vercel.app` 与 `huowu.org` 的国内直连速度。

## 1. 当前结论

- 正式项目目录：`C:\Users\xiaor\Documents\厂子网页`
- 迁移来源：`C:\Users\xiaor\Documents\agent\r2-photo-pilot`
- 当前策略：先用 Vercel Hobby 的 `.vercel.app` 地址做 0 成本验证。
- 第一阶段不做：买域名、备案、服务器、登录、后台、删除、压缩、缩略图、分页。
- 敏感动作处理：账号注册提交、验证码、OTP、付款、域名购买、API key 创建最终确认前由用户确认或接手。

## 2. 已迁入内容

- Next.js / React MVP 页面
- R2 signed direct upload API：`/api/sign-upload`
- Supabase metadata API：`/api/uploads`
- Supabase schema：`supabase/schema.sql`
- R2 CORS 示例：`r2-cors.example.json`
- 环境变量模板：`.env.example`

## 3. 云服务入口

- Vercel Pricing：<https://vercel.com/pricing>
- Vercel Dashboard：<https://vercel.com/dashboard>
- Cloudflare R2 Pricing：<https://developers.cloudflare.com/r2/pricing/>
- Cloudflare Dashboard：<https://dash.cloudflare.com/>
- Supabase Billing Docs：<https://supabase.com/docs/guides/platform/billing-on-supabase>
- Supabase Dashboard：<https://supabase.com/dashboard>

域名购买候选：

- Porkbun：<https://porkbun.com/>
- Cloudflare Registrar：<https://www.cloudflare.com/products/registrar/>
- NameSilo：<https://www.namesilo.com/>

## 4. L0 本地收口

状态：

- [x] 将试水项目迁入当前项目根目录
- [x] 修复 README 中文内容
- [x] 新增本台账
- [x] `npm install`
- [x] `npm run build`
- [x] 本地 Browser smoke test

本地 smoke test 检查项：

- 页面能打开 `http://localhost:3000`
- 无 Next runtime overlay
- 浏览器 console 无 error/warn
- 未配置 env 时显示 mock/未配置状态
- 点击上传按钮在未选图片时能提示错误

结果记录：

- 2026-07-06：`npm install` 完成；Node 22.12.0 对 `eslint-visitor-keys` 有非阻塞 engine warning。
- 2026-07-06：`npm run build` 通过，Next.js 16.2.10 成功生成主页和两个 API 路由。
- 2026-07-06：Browser 打开 `http://127.0.0.1:3000/`，确认页面标题、上传区、展示列表、mock 提示存在；console 无 error/warn；未选图片点击上传可显示“请先选择一张图片。”。

## 5. L1 账号与资源开通

自动化状态：

- 2026-07-06：Browser 插件打开外部 dashboard 时多次超时；Computer Use 仍因 `@oai/sky` package exports 错误不可用；本机未安装 `vercel`、`wrangler`、`supabase` CLI，当前仓库也没有 Git remote。
- 因此 L1/L2 的云端创建步骤先按 `CLOUD_SETUP_RUNBOOK.md` 手动执行，完成后再回到 Codex 做环境变量校验和真实上传测试。

Vercel：

- [x] 登录或注册
- [x] 使用 Hobby 免费计划
- [ ] 连接 Git 仓库
- [x] 导入当前项目
- [x] 获得 `.vercel.app` 地址

部署记录：

- 2026-07-06：Vercel CLI 登录成功，账号显示为 `xiaorongrugu-7726`。
- 2026-07-06：创建并链接 Vercel 项目 `for-free/r2-photo-pilot`。
- 2026-07-06：Production 部署成功。
- Production alias：`https://r2-photo-pilot.vercel.app`
- Deployment URL：`https://r2-photo-pilot-rm7qm0mg5-for-free.vercel.app`
- Inspect URL：`https://vercel.com/for-free/r2-photo-pilot/E4Ek8Q5kJX4wd9Qixyq4tnJHtHqo`
- 线上只读探测：`https://r2-photo-pilot.vercel.app` 返回 HTTP 200，HTML 包含 `R2 Photo Pilot`。

Cloudflare R2：

- [x] 登录或注册
- [x] 开通 R2
- [x] 创建 bucket
- [x] 确认使用 Standard storage
- [x] 开启公开访问
- [x] 记录 public base URL
- [x] 配置 CORS
- [ ] 创建最小权限 R2 API token

R2 记录：

- 2026-07-06：Wrangler OAuth 登录成功，账号 `xiaorongrugu@gmail.com`。
- Account ID：`b8fddf6412daef7afc0be087207c9b41`
- Bucket：`r2-photo-pilot`
- Location：`APAC`
- Storage class：`Standard`
- Public base URL：`https://pub-c2998b4880a44149ac568bcda9f8b3a7.r2.dev`
- CORS origins：`http://localhost:3000`, `https://r2-photo-pilot.vercel.app`
- CORS methods：`GET`, `HEAD`, `PUT`
- CORS headers：`content-type`
- CORS exposed headers：`etag`
- 2026-07-06：R2 signed upload smoke test 通过。
- Test object：`uploads/2026-07-06/d76c54e8-20d9-4634-b63a-98ce4164d962-r2-smoke-test.jpg`
- Test public URL：`https://pub-c2998b4880a44149ac568bcda9f8b3a7.r2.dev/uploads/2026-07-06/d76c54e8-20d9-4634-b63a-98ce4164d962-r2-smoke-test.jpg`
- Test result：Vercel `/api/sign-upload` 返回 signed URL，PUT 上传成功，public URL GET 返回 HTTP 200 / `image/jpeg`。

Supabase：

- [ ] 登录或注册
- [ ] 创建 Free project
- [ ] 执行 `supabase/schema.sql`
- [ ] 确认 `photo_uploads` 表存在
- [ ] 获取 project URL
- [ ] 获取 anon key 或 service role key

Supabase 记录：

- 2026-07-06：本地 `.env.local` 和 `.vercel/.env.local` 均未检测到 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
- 当前线上 `/api/uploads` 返回 `configured: false`，metadata 暂未接入。
- 2026-07-06：Vercel 已配置 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，并重新部署 Production。
- 2026-07-06：线上 metadata smoke test 通过：`GET /api/uploads` 返回 `configured: true`；`POST /api/uploads` 写入 `codex-smoke` 测试记录成功；再次 `GET` 可回读 1 条记录。
- 注意：Vercel 中仍存在一个错拼变量 `SUPABASE_ANON_KE`，代码不会读取它，建议后续删除以避免混淆。

## 6. L2 环境变量

在 Vercel Project Settings 中配置：

| 变量 | 状态 | 说明 |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | 已知：`b8fddf6412daef7afc0be087207c9b41` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | 待填 | R2 API token access key id |
| `R2_SECRET_ACCESS_KEY` | 待填 | R2 API token secret |
| `R2_BUCKET_NAME` | 已知：`r2-photo-pilot` | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | 已知：`https://pub-c2998b4880a44149ac568bcda9f8b3a7.r2.dev` | 公开图片访问 base URL |
| `SUPABASE_URL` | 待填 | Supabase project URL |
| `SUPABASE_ANON_KEY` | 待填 | 可用于 MVP；如果填 service role，则仍建议保留 anon key 备查 |
| `SUPABASE_SERVICE_ROLE_KEY` | 待填 | 服务端写入优先使用；不能暴露给前端 |
| `MAX_UPLOAD_BYTES` | 默认 6291456 | 约 6 MB，可按手机图片大小调整 |

R2 CORS 模板：

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-app.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 7. L3 真实上传验证记录

状态：已通过。通过依据是 R2 signed PUT、R2 public GET、Supabase metadata 写入/回读、28 张小批量连续上传均成功。剩余的真实 3-4MB 手机照片批量测试仍建议补做，但不阻塞进入 L4。

| 轮次 | 日期 | 网络 | 图片数量 | 单图大小 | 成功数 | 失败数 | 平均加载体感 | 失败原因 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 单图试跑 | 待填 | 待填 | 1 | 3-4 MB | 待填 | 待填 | 待填 | 待填 |
| 3-4MB synthetic | 2026-07-06 | 服务器侧 | 1 | 3704828 B | 1 | 0 | 正常 | signed PUT + public GET + Supabase metadata 写入/回读通过 |
| 小批量截图 | 2026-07-06 | 服务器侧 | 28 | PNG，最大 2109508 B，总计 7438629 B | 28 | 0 | 正常 | `C:\Users\xiaor\Pictures\Screenshots` 全量上传通过，metadata 回读 28 条，抽样 R2 public URL 3/3 返回 200 |
| 小批量手机照片 | 待填 | 待填 | 20-30 | 3-4 MB | 待填 | 待填 | 待填 | 待填 |
| 上限试跑 | 待填 | 待填 | 100 | 3-4 MB | 待填 | 待填 | 待填 | 待填 |
| API smoke | 2026-07-06 | 服务器侧 | 1 | 286 B | 1 | 0 | 正常 | R2 signed PUT + public GET + Supabase metadata 写入/回读通过 |

端到端通过标准：

- `/api/sign-upload` 返回 signed URL
- 浏览器 PUT R2 成功
- `/api/uploads` 写入 Supabase 成功
- 展示页出现新图片
- 图片 public URL 可单独打开

## 8. L4 国内访问验证记录

状态：条件通过。三种真实用户网络均可打开，但国内直连访问很慢，需使用梯子才有可接受体验；这说明 L4 的“可访问”成立，“国内访问体验可接受”仍是风险项。

| 网络环境 | 首次打开 | 刷新 | 图片列表 | 单图打开 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Codex 当前网络 | 通过 | 待测 | 通过 | 通过 | 2026-07-06：Vercel 首页 HTTP 200 且包含 `R2 Photo Pilot`；`/api/uploads` 返回 `configured: true`，30 条记录；抽样 R2 图片 HTTP 200 / `image/png` |
| 家庭网 | 可打开 | 待填 | 可打开 | 可打开 | 用户实测：能打开；国内直连整体偏慢，梯子下体验更可接受 |
| 手机流量 | 可打开但很慢 | 待填 | 可打开但很慢 | 可打开但很慢 | 用户实测：国内流量打开很慢，基本需要梯子 |
| 公司网 | 可打开 | 待填 | 可打开 | 可打开 | 用户实测：能打开；仍需补充刷新和加载速度体感 |

问题归因优先级：

1. Vercel `.vercel.app` 国内访问慢或不稳定
2. R2 public image URL 慢或失败
3. R2 CORS 或 signed URL 上传失败
4. Supabase metadata 读写失败
5. 免费层额度或限制不适合

## 9. 用量与账单记录

| 平台 | 指标 | 免费额度参考 | 当前用量 | 是否有账单 | 截图/证据 |
| --- | --- | --- | --- | --- | --- |
| Vercel | Fast Data Transfer | Hobby 含免费额度 | 待填 | 待填 | 待填 |
| Vercel | Function Invocations | Hobby 含免费额度 | 待填 | 待填 | 待填 |
| Cloudflare R2 | Storage | 10 GB-month / month | 待填 | 待填 | 待填 |
| Cloudflare R2 | Class A Operations | 1M / month | 待填 | 待填 | 待填 |
| Cloudflare R2 | Class B Operations | 10M / month | 待填 | 待填 | 待填 |
| Supabase | Database Size | 500 MB per project | 待填 | 待填 | 待填 |

## 10. 域名阶段入口条件

只有满足以下条件后再进入域名阶段：

- [ ] 100 张图片展示页可用
- [x] 至少三种网络环境基本可访问
- [ ] 没有不可接受的 R2/Supabase/Vercel 稳定性问题
- [ ] 免费额度内无实际账单
- [ ] 10 人小规模试用体验可接受

L5 进入结论：

- 2026-07-06：允许进入 L5，但 L5 的目标应定义为“域名与访问路径优化验证”，不是完整产品升级。
- 进入原因：核心链路已通，三类网络均能打开，问题集中在国内直连速度。
- 主要风险：自定义域名和 Cloudflare DNS 不一定能彻底解决 Vercel / R2 在国内直连慢的问题；如果 L5 后仍慢，需要评估更适合国内访问的托管或 CDN 路线。

L5 执行记录：

- 2026-07-06：在 Vercel 项目 `r2-photo-pilot` 添加 `huowu.org` 和 `www.huowu.org`。
- 2026-07-06：Cloudflare DNS 使用橙云代理后，Vercel `domains verify` 对两个域名均返回 `configured_correctly`；Vercel 通过 `http-01` challenge 验证域名。
- 2026-07-06：DNS 当前解析到 Cloudflare 代理 IP，`https://huowu.org` 和 `https://www.huowu.org` 均返回 HTTP 200，响应 header `Server: cloudflare`，页面包含 `R2 Photo Pilot`。
- 2026-07-06：`https://huowu.org/api/uploads` 和 `https://www.huowu.org/api/uploads` 均返回 `configured: true`，可读到 30 条既有 metadata。
- 2026-07-06：R2 CORS 已加入 `https://huowu.org` 和 `https://www.huowu.org`；两个 origin 的 PUT preflight 均返回 HTTP 204，`Access-Control-Allow-Origin` 匹配对应域名。
- 2026-07-06：通过 `https://huowu.org` 做自定义域名端到端上传烟测成功，新增 metadata `eea26264-6964-43b8-880e-8a6e8e000fbe`，线上总记录数变为 31。

L5 待验证：

- [ ] 家庭网直连打开 `https://huowu.org`
- [ ] 手机流量直连打开 `https://huowu.org`
- [ ] 公司网直连打开 `https://huowu.org`
- [ ] 对比 `https://r2-photo-pilot.vercel.app` 与 `https://huowu.org` 的首屏速度、刷新速度、图片列表加载、单图打开速度

域名购买后下一步：

1. 域名接入 Cloudflare DNS
2. Vercel 添加 custom domain
3. Cloudflare DNS 配置 CNAME
4. SSL/TLS 设置为 Full 或 Full strict
5. 对比 `.vercel.app` 与自定义域名访问表现
