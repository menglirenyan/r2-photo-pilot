# 货物产品册

面向小型企业/工厂的多租户产品图片册与后台代管系统。当前版本沿用 Next.js + Supabase + Cloudflare R2 + Vercel，不单独拆后端。

## 开发基准

后续所有开发、重构和修复都必须先阅读并遵守：

- `DEVELOPMENT_FRAMEWORK.md`：完整开发框架、目录职责、数据流、权限边界、UI/性能规则、回归验证要求。
- `AGENTS.md`：给后续 agent/协作者的最短强制入口。

## 当前功能

- 浏览者访问 `/[companyNumber]/浏览页` 查看对应企业产品册，例如 `/c001/浏览页`。
- 企业必须处于 `active` 且未过期状态，产品才会公开展示。
- 手机端优先：搜索、分类横向筛选、双列产品流，首屏能看到至少 6 个产品。
- 产品详情页路径为 `/[companyNumber]/浏览页/p/[productCode]`。
- 企业管理入口为 `/[companyNumber]`，登录后仍停留在该编号 URL，并进入该企业自己的产品、图片和出货单后台。
- 运营者总后台路径为 `/admin`，只用于管理企业用户、登录账号、开通状态和可用时间。
- 企业编号由后台按顺序生成，例如 `c001`、`c002`；添加用户时由管理员填写企业登录账号和初始密码。
- 后台使用 `ADMIN_USERNAME + ADMIN_PASSWORD + SESSION_SECRET` 生成 HTTP-only session cookie。
- 图片上传继续走 R2 signed URL 直传，后台会先在浏览器端压缩为适合移动端展示的 JPEG。
- 出货单字段为：名称、规格、单价、数量、价格，并自动计算总价。

## 本地运行

```bash
npm install
npm run dev
```

打开：

- 企业管理入口演示：`http://localhost:3000/c001`
- 产品册演示：`http://localhost:3000/c001/浏览页`
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
- 未设置 `ALLOW_DEMO_FALLBACK=true`，除非这是一个明确标注的临时演示环境。

## 付费策略

第一版不在网页展示收款码，不接在线支付。采用邀请制和私下付款，运营者在后台手动添加用户、设置可用到期日、开通或停用公开产品册。后续如果需要自动化收款，再接微信/支付宝商户支付和回调。
