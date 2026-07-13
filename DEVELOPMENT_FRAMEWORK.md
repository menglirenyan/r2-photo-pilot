# 货物产品册开发框架与结构规范

本文档是本项目后续开发的基准。任何新增功能、重构、修 bug、部署调整，都应先确认是否符合这里定义的框架、边界和文件职责。

## 1. 产品定位与当前阶段

本项目是面向小型企业/工厂的多租户产品图片册与后台代管系统。

当前阶段目标：

- 浏览者通过带随机访问标识的企业公开链接访问产品册，例如 `/c/site-<opaque-token>`；顺序企业编号不得出现在外部 URL。
- 企业只有在后台被手动开通、且未过期时，公开页才展示产品。
- 企业用户不自助注册，不在线付款，不下单。
- 企业可从 `/` 输入账号密码，由服务端识别后进入自己的 `/:companySlug` 产品后台；原企业专属管理链接继续兼容。运营者通过同一入口或 `/admin/login` 登录，并在 `/admin` 管理企业用户、登录账号、开通状态和可用时间，也可进入任一企业工作台管理产品图片。
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
- 本地未配置 Supabase 时可以展示演示数据，但写入 API 必须拒绝；一旦已配置 Supabase，公开读取失败必须关闭访问，不能回退到演示租户或演示产品。生产环境默认关闭演示数据回退。
- 所有产品公开读取必须同时满足企业可访问、产品 `active` 两个条件。

## 3. 路由结构

公开路由：

- `/`：统一后台登录入口；未登录时直接显示空账号和密码表单，不展示任何企业编号、名称或 slug。验证成功后仅使用服务端返回的站内目标进入 `/admin` 或对应 `/:companySlug`；已有有效 session 时直接进入相应后台。
- `/[companySlug]`：企业管理入口；`companySlug` 为不可预测的非顺序访问标识。未登录时显示不含 slug 的登录表单，已登录时进入该企业产品列表后台。
- `/[companySlug]/upload`：企业产品上传入口；未登录时显示登录表单，已登录时进入独立上传界面。
- `/c/[companySlug]`：企业公开产品册。
- `/c/[companySlug]/p/[productCode]`：产品详情页。
- 旧路径 `/[companySlug]/浏览页` 与详情路径继续兼容，并重定向到上述正式路径。

后台路由：

- `/admin/login`：运营方总后台登录。
- `/admin`：运营方用户管理后台；不内嵌产品网格，但为每个企业提供进入产品/图片工作台和打开公开产品册的入口。

API 路由：

- `/api/admin/login`：校验平台管理员或企业账号密码，写入 HTTP-only session cookie；统一入口模式下由服务端按账号解析角色和企业，并返回可信的站内后台地址。
- `/api/admin/logout`：清理 session。
- `/api/admin/companies`：仅平台管理员可用，创建/更新/删除用户企业、登录账号、开通状态、可用到期日。
- `/api/admin/categories`：创建企业分类。
- `/api/admin/products`：创建产品并按分类自动生成编号。
- `/api/admin/products/[id]`：更新或删除产品；替换图片时必须成组校验 R2 地址、对象键与尺寸，并再次校验企业归属。
- `/api/admin/shipments`：旧保存型出货单接口；企业当前 UI 不调用，仅为历史兼容保留。
- `/api/admin/quotations/png`：校验后台 session 和企业产品归属，生成包含产品图的临时报价单 PNG，不写数据库。
- `/api/admin/quotations/xlsx`：校验后台 session 和企业产品归属，生成包含产品缩略图的真实 XLSX，不写数据库。
- `/api/sign-upload`：仅后台登录后可调用，生成 R2 PUT signed URL。
- `/api/uploads`：旧原型接口，保留为 410，不再用于新业务。

新增 API 时应遵守：

- 平台用户管理接口必须调用 `requirePlatformAdmin()`。
- 企业分类、产品和上传接口必须调用 `requireAdmin()` 后再用 `requireCompanyAccess()` 限定企业范围。
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

- `company_number` 按创建顺序递增，但只用于数据库内部排序，不返回给游客、不作为 URL、也不在后台界面展示。
- `slug` 使用不可预测的 `site-...` 随机值；旧 `c001`、`c002` 形式通过 `supabase/schema.sql` 幂等迁移后立即失效。
- 产品编号按分类独立递增。
- 格式为 `分类代码-三位序号`，例如 `HW-001`。
- 新产品创建时由 `/api/admin/products` 查询该分类当前最大 `product_number` 后生成。

