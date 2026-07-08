# 货物产品册开发框架与结构规范

本文档是本项目后续开发的基准。任何新增功能、重构、修 bug、部署调整，都应先确认是否符合这里定义的框架、边界和文件职责。

## 1. 产品定位与当前阶段

本项目是面向小型企业/工厂的多租户产品图片册与后台代管系统。

当前阶段目标：

- 浏览者通过企业公开链接访问产品册，例如 `/c001/浏览页`。
- 企业只有在后台被手动开通、且未过期时，公开页才展示产品。
- 企业用户不自助注册，不在线付款，不下单。
- 企业通过 `/:companySlug` 登录管理自己的产品册；运营者通过 `/admin` 只管理企业用户、登录账号、开通状态和可用时间。
- 第一版采用邀请制与私下付款，后台人工开通，不在网页展示收款码。

明确不做：

- 不做购物车、在线下单、支付回调、订单履约。
- 不在公开页展示收款二维码。
- 不让企业用户自行注册或自行支付开通。
- 不把前后端拆成两个独立服务。

## 2. 技术栈与开发范式

固定技术栈：

- Next.js 16 App Router
- React 19
- TypeScript strict
- Supabase Postgres
- Cloudflare R2
- Vercel / Cloudflare 域名链路
- lucide-react 图标

开发范式：

- 公开浏览页优先使用 Server Components 取数，客户端组件只负责搜索、筛选、图片兜底等必要交互。
- 后台工作台使用小型 Client Component，所有写入通过 `/api/admin/*` API 进行。
- Supabase service role 只允许在服务端使用，不能暴露到 `NEXT_PUBLIC_*`。
- R2 图片上传继续走 signed URL 直传，图片不经过 Vercel 后端转发。
- 本地没有 Supabase 或 Supabase 不可达时，可以展示演示数据，但写入 API 必须拒绝；生产环境默认关闭演示数据回退，除非明确设置 `ALLOW_DEMO_FALLBACK=true` 做临时演示。
- 所有产品公开读取必须同时满足企业可访问、产品 `active` 两个条件。

## 3. 路由结构

公开路由：

- `/`：重定向到 `/c001/浏览页`，仅作为本地演示入口。
- `/[companySlug]`：企业管理入口；未登录时显示登录表单，已登录时进入该企业后台。
- `/[companySlug]/upload`：企业产品上传入口；未登录时显示登录表单，已登录时进入独立上传界面。
- `/[companySlug]/浏览页`：企业公开产品册；由 `proxy.ts` 重写到内部 `/[companySlug]/browse`。
- `/[companySlug]/浏览页/p/[productCode]`：产品详情页；由 `proxy.ts` 重写到内部 `/[companySlug]/browse/p/[productCode]`。

后台路由：

- `/admin/login`：运营方总后台登录。
- `/admin`：运营方用户管理后台，只管理企业用户、登录账号、开通状态和可用时间。

API 路由：

- `/api/admin/login`：校验平台管理员或企业账号密码，写入 HTTP-only session cookie。
- `/api/admin/logout`：清理 session。
- `/api/admin/companies`：仅平台管理员可用，创建/更新/删除用户企业、登录账号、开通状态、可用到期日。
- `/api/admin/categories`：创建企业分类。
- `/api/admin/products`：创建产品并按分类自动生成编号。
- `/api/admin/products/[id]`：更新产品状态或字段。
- `/api/admin/shipments`：保存出货单和明细。
- `/api/sign-upload`：仅后台登录后可调用，生成 R2 PUT signed URL。
- `/api/uploads`：旧原型接口，保留为 410，不再用于新业务。

新增 API 时应遵守：

- 平台用户管理接口必须调用 `requirePlatformAdmin()`。
- 企业分类、产品、出货单和上传接口必须调用 `requireAdmin()` 后再用 `requireCompanyAccess()` 限定企业范围。
- 公开接口不能返回未开通企业或隐藏产品数据。
- 不要在客户端直接访问 Supabase 写入。

## 4. 数据模型

