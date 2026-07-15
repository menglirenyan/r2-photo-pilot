# 货物产品册开发框架

本文档只描述当前有效的架构、边界和开发规则。已经完成、被替代或废弃的实现不在文档中保留过程记录；需要追溯时以 Git 历史为准。

## 1. 产品边界

本项目是面向小型企业/工厂的多租户产品图片册与后台代管系统。

- 游客通过企业公开链接浏览产品册和产品详情。
- 企业账号维护本企业产品、图片、公开电话和临时报价单。
- 平台管理员管理企业账号、状态、到期日，并可进入任一企业工作台代管产品图片。
- 企业由平台邀请和人工开通，不提供自助注册。
- 不提供购物车、在线下单、订单履约、在线支付或公开收款码。
- 不把前后端拆成两个独立服务。

## 2. 固定技术架构

- Next.js 16 App Router、React 19、TypeScript strict。
- Supabase Postgres 保存业务数据，Cloudflare R2 保存产品图片。
- Vercel 承载应用，Cloudflare 提供域名与图片访问链路。
- Supabase service role 只能在服务端使用。
- 图片通过后台鉴权后获取 R2 signed URL，由浏览器直传 R2，不经 Vercel 转发。
- 公开页优先使用 Server Components 取数；客户端组件只承担搜索、筛选、图片兜底和必要交互。
- 所有业务写入必须经过受后台 session 保护的服务端 API。

未经用户明确批准，不得替换上述技术栈或安全模型。

## 3. 路由与权限边界

| 路由 | 用途 | 访问规则 |
| --- | --- | --- |
| `/` | 统一账号密码登录 | 服务端识别平台或企业账号并返回站内目标 |
| `/c/[companySlug]` | 公开产品册 | 企业有效且未过期，产品为 `active` |
| `/c/[companySlug]/p/[productCode]` | 公开产品详情 | 与公开产品册使用相同门禁 |
| `/[companySlug]` | 企业产品工作台 | 平台管理员或对应企业 session |
| `/[companySlug]/upload` | 企业产品上传 | 平台管理员或对应企业 session |
| `/admin/login` | 平台专用登录入口 | 平台管理员账号 |
| `/admin` | 企业账号管理 | 仅平台管理员 |

API 规则：

- `/api/admin/login` 和 `/api/admin/logout` 负责 session 生命周期。
- `/api/admin/companies` 仅允许 `requirePlatformAdmin()`。
- `/api/admin/company-contact`、`categories`、`products`、`products/[id]` 和报价单导出必须先调用 `requireAdmin()`，再按需调用 `requireCompanyAccess()` 校验租户范围。
- `/api/sign-upload` 必须验证后台 session，并限制文件类型、大小、R2 地址和企业对象键前缀。
- 客户端不得直接写 Supabase，也不得决定登录后的企业 slug 或提交任意跳转地址。

废弃边界：

- `/[companySlug]/browse/**` 只用于旧链接重定向，不承载新业务。
- `/api/uploads` 固定返回 410，不得恢复或新增调用。
- `/api/admin/shipments` 不属于当前产品流程，不得被新 UI 调用。

## 4. 数据与租户规则

数据库结构以 `supabase/schema.sql` 为准，TypeScript 类型以 `src/types.ts` 为准。

- `companies`：企业、登录凭据、状态、到期日、内部联系人/备注、公开电话。
- `categories`：企业内分类、分类代码和排序。
- `products`：企业产品、分类内序号、产品编号、图片、价格和状态。
- `shipment_sheets`、`shipment_sheet_items`：保留数据表，不扩展为当前报价单或订单系统。

强制规则：

- `company_number` 只用于数据库内部排序，不得出现在 URL、页面、下载文件名或公开响应中。
- 企业 URL 使用不可预测、非顺序的 `site-...` slug；slug 不是用户可见编号。
- 产品编号按分类独立递增，格式为 `分类代码-三位序号`，例如 `HW-001`。
- `public_contact_phone` 是游客可见字段；`contact_name` 和 `contact_note` 仅供平台内部使用，三者不得联动或混传。
- 企业仅在 `status = active` 且按 `Asia/Shanghai` 未过期时可公开访问；未知、停用、过期和读取失败统一 fail closed，不暴露原因。
- 只有 `active` 产品可公开展示。
- 已配置 Supabase 后，读取失败不得回退演示数据；本地未配置 Supabase 时才允许只读演示数据，写入仍必须拒绝。
- 表保持 RLS，当前由 Next.js 服务端使用 service role 访问；引入新的用户模型前必须重新设计 RLS。

数据形状变化必须同步更新：

1. `supabase/schema.sql` 与迁移策略。
2. `src/types.ts`。
3. 服务端读写与 API 校验。
4. 后台表单和公开 UI。
5. 缓存失效与回归验证。

## 5. 文件职责

