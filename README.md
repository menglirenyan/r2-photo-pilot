# 货物产品册

面向小型企业/工厂的多租户产品图片册与后台代管系统。当前版本沿用 Next.js + Supabase + Cloudflare R2 + Vercel，不单独拆后端。

## 开发基准

后续所有开发、重构和修复都必须先阅读并遵守：

- `DEVELOPMENT_FRAMEWORK.md`：完整开发框架、目录职责、数据流、权限边界、UI/性能规则、回归验证要求。
- `AGENTS.md`：给后续 agent/协作者的最短强制入口。

## 当前功能

- 浏览者访问 `/c/[companySlug]` 查看对应企业产品册；`companySlug` 是随机访问标识，不再包含顺序厂号。
- 企业必须处于 `active` 且按北京时间未过期，产品才会公开展示；不存在、停用或过期统一返回 404。
- 手机端优先：搜索、分类横向筛选、双列产品流，首屏能看到至少 6 个产品。
- 产品详情页路径为 `/c/[companySlug]/p/[productCode]`。
- 企业管理入口为 `/[companySlug]`，产品上传入口为 `/[companySlug]/upload`；页面标题和登录文案不展示访问标识。
- 报价单在企业产品列表内生成：批量选择产品后点击“生成报价单”，不单独开业务路由。
- 运营者总后台路径为 `/admin`，用于管理企业用户、登录账号、开通状态和可用时间，并可直接进入任一企业工作台查看或替换产品图片。
- 顺序企业编号只保留为数据库内部排序字段；新企业使用不可预测的 `site-...` 访问标识，后台和游客界面均不展示内部编号或访问标识。
- 后台使用 `ADMIN_USERNAME + ADMIN_PASSWORD + SESSION_SECRET` 生成 HTTP-only session cookie。
- 图片新增和替换继续走 R2 signed URL 直传，后台会先在浏览器端压缩为最长边 960px 的 WebP，并显示上传进度。
- 产品图片直接从 `R2_PUBLIC_BASE_URL` 加载并使用长期缓存；国内用户应优先给该地址绑定自有图片域名，避免使用演示用外部图库。
- 公开产品册和详情每次请求先执行企业状态与北京时间到期门禁，企业和产品内容继续使用 300 秒租户级数据缓存；后台写入成功后立即失效对应缓存。
- 正式图片域名使用 `https://img.huowu.org`，`r2.dev` 仅作为迁移回滚兼容地址。
- 报价单字段为：产品图、编号、名称、规格、单价、数量、小计和备注，并自动计算总价；草稿只存浏览器两小时，可下载真实 PNG 或 XLSX，不写入数据库。

## 本地运行

```bash
npm install
npm run dev
```

打开：

- 企业管理入口演示：`http://localhost:3000/demo-catalog`
- 产品册演示：`http://localhost:3000/c/demo-catalog`
- 运营者总后台：`http://localhost:3000/admin`

如果没有配置 Supabase，本地开发会显示演示数据；写入类操作会被 API 拒绝。生产环境默认关闭演示数据回退，避免把未接入 Supabase 的站点误认为真实可用站点。

未配置后台账号密码时，本地平台管理员默认账号是 `admin`、密码是 `admin123`；本地演示企业账号是 `demo`、密码是 `demo123`。生产环境不会接受默认账号密码，必须配置强账号、强密码和 `SESSION_SECRET` 后后台才能登录。

## 环境变量

必需：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

可选：

- `MAX_UPLOAD_BYTES`，默认 `6291456`
- `ALLOW_DEMO_FALLBACK=true`，仅用于临时演示；生产环境默认不要设置

不要把 R2 secret、Supabase service role、`ADMIN_USERNAME`、`ADMIN_PASSWORD` 或 `SESSION_SECRET` 命名为 `NEXT_PUBLIC_*`。

## 数据库

在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
```

Schema 会把旧的 `c001`、`c002` 形式一次性迁移为随机访问标识。迁移后旧链接和旧企业登录会话立即失效，应从平台后台重新打开并分发新的企业管理链接与公开产品册链接。

核心表：

- `companies`
- `categories`
- `products`
- `shipment_sheets`
- `shipment_sheet_items`

公开读取由 Next.js 服务端使用 service role 查询并按企业状态过滤；后台写入接口也必须通过后台 session。

上线前检查：

- 已执行 `supabase/schema.sql`。
- Vercel 已配置 Supabase、R2、`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET`。
- Vercel Function 区域与东京 Supabase 对齐为 `hnd1`，配置以根目录 `vercel.json` 为准。
- R2 自定义域名、CORS、长期缓存头和 Cloudflare Cache Rule 已验证。
- 未设置 `ALLOW_DEMO_FALLBACK=true`，除非这是一个明确标注的临时演示环境。

## 付费策略

第一版不在网页展示收款码，不接在线支付。采用邀请制和私下付款，运营者在后台手动添加用户、设置可用到期日、开通或停用公开产品册。后续如果需要自动化收款，再接微信/支付宝商户支付和回调。