数据库定义以 `supabase/schema.sql` 为准。

核心表：

- `companies`：企业租户。关键字段：`company_number`、`slug`、`login_username`、`password_hash`、`status`、`paid_until`。
- `categories`：企业内产品分类。关键字段：`company_id`、`name`、`code`、`sort_order`。
- `products`：产品。关键字段：`category_id`、`product_number`、`product_code`、`image_url`、`unit_price`、`status`。
- `shipment_sheets`：出货单主表。
- `shipment_sheet_items`：出货单明细。

编号规则：

- 企业编号按创建顺序递增，展示和路由格式为 `c001`、`c002`。
- 产品编号按分类独立递增。
- 格式为 `分类代码-三位序号`，例如 `HW-001`。
- 新产品创建时由 `/api/admin/products` 查询该分类当前最大 `product_number` 后生成。

访问规则：

- 企业 `status = active` 才可访问。
- `paid_until` 为空表示不限制到期日；有日期时必须未过期。
- 产品 `status = active` 才在公开页展示。

RLS 策略：

- 当前第一版通过 Next.js 服务端 service role 访问 Supabase。
- 表启用 RLS，只允许 `service_role` 全量操作。
- 未来如果引入企业自助登录，必须重新设计 RLS，不要在现有策略上临时放宽。

## 5. 文件结构与职责

根目录：

- `README.md`：项目使用说明、环境变量、数据库入口。
- `DEVELOPMENT_FRAMEWORK.md`：开发框架与结构规范，即本文档。
- `AGENTS.md`：给后续 agent/协作者的最短强制入口。
- `.env.example`：环境变量模板。
- `next.config.mjs`：Next.js 配置，包含远程图片域名。
- `supabase/schema.sql`：数据库结构、索引、RLS、演示 seed。

`src/app`：

- `layout.tsx`：全局 HTML 和 metadata。
- `globals.css`：全局设计系统、公开页、后台页、打印样式。
- `page.tsx`：根路径重定向。
- `[companySlug]/page.tsx`：企业管理入口。
- `[companySlug]/upload/page.tsx`：企业产品上传入口。
- `[companySlug]/browse/page.tsx`：公开产品册服务端入口，承接用户访问的 `/[companySlug]/浏览页`。
- `[companySlug]/browse/p/[productCode]/page.tsx`：产品详情服务端入口，承接用户访问的 `/[companySlug]/浏览页/p/[productCode]`。
- `proxy.ts`：把用户可读的中文浏览页路径重写到内部 ASCII 路由。
- `admin/page.tsx`：平台后台服务端入口，负责平台管理员鉴权和读取用户列表。
- `admin/login/page.tsx`：后台登录页入口。
- `api/**/route.ts`：服务端 API。

`src/components`：

- `PublicCatalog.tsx`：公开产品册客户端交互，负责搜索、分类筛选、产品卡渲染。
- `SafeImage.tsx`：产品图片兜底，图片失败时显示产品名占位。
- `LoginForm.tsx`：平台和企业后台登录表单。
- `AdminDashboard.tsx`：后台工作台。`mode="admin"` 只渲染用户管理；`mode="company"` 渲染产品列表和出货单入口，不直接承载上传表单。
- `ProductUploadWorkspace.tsx`：企业产品上传工作台，承载分类创建、图片选择、压缩、R2 上传和产品创建。

`src/lib`：

- `supabase.ts`：创建服务端 Supabase client。
- `r2.ts`：R2 配置和 S3 client。
- `runtime-config.ts`：生产/本地运行时门禁、演示回退开关和上线环境变量检查。
- `auth.ts`：后台 session 签名、校验、清理。
- `api.ts`：后台 API 通用鉴权、错误、文本清理工具。
- `data.ts`：公开页和后台页的服务端读模型。
- `format.ts`：价格、日期、slug、企业可访问判断等纯函数。
- `sample-data.ts`：本地演示数据，仅用于无 Supabase 或查询超时时的只读展示；生产环境默认不使用。