访问规则：

- 企业 `status = active` 才可公开访问；未知、停用和过期企业对游客统一返回 404。
- `paid_until` 为空表示不限制到期日；有日期时按 `Asia/Shanghai` 判断，到期日当天有效，次日 00:00 起失效。
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
- `page.tsx`：不暴露企业标识的统一登录入口，并把已有有效 session 重定向到对应后台。
- `[companySlug]/page.tsx`：企业产品列表管理入口。
- `[companySlug]/upload/page.tsx`：企业产品上传入口。
- `c/[companySlug]/page.tsx`：公开产品册服务端入口。
- `c/[companySlug]/p/[productCode]/page.tsx`：产品详情服务端入口。
- `[companySlug]/browse/**` 与 `proxy.ts`：仅用于旧中文浏览路径兼容，并重定向到正式路径。
- `admin/page.tsx`：平台后台服务端入口，负责平台管理员鉴权和读取用户列表。
- `admin/login/page.tsx`：后台登录页入口。
- `api/**/route.ts`：服务端 API。

`src/components`：

- `PublicCatalog.tsx`：公开产品册客户端入口，复用产品册搜索、分类筛选、产品卡渲染。
- `SafeImage.tsx`：产品图片兜底，图片失败时显示产品名占位。
- `LoginForm.tsx`：统一入口、平台专用入口和企业专属入口共用的后台登录表单。
- `AdminDashboard.tsx`：平台后台工作台，渲染用户管理及进入各企业产品/图片工作台的入口。
- `CompanyProductListWorkspace.tsx`：企业产品列表工作台，复用公开产品册卡片布局，并承载批量选择、资料与图片修改、删除和报价单入口。
- `CompanyAdminNavigation.tsx`：企业后台共用导航；桌面端固定侧栏，移动端顶部栏与抽屉。
- `QuotationComposer.tsx`：当前产品列表页内的临时报价单编辑、预览、草稿恢复和 PNG/XLSX 下载。
- `ProductCatalogView.tsx`：公开浏览页和企业产品列表共用的产品册搜索、分类、卡片渲染组件。
- `ProductUploadWorkspace.tsx`：企业产品上传工作台，承载分类创建、图片选择、压缩、R2 上传和产品创建。

`src/lib`：

- `supabase.ts`：创建服务端 Supabase client。
- `r2.ts`：R2 配置和 S3 client。
- `client-image-upload.ts`：新增与替换产品图片共用的浏览器压缩、R2 PUT 和进度上报。
- `company-slug.ts`：服务端生成不可预测、非顺序的企业访问标识。
- `runtime-config.ts`：生产/本地运行时门禁、演示回退开关和上线环境变量检查。
- `auth.ts`：后台 session 签名、校验、清理。
- `api.ts`：后台 API 通用鉴权、错误、文本清理工具。
- `data.ts`：公开页和后台页的服务端读模型。
- `format.ts`：价格、日期、slug、企业可访问判断等纯函数。
- `sample-data.ts`：本地演示数据，仅用于未配置 Supabase 的只读展示；生产环境默认不使用。
- `quotation.ts`：报价单请求清理、数值校验和金额计算纯函数。
- `quotation-cache.ts`：报价单浏览器草稿 key、两小时 TTL 和读取校验。
- `quotation-export.tsx`：服务端产品图解析、PNG 与 XLSX 文件生成。

新增文件时应优先放入上述边界内，不要把数据访问、UI 组件、API 校验混在同一个文件里。

## 6. 关键数据流

公开产品册：

1. 用户访问 `/c/[companySlug]`。
2. `src/app/c/[companySlug]/page.tsx` 调用 `getPublicCatalog(slug)`。
3. 页面每次请求先按北京时间检查企业状态和到期日，再读取缓存的分类与 active 产品。
4. 如果企业不存在、未开通或过期，统一走 `notFound()`，metadata 使用通用文案并设置 `noindex,nofollow`，不得暴露企业名称或失效原因。
5. 如果可访问，把必要数据传给 `PublicCatalog` 做搜索和筛选。

产品详情：