- `src/app/**/page.tsx`：路由入口、服务端鉴权和数据装配。
- `src/app/api/**/route.ts`：服务端 API、输入校验、权限与租户范围校验。
- `src/components/PublicCatalog.tsx`、`ProductCatalogView.tsx`：公开目录与共享产品卡片。
- `src/components/AdminDashboard.tsx`：平台企业管理。
- `src/components/CompanyProductListWorkspace.tsx`：企业产品维护、公开电话、图片替换和报价单入口。
- `src/components/ProductUploadWorkspace.tsx`：分类创建、图片压缩上传和产品创建。
- `src/components/QuotationComposer.tsx`：产品列表页内的临时报价单。
- `src/lib/data.ts`：服务端读模型和公开访问门禁。
- `src/lib/auth.ts`、`src/lib/api.ts`：session、鉴权和通用 API 规则。
- `src/lib/client-image-upload.ts`、`src/lib/r2.ts`：浏览器图片处理和 R2 服务端配置。
- `src/lib/public-cache.ts`：公开数据缓存与失效。
- `src/lib/quotation*.ts*`：报价单校验、草稿和导出。

不要在同一文件混合数据访问、API 权限和复杂 UI。新增能力应放入对应边界，不得复制已有鉴权、上传、缓存或金额计算逻辑。

## 6. 核心数据流

公开读取：

1. 页面按 slug 查询企业门禁信息。
2. 每次请求动态判断企业状态和北京时间到期日。
3. 通过门禁后读取租户级缓存的分类和有效产品。
4. 不可访问时统一 `notFound()`，metadata 使用通用文案并设置 `noindex,nofollow`。
5. 客户端只接收展示必需字段，不接收平台内部字段。

后台写入：

1. API 验证 HTTP-only session。
2. 按角色校验平台权限或企业范围。
3. 清理并校验输入后写入 Supabase/R2。
4. 写入成功后失效对应企业的公开缓存。

图片上传：

1. 浏览器将图片压缩为最长边 960px 的 WebP。
2. 后台获取限定企业前缀的 signed URL。
3. 浏览器 PUT 到 R2，并显示上传进度。
4. 产品 API 校验 URL、对象键、尺寸和企业归属后保存 metadata。
5. 替换图片必须生成新 object key，不能覆盖使用 immutable 缓存的旧 URL。

报价单：

- 在企业产品列表页内编辑，不新增持久化路由。
- 草稿只存 `sessionStorage`，默认两小时过期，不写数据库。
- PNG/XLSX 导出由服务端重新校验 session、企业和产品归属，图片只取数据库/R2 的可信地址。

## 7. UI 与设计约束

- UI 使用简体中文、短句和业务化表达，遵守 `DESIGN.md`。
- 公开产品册移动端优先；390×844 默认视口保持双列，并至少可见 6 个产品。
- 分类栏常驻单行横向滑动，不折叠、不换行。
- 产品卡顺序为名称、产品编号、规格、可选价格；无价格时不显示替代文案。
- 公开电话非空时才显示“联系方式”，号码默认收起。
- 企业后台桌面端使用固定侧栏，移动端使用顶部栏和抽屉。
- 平台企业管理使用紧凑列表、搜索/筛选/分页以及新增、编辑弹层。
- 不使用购物电商控件、营销 Hero、紫蓝渐变、装饰光球或超过 8px 的圆角。
- 关键交互保留稳定的 `data-testid` 或等效测试属性。

## 8. 性能与可靠性

- 公开查询只选择展示字段；服务端请求内使用 `React.cache()` 去重。
- 企业门禁必须动态执行；内容可使用 300 秒租户级缓存，不得用整页 ISR 跨过到期边界。
- 公开产品上限为 80，后台列表上限为 200；更长列表必须分页。
- 图片使用 `next/image`、正确的 `sizes` 和失败兜底；R2 图片由公开图片域名直接返回。
- 后台重交互状态保存在客户端，避免每次输入都请求服务端。
- 谨慎修改 `data.ts` 的 fail-closed 逻辑、`auth.ts` 的 session、上传对象键规则和数据库 RLS。

## 9. 环境与安全

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

`MAX_UPLOAD_BYTES` 和 `ALLOW_DEMO_FALLBACK` 为可选项。生产环境不得使用默认后台凭据，不得启用演示回退。Secret 不得使用 `NEXT_PUBLIC_*` 前缀，也不得写入文档、日志或截图。

## 10. 修改与验证规则

修改前：

1. 阅读本文档并确认改动所属边界。
2. 检查数据形状、权限、缓存和 UI 是否需要同步变化。
3. 若要改变技术栈、路由、产品范围或安全模型，先取得用户明确批准并同步更新本文档。

修改后：

1. 代码改动必须运行 `npm run build`。
2. 按改动范围验证公开目录、详情、统一登录、企业范围、上传、报价单和 404 门禁。
3. 公开 UI 改动必须回归 390×844 首屏密度和真实交互。
4. 安全改动必须包含未授权、跨企业和失败关闭测试。
5. 文档只维护当前有效规则：直接替换旧描述，不追加开发流水、完成清单或临时状态。
6. Git 提交说明改动目的；历史需求、实现过程和验证结果由 Git 历史承担。
