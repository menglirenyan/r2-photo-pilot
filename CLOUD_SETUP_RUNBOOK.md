# 云端配置 Runbook

这个文件用于在 Browser 自动化不稳定时手动完成 L1/L2。目标是把当前项目部署到 Vercel，并接入 Cloudflare R2 与 Supabase。

## 0. 当前自动化状态

- 本地项目已就绪：`C:\Users\xiaor\Documents\厂子网页`
- 本地 build 已通过。
- Browser 插件可验证本地页面，但打开 Supabase / Cloudflare / Vercel dashboard 时会超时。
- Computer Use 当前不可用，报 `@oai/sky` package exports 错误。
- 当前仓库没有 Git remote，本机也没有 `vercel`、`wrangler`、`supabase` CLI。

因此云端资源创建先按本 runbook 手动执行。执行完成后再回到 Codex 做环境变量校验、部署验证和真实上传测试。

## 1. Supabase

入口：<https://supabase.com/dashboard>

建议项目名：

```text
r2-photo-pilot
```

执行步骤：

1. 进入 Supabase Dashboard。
2. 点击 `New project`。
3. Organization 选默认组织。
4. Project name 填 `r2-photo-pilot`。
5. Region 选离国内访问相对稳定的区域。若不确定，先用默认推荐区域。
6. Database password 由你保存，不要发给 Codex。
7. 点击创建项目。
8. 项目创建完成后，进入 SQL Editor。
9. 打开本仓库的 `supabase/schema.sql`，复制完整 SQL。
10. 在 SQL Editor 粘贴并执行。
11. 进入 Project Settings -> API，记录：
    - Project URL -> `SUPABASE_URL`
    - anon public key -> `SUPABASE_ANON_KEY`
    - service_role key -> `SUPABASE_SERVICE_ROLE_KEY`

密钥处理：

- 不要把 `service_role` key 发到聊天。
- 可以直接填入本地 `.env.local` 和 Vercel 环境变量。

## 2. Cloudflare R2

入口：<https://dash.cloudflare.com/>

建议 bucket 名：

```text
r2-photo-pilot
```

当前自动化结果：

- Account ID：`b8fddf6412daef7afc0be087207c9b41`
- Bucket：`r2-photo-pilot`
- Location：`APAC`
- Storage class：`Standard`
- Public base URL：`https://pub-c2998b4880a44149ac568bcda9f8b3a7.r2.dev`
- CORS 已配置：`http://localhost:3000`、`https://r2-photo-pilot.vercel.app`

剩余步骤：

- 创建 R2 API token / S3 access key
- 将 key 填入本地 `.env.local` 和 Vercel 环境变量

原始手动执行步骤：

1. 进入 Cloudflare Dashboard。
2. 左侧进入 `R2 Object Storage`。
3. 如果提示开通 R2，按免费/按量入口开通。
4. 点击 `Create bucket`。
5. Bucket name 填 `r2-photo-pilot`。
6. Storage class 选择 `Standard`。
7. 创建 bucket。
8. 在 bucket 设置里开启 public access，记录 public base URL：
   - 例如 `https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev`
   - 对应 `R2_PUBLIC_BASE_URL`
9. 配置 CORS，使用 `r2-cors.example.json`。
   - 上传请求需要允许 `content-type` 和 `cache-control` 两个请求头。
   - 建议给公开桶绑定独立图片域名，并把该地址填入 `R2_PUBLIC_BASE_URL`，减少公开 `r2.dev` 域名在国内网络下的波动。
10. 创建 R2 API token 或 S3 API token，权限限定到当前 bucket 的对象读写。
11. 记录：
    - Cloudflare Account ID -> `R2_ACCOUNT_ID`
    - Access Key ID -> `R2_ACCESS_KEY_ID`
    - Secret Access Key -> `R2_SECRET_ACCESS_KEY`
    - Bucket name -> `R2_BUCKET_NAME`

密钥处理：

- 不要把 secret key 发到聊天。
- 直接填入 `.env.local` 和 Vercel 环境变量。

## 3. Vercel

入口：<https://vercel.com/dashboard>

当前仓库没有 remote，所以有两种路线：

### 路线 A：先推到 GitHub，再用 Vercel 导入

适合后续持续部署。

1. 在 GitHub 创建一个新仓库，建议名：

```text
r2-photo-pilot
```

2. 在本地添加 remote 并推送当前项目。
3. 在 Vercel Dashboard 点击 `Add New...` -> `Project`。
4. 选择 GitHub 仓库 `r2-photo-pilot`。
5. Framework 应识别为 Next.js。
6. Root Directory 用仓库根目录。
7. Build command 默认 `npm run build`。
8. 添加环境变量。
9. 点击 Deploy。
10. 记录 `.vercel.app` 地址。

### 路线 B：用 Vercel CLI 直接部署本地目录

适合快速试水，但需要本机安装/运行 Vercel CLI 并登录。

后续可由 Codex 执行：

```bash
npx vercel@latest
```

关键提示：

- Project name 选 `r2-photo-pilot`
- Framework 选 Next.js
- Build command 保持默认
- 环境变量仍需在 Vercel Project Settings 中配置

## 4. Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 填：

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MAX_UPLOAD_BYTES=6291456
```

不要使用 `NEXT_PUBLIC_` 前缀保存密钥。

## 5. Vercel 地址回填后要做

拿到真实 `.vercel.app` 地址后：

1. 回 Cloudflare R2 CORS，把 `https://your-app.vercel.app` 替换为真实地址。
2. 重新部署或刷新 Vercel 项目。
3. 打开 Vercel 地址。
4. 用 1 张 3-4 MB 手机图做端到端测试。
5. 若上传失败，优先检查：
   - R2 CORS origin 是否包含真实 Vercel 地址
   - `R2_PUBLIC_BASE_URL` 是否可公开访问
   - Vercel 环境变量是否部署到 Production
   - Supabase schema 是否已执行

## 6. 回填给 Codex 的非敏感信息

完成资源创建后，把这些信息发给 Codex：

```text
Vercel URL:
R2 bucket name:
R2 public base URL:
Supabase project URL:
是否已在 Vercel 填好所有环境变量: 是/否
是否已配置 R2 CORS 真实 Vercel origin: 是/否
```

不要发：

- R2 secret access key
- Supabase service role key
- 数据库密码
- 账号密码
- OTP / 验证码