1. 用户访问 `/c/[companySlug]/p/[productCode]`。
2. `getProductDetail` 复用公开产品册规则。
3. 找不到产品或企业不可访问时走 `notFound()`。

后台登录：

1. 用户优先访问 `/` 输入账号和密码；平台运营方也可继续访问 `/admin/login`，企业原有 `/:companySlug` 专属登录入口继续兼容。
2. `/api/admin/login` 的统一入口模式先校验完整平台账号；否则按唯一的规范化 `companies.login_username` 定位企业，并校验 `password_hash`。平台专用和企业专属模式保持各自原有范围。
3. 成功后写入带角色的 HTTP-only session cookie；统一入口只接受服务端生成的 `/admin` 或 `/${company.slug}` 站内目标，客户端不能提交返回地址或决定企业 slug。
4. `/admin` 只允许平台管理员进入用户管理；`/[companySlug]` 和 `/[companySlug]/upload` 允许平台管理员或该企业 session 进入企业后台。
5. 账号不存在、密码错误或企业不匹配统一返回相同错误，不通过登录响应暴露企业是否存在。

图片上传：

1. 后台选择产品图。
2. `ProductUploadWorkspace` 或产品编辑器复用 `client-image-upload.ts`，在浏览器端压缩为 WebP，长边最大 960，并显示上传进度。
3. 调用 `/api/sign-upload` 获取 R2 signed URL。
4. 浏览器 PUT 到 R2。
5. 新增产品调用 `/api/admin/products`；替换图片调用 `/api/admin/products/[id]`，服务端严格校验新对象属于该企业后写入 metadata。

临时报价单：

1. 企业后台在 `/:companySlug` 产品列表批量选择产品。
2. 点击“生成报价单”后，在当前产品列表页打开响应式报价单模态层；桌面端为编辑/预览双栏，手机端为全屏行卡片。
3. 名称、产品图、编号、规格、数量、单价和备注写入 `sessionStorage` 临时草稿；空单价保持“待议”，数量可使用非负小数。
4. 数量和单价变化实时更新小计和总计；草稿默认 2 小时过期，过期或清空后自动删除。
5. 报价单不保存到数据库；下载时把产品 ID 和编辑内容提交到 `/api/admin/quotations/png` 或 `/api/admin/quotations/xlsx`。
6. 服务端重新校验 session、企业范围和产品归属，只使用数据库/R2 中的产品图片，最多处理 80 行，随后返回真实 PNG 或 XLSX 文件。

## 7. UI 与交互规则

公开页：

- 手机端优先。
- 默认 390x844 左右视口下，忽略顶部搜索/筛选区域后，首屏至少能看到 6 个产品。
- 产品卡采用双列紧凑布局，固定图片比例，名称最多两行，规格单行省略。
- 有单价显示价格，无单价时价格区域留空。
- 搜索必须匹配产品编号、名称、规格、描述、分类名、分类代码。
- 不出现购物车、下单、支付、收款码入口。

后台页：

- 以运营效率为主，不做营销式页面。
- PC 桌面优先，移动端可用但不是主要操作场景。
- 根路径在桌面和移动端首屏直接展示账号、密码和登录按钮；统一入口的账号初值为空，不要求用户先获得企业管理 slug。
- `/admin` 只展示用户管理，不内嵌产品、图片或报价单；平台管理员通过企业行入口进入企业工作台后，可查看和替换该企业产品图片。
- 企业后台 `/:companySlug` 以产品列表为主，不展示平台用户管理。
- 企业上传页 `/:companySlug/upload` 单独展示分类创建和产品上传表单，桌面端和手机端都应可直接通过按钮或网址进入。
- 企业后台产品列表与公开浏览页共用产品卡片布局；额外的选择、修改、删除、报价单操作只能出现在后台工具栏。
- 产品行和关键按钮保留稳定测试属性，例如 `data-product-code`、`data-testid`。
- 企业后台桌面端使用固定侧栏；移动端使用顶部栏与抽屉，导航保持产品列表、上传产品、生成报价单、查看产品册和退出登录；平台管理员进入时额外显示“返回用户管理”。
- 报价单编辑器和下载预览必须在产品列表页内同步，不新增报价单持久化路由。

设计系统：

- 使用白色/浅灰背景，主色为低饱和绿色系 `#0f766e`。
- 卡片圆角不超过 8px。
- 不使用紫蓝渐变、装饰光球、营销 hero。
- UI 文案保持中文、短句、业务直接。

