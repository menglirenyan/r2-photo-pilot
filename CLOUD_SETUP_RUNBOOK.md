# 云端配置与部署规范

本文档只保留当前可重复执行的部署流程，不记录账号、资源 ID、测试对象、一次性状态或历史故障。

## 1. Supabase

1. 创建 Postgres 项目，区域应与 Vercel Function 区域尽量接近。
2. 在 SQL Editor 完整执行 `supabase/schema.sql`。
3. 将 Project URL 和 service role key 分别保存为 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
4. service role 只能进入 Vercel 服务端环境变量和本地 `.env.local`，不得发送到聊天、提交到 Git 或暴露给浏览器。
5. Schema 变更必须同步更新类型、API、UI 和迁移策略。

## 2. Cloudflare R2

1. 创建 Standard bucket，并为应用创建仅限该 bucket 的对象读写凭据。
2. 配置公开图片域名，将地址保存为 `R2_PUBLIC_BASE_URL`。
3. 按 `r2-cors.example.json` 配置 CORS；允许实际本地域名、Vercel 域名和正式域名执行 `GET`、`HEAD`、`PUT`。
4. 允许上传所需的 `content-type`、`cache-control` 请求头，并暴露 `etag`。
5. 产品图片设置长期 immutable 缓存；替换图片时必须使用新 object key。
6. 将账号 ID、访问密钥、bucket 和公开地址写入对应 R2 环境变量。

## 3. Vercel

1. 从 GitHub 仓库导入项目，Framework 使用 Next.js，Root Directory 使用仓库根目录。
2. 保持构建命令为 `npm run build`，区域以 `vercel.json` 为准。
3. 为 Production、Preview 和 Development 按需配置环境变量；生产环境不得使用默认账号密码或演示回退。
4. 推送目标分支触发部署，等待 Production 部署进入 Ready 后再验证。
5. 绑定正式域名后，同步更新 R2 CORS 和图片域名配置。
6. 为 Production 配置至少 32 字符的随机 `CRON_SECRET`；`vercel.json` 注册三个任务，每天约在北京时间 10:00、18:00 和次日 02:00 调用 `/api/cron/supabase-keepalive/[slot]`，每次执行一条不修改数据的 Supabase 查询。

## 4. 必需环境变量

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
ADMIN_USERNAME
ADMIN_PASSWORD
SESSION_SECRET
CRON_SECRET
```

可选：

```text
MAX_UPLOAD_BYTES=6291456
ALLOW_DEMO_FALLBACK=
```

`ALLOW_DEMO_FALLBACK` 只能用于明确标注的本地临时演示，生产环境必须为空。

## 5. 上线验证

每次涉及配置、数据或部署的改动至少验证：

- `npm run build` 通过。
- `/` 可使用平台账号和企业账号登录到各自后台，错误凭据不泄露企业状态。
- 公开目录和详情只对有效企业开放，未知、停用、过期或数据读取失败统一 404。
- 企业账号不能读取或写入其他企业数据；平台管理员仍可进入企业工作台。
- 浏览器可获取 signed URL、PUT 到 R2，并从公开图片域名读取图片。
- 新增和替换图片后数据库 metadata 与 R2 对象一致，公开缓存已失效。
- 正式域名、Vercel 域名和所需本地域名通过 R2 CORS 预检。
- Production 未启用 `ALLOW_DEMO_FALLBACK`，所有 Secret 均未暴露为 `NEXT_PUBLIC_*`。
- 未携带正确 `CRON_SECRET` 的保活请求返回 401；Vercel Cron 已注册三个每日任务，手动执行记录返回 200。

不要在本文件记录真实密钥、账号密码、OTP、资源 ID、测试对象 URL 或某次部署状态。