新增文件时应优先放入上述边界内，不要把数据访问、UI 组件、API 校验混在同一个文件里。

## 6. 关键数据流

公开产品册：

1. 用户访问 `/[companySlug]/浏览页`。
2. `proxy.ts` 重写到 `src/app/[companySlug]/browse/page.tsx`。
3. `src/app/[companySlug]/browse/page.tsx` 调用 `getPublicCatalog(slug)`。
4. `getPublicCatalog` 读取企业、分类、active 产品。
5. 如果企业未开通或过期，页面只显示不可访问提示。
6. 如果可访问，把必要数据传给 `PublicCatalog` 做搜索和筛选。

产品详情：

1. 用户访问 `/[companySlug]/浏览页/p/[productCode]`。
2. `getProductDetail` 复用公开产品册规则。
3. 找不到产品或企业不可访问时走 `notFound()`。

后台登录：

1. 企业访问 `/[companySlug]`，或运营方访问 `/admin/login`，输入账号和密码。
2. `/api/admin/login` 对平台管理员校验 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`；对企业登录校验 `companies.login_username` 和 `companies.password_hash`。
3. 成功后写入带角色的 HTTP-only session cookie。
4. `/admin` 只允许平台管理员进入用户管理；`/[companySlug]` 和 `/[companySlug]/upload` 允许平台管理员或该企业 session 进入企业后台。

图片上传：

1. 后台选择产品图。
2. `ProductUploadWorkspace` 在浏览器端压缩为 JPEG，长边最大 1600。
3. 调用 `/api/sign-upload` 获取 R2 signed URL。
4. 浏览器 PUT 到 R2。
5. 调用 `/api/admin/products` 写入产品 metadata。

出货单：

1. 后台从产品列表点击“加入出货单”。
2. 行项目带入名称、规格、单价；无单价时可手填。
3. 数量和单价变化实时更新行价格和总价。
4. `/api/admin/shipments` 保存主表和明细。
5. 打印视图由 `.print-sheet` 和 `@media print` 控制。

## 7. UI 与交互规则

公开页：

- 手机端优先。
- 默认 390x844 左右视口下，忽略顶部搜索/筛选区域后，首屏至少能看到 6 个产品。
- 产品卡采用双列紧凑布局，固定图片比例，名称最多两行，规格单行省略。
- 有单价显示价格，无单价显示“询价”。
- 搜索必须匹配产品编号、名称、规格、描述、分类名、分类代码。
- 不出现购物车、下单、支付、收款码入口。

后台页：

- 以运营效率为主，不做营销式页面。
- PC 桌面优先，移动端可用但不是主要操作场景。
- `/admin` 只展示用户管理，不展示产品、图片、出货单。
- 企业后台 `/:companySlug` 展示产品列表和出货单，不展示平台用户管理。
- 企业上传页 `/:companySlug/upload` 单独展示分类创建和产品上传表单，桌面端和手机端都应可直接通过按钮或网址进入。
- 后台保留表格/列表密度，不改成大图卡片墙。
- 产品行和关键按钮保留稳定测试属性，例如 `data-product-code`、`data-testid`。
- 出货单编辑器和打印预览必须同步。

设计系统：

- 使用白色/浅灰背景，主色为低饱和绿色系 `#0f766e`。
- 卡片圆角不超过 8px。
- 不使用紫蓝渐变、装饰光球、营销 hero。
- UI 文案保持中文、短句、业务直接。

## 8. 性能与可靠性规则

必须遵守：

- 公开页只查询展示所需字段，不把后台字段全部传给客户端。
- 服务端查询使用 `React.cache()` 去重。
- 长列表优先限制数量或分页；当前公开产品上限为 80，后台产品列表上限为 200。
- 图片使用 `next/image`，并设置 `sizes`。
- 外部图片必须通过 `SafeImage` 或等效兜底处理，不能让访客看到永久空白块。
- Supabase 查询在本地可超时回退到演示数据，但写入 API 不能用演示数据假成功；生产环境默认不回退到演示数据。
- 后台重交互状态应使用本地 state，避免每个输入都请求服务端。

