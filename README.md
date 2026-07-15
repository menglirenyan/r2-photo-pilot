# 货物产品册

面向小型企业/工厂的多租户产品图片册与后台代管系统，使用 Next.js、Supabase Postgres、Cloudflare R2 和 Vercel。

## 文档入口

- `DEVELOPMENT_FRAMEWORK.md`：当前有效的架构、权限、数据流和验证规则，是开发基准。
- `DESIGN.md`：当前 UI 与交互规范。
- `CLOUD_SETUP_RUNBOOK.md`：云端配置和部署流程。
- `AGENTS.md`：协作者必须遵守的最短规则。

文档不保存开发流水或已经被替代的实现说明；历史以 Git 为准。

## 路由

- `/`：统一后台登录。
- `/c/[companySlug]`：公开产品册。
- `/c/[companySlug]/p/[productCode]`：公开产品详情。
- `/[companySlug]`：企业产品工作台。
- `/[companySlug]/upload`：企业产品上传。
- `/admin`：平台企业管理。

## 本地运行

```bash
npm install
npm run dev
```

默认地址为 `http://localhost:3000`。未配置 Supabase 时只允许读取演示数据，写入 API 会拒绝；生产环境不得启用演示回退。

## 环境变量

复制 `.env.example` 为 `.env.local`，填写：

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

可选变量为 `MAX_UPLOAD_BYTES` 和仅限本地临时演示的 `ALLOW_DEMO_FALLBACK`。Secret 不得使用 `NEXT_PUBLIC_*` 前缀。

## 数据库与构建

在 Supabase SQL Editor 执行 `supabase/schema.sql`，然后运行：

```bash
npm run build
```

数据形状、权限、路由和上线检查以 `DEVELOPMENT_FRAMEWORK.md` 为准。