## 8. 性能与可靠性规则

必须遵守：

- 公开页只查询展示所需字段，不把后台字段全部传给客户端。
- 服务端查询使用 `React.cache()` 去重。
- 公开目录和详情必须动态执行访问门禁，内容查询可以继续使用 300 秒 `unstable_cache`；不能用整页 ISR 跨过自然到期边界。
- 长列表优先限制数量或分页；当前公开产品上限为 80，后台产品列表上限为 200。
- 图片使用 `next/image`，并设置 `sizes`。
- R2 产品图直接由公开图片域名返回，避免额外图片代理；上传对象设置长期不可变缓存。
- 外部图片必须通过 `SafeImage` 或等效兜底处理，不能让访客看到永久空白块。
- 只有本地未配置 Supabase 时才可读取演示数据；Supabase 已配置后的公开查询超时或失败必须 fail closed，不能回退到演示数据。写入 API 不能用演示数据假成功。
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
- 报价单导出 API 必须验证 session、企业 slug 和每个产品 ID 的企业归属；不能接受客户端提供的任意图片 URL。

## 10. 后续修改流程

每次修改前：

1. 先读 `DEVELOPMENT_FRAMEWORK.md`。
2. 确认改动属于公开页、后台、API、数据模型、部署配置中的哪一类。
3. 检查是否需要同步修改 `src/types.ts`、`supabase/schema.sql`、API、UI。
4. 如果改变公开产品展示，必须检查手机端首屏密度。
5. 如果改变后台写入，必须检查 `requireAdmin()` 是否仍然覆盖。
6. 如果改变数据模型，必须写清迁移策略，不能只改 TypeScript。

完成修改后：

1. 将本次需求、实现和验证结果追加到 `DEVELOPMENT_LOG.md`。
2. 运行 `npm run build`。
3. 验证 `/c/demo-catalog`，并确认公开 URL、标题和页面不含顺序企业编号。
4. 验证 `/c/demo-catalog/p/TC-001` 或任意产品详情，以及停用/过期企业目录与详情统一 404。
5. 验证 `/` 的统一登录：平台账号进入 `/admin`，至少两个正式企业账号分别进入各自不透明 slug 后台，错误凭据显示统一错误；同时回归 `/demo-catalog`、`/demo-catalog/upload`、`/admin/login` 和 `/admin`。
6. 在 `/demo-catalog` 批量选择产品并生成报价单，验证编辑、图片替换、待议单价、合计、草稿恢复和 PNG/XLSX 下载。
7. 搜索旧原型残留：`R2 Photo`、`photo_uploads`、乱码文本。

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
- 替换产品图片必须生成新 object key，不能覆盖带 immutable 缓存的旧 URL；数据库更新前再次校验企业对象键前缀与公开图片地址。

## 12. 当前验证基线

最近验证通过的基线：

- `npm run build` 通过。
- 手机 390x844 视口下，`/c/demo-catalog` 默认首屏可见 6 个产品。
- 搜索“陶瓷”返回 2 个产品。
- `/c/demo-catalog/p/TC-001` 产品详情正常展示。
- `/admin/login` 使用本地默认密码 `admin123` 可进入平台用户管理，不显示产品和报价单。
- `/` 直接显示空账号、密码和登录按钮；本地无 Supabase 时，`admin/admin123` 进入 `/admin`，`demo/demo123` 进入 `/demo-catalog`，错误凭据不泄露账号或企业状态。
- `/demo-catalog` 在本地无 Supabase 演示环境下使用 `demo/demo123` 可进入企业产品列表后台。
- `/demo-catalog/upload` 在同一登录态下可进入独立产品上传页。
- 平台管理员可从 `/admin` 进入任一企业产品工作台，查看当前图并选择新图替换；跨企业企业账号仍被 API 拒绝。
- 目录和详情每次请求执行北京时间门禁，未知、停用和过期企业统一 404；Supabase 已配置时公开查询失败不回退演示数据。
- 企业后台选择 `HW-001` 后可打开临时报价单，当前页显示 1 行，合计 `¥3.80`，并可下载 PNG/XLSX。
- 未发现旧 `photo_uploads` 业务引用。

该基线是后续改动的最低回归要求。