谨慎修改：

- `src/lib/data.ts` 的查询超时与演示回退逻辑。
- `src/lib/auth.ts` 的 session 签名和 cookie 设置。
- `src/app/api/sign-upload/route.ts` 的登录校验、文件类型、R2 object key 规则。
- `supabase/schema.sql` 的唯一约束和 RLS 策略。

## 9. 环境变量与安全边界

必需环境变量：

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

安全规则：

- 不把 secret 命名为 `NEXT_PUBLIC_*`。
- 不在前端组件中读取 secret。
- 不在日志、README、截图中暴露真实 secret。
- 未配置后台账号密码时，本地默认账号是 `admin`、密码是 `admin123`；生产环境不接受默认账号密码，必须设置强账号和强密码。
- 生产环境必须设置 `SESSION_SECRET`，否则不会签发后台 session。
- `ALLOW_DEMO_FALLBACK=true` 只能用于明确标注的临时演示环境，正式生产不要设置。
- 后台上传 API 必须先验证 session。

## 10. 后续修改流程

每次修改前：

1. 先读 `DEVELOPMENT_FRAMEWORK.md`。
2. 确认改动属于公开页、后台、API、数据模型、部署配置中的哪一类。
3. 检查是否需要同步修改 `src/types.ts`、`supabase/schema.sql`、API、UI。
4. 如果改变公开产品展示，必须检查手机端首屏密度。
5. 如果改变后台写入，必须检查 `requireAdmin()` 是否仍然覆盖。
6. 如果改变数据模型，必须写清迁移策略，不能只改 TypeScript。

完成修改后：

1. 运行 `npm run build`。
2. 验证 `/c001/浏览页`。
3. 验证 `/c001/浏览页/p/TC-001` 或任意产品详情。
4. 验证 `/c001`、`/c001/upload`、`/admin/login` 和 `/admin`。
5. 对后台出货单至少点击一次“加入出货单”，确认合计变化。
6. 搜索旧原型残留：`R2 Photo`、`photo_uploads`、乱码文本。

## 11. 常见改动指南

新增产品字段：

- 先改 `supabase/schema.sql`。
- 再改 `src/types.ts`。
- 再改 `/api/admin/products` 写入逻辑。
- 再改后台表单和公开页展示。
- 如果字段公开展示，检查移动端卡片高度是否仍能一屏 6 个产品。

新增企业权限能力：

- 不要直接在客户端接 Supabase Auth。
- 先重新设计 `companies` 与用户关系表。
- 再设计 RLS。
- 再替换当前后台代管 session 逻辑。

接入正式在线支付：

- 新增订单/付款表，不复用 `shipment_sheets`。
- 使用微信/支付宝商户支付或合规第三方支付。
- 必须实现服务端回调验签、幂等、对账状态。
- 不把个人静态收款码作为线上产品能力。

替换图片存储或 CDN：

- 保持 `image_url` 和 `object_key` 字段语义。
- 更新 `src/lib/r2.ts` 或新增存储适配层。
- 更新 `next.config.mjs` 的图片 remotePatterns。
- 保持 `/api/sign-upload` 的后台登录要求。

## 12. 当前验证基线

最近验证通过的基线：

- `npm run build` 通过。
- 手机 390x844 视口下，`/c001/浏览页` 默认首屏可见 6 个产品。
- 搜索“陶瓷”返回 2 个产品。
- `/c001/浏览页/p/TC-001` 产品详情正常展示。
- `/admin/login` 使用本地默认密码 `admin123` 可进入平台用户管理，不显示产品和出货单。
- `/c001` 在本地无 Supabase 演示环境下使用 `demo/demo123` 可进入企业后台。
- `/c001/upload` 在同一登录态下可进入独立产品上传页。
- 企业后台点击 `HW-001` 的“加入出货单”后生成 1 行，合计 `¥3.80`。
- 未发现旧 `photo_uploads` 业务引用。

该基线是后续改动的最低回归要求。
