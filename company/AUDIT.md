# 官方代码审计报告

> 对应领导文档第十章 Phase 0 交付物「官方架构审计报告」。
> **2026-11-10 晚更新**：审计完成后，仓库已按领导要求重排为真正的 Fork（官方代码在根目录，公司内容在 `company/`，分支 main / develop）。本文第二、四节与第十一节描述的「代码在 `backend/` 子目录」「不是 Fork」已过时，最新结构见 `company/README.md` 与 `company/UPGRADE.md`。审计结论（技术栈、路由 379 条、38 张表、权限体系、许可证）不受影响。

> 配套材料：`docs/API-INVENTORY.md`（接口清单）、`docs/DATABASE.md`（数据库结构）、`ARCHITECTURE.md`（我们的系统）、`UPGRADE.md`（同步机制）、`VERSION.md`（版本记录）。

## 一、审计范围与方法

| 项目 | 内容 |
| --- | --- |
| 审计对象 | New API 官方 `v1.0.0-rc.49`，commit `48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0` |
| 代码位置 | `backend/`（官方整棵树，目录布局与官方仓库一致，外层多一层 `backend/`） |
| 审计时间 | 2026-11-09 至 2026-11-10 |
| 方法 | 读源码 + 实测：静态导出路由、连库导出表结构、查权限中间件与角色常量、构建并运行镜像、用现版本重跑升级脚本 |
| 不算数的做法 | 只读 README、只凭官网宣传页判断能力 |

结论先行：**官方代码审计的 10 项工作，8 项达成、1 项部分、1 项形式不符**（详见第二节）。形式不符的是「Fork」，目的（跟随官方升级）已通过双远程实现；部分的是第三方依赖传递审计。

## 二、10 项工作逐条结论

| # | 领导文档要求 | 结论 | 证据 |
| ---: | --- | --- | --- |
| 1 | Fork 官方仓库 | ❌ 形式不符 | `git merge-base HEAD upstream/main` 为空，首个提交只含 `writing-block.md`；与官方无共同祖先，不是从官方分出来的副本。双远程已接，能拉官方 tag。补齐方式见第十一节 |
| 2 | 锁定当前稳定 Release | ✅ | `company/UPSTREAM.md`、`VERSION.md`、`UPGRADE.md` 三处一致记 `v1.0.0-rc.49` + `48a6c87` + 发布日期 |
| 3 | 核实技术栈 | ✅ | 本文第三节，与官方 `AGENTS.md`、`go.mod`、`web/package.json` 对得上 |
| 4 | 核实前后端目录 | ✅ | 本文第四节；已修正架构文档里「`company/portal/packages/ui`」这个实际不存在的条目 |
| 5 | 核实官方 API 路由 | ✅ | 实测 **379 条**，见 `docs/API-INVENTORY.md`；口径：一条注册算一条，循环注册的 44 条与内联 2 条已计入，注释不计 |
| 6 | 核实数据库结构和迁移机制 | ✅ | 实测 **38 张表、472 个字段、0 条外键**，迁移靠启动时 `AutoMigrate`，见 `docs/DATABASE.md` |
| 7 | 核实管理员权限体系 | ✅ | 本文第七节：三级角色 + 路由层 `AdminAuth`/`RootAuth` + Casbin 细粒度权限 |
| 8 | 核实官方前端主题配置能力 | ✅ | 本文第八节：后台可配 vs 必须改代码重做镜像，边界清楚 |
| 9 | 检查许可证及第三方依赖许可 | 🟡 部分 | 主许可证 AGPL-3.0 已核；第三方直接依赖清单官方自带；**传递依赖尚未审计**，官方自己也写明要在对外发布前做 |
| 10 | 建立官方同步机制 | ✅ | 一条命令升级 + 自动重放补丁 + 现版本演练零差异 + 两条失败路径实测，见 `UPGRADE.md` |

## 三、技术栈

| 层 | 官方选型 | 依据 |
| --- | --- | --- |
| 后端 | Go 1.26、Gin、GORM v2 | `backend/go.mod`、`AGENTS.md` |
| 管理前端 | React 19、Rsbuild 2、TanStack Router/Query/Table、Zustand、Base UI、Tailwind CSS 4、Bun | `web/package.json`、`web/AGENTS.md` |
| 主数据库 | SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 三选一（本项目用 PostgreSQL 15） | `AGENTS.md`、`company/docker-compose.company.yml` |
| 日志库 | 可独立配库，支持 ClickHouse | `AGENTS.md`、`model/main.go` 的 `LOG_DB` 分支 |
| 缓存 | Redis（go-redis）+ 进程内缓存 | `AGENTS.md`、`common/redis.go` |
| 鉴权 | 浏览器会话、JWT、Personal Access Token、WebAuthn/Passkey、TOTP、OAuth/OIDC、Casbin 授权 | `AGENTS.md`、`router/api-router.go`、`service/authz/` |
| 扩展机制 | JavaScript 任务插件（moejs 执行）、Electron 桌面壳 | `plugins/tasks/`、`electron/` |
| 部署 | Docker / Docker Compose，前端产物 embed 进二进制 | `Dockerfile`、`docker-compose.yml` |
| 国际化 | 后端 go-i18n（en / zh-CN / zh-TW），前端 i18next（7 种语言） | `AGENTS.md`、`web/src/i18n/locales/` |

## 四、目录结构

官方仓库是**根目录布局**：`router/`、`middleware/`、`controller/`、`service/`、`model/`、`relay/`、`setting/`、`web/` 等直接在最外层。本项目把整棵官方树放进了 `backend/`，这是「不是 Fork」的直接原因——两层目录不可能与官方共享 git 历史。

官方核心目录职责：

| 目录 | 职责 |
| --- | --- |
| `router/` | 路由注册，11 个文件、379 条路由 |
| `middleware/` | 鉴权、限流、缓存、审计、请求体处理 |
| `controller/` | HTTP 入口，参数校验与响应 |
| `service/` | 业务服务（配额、计费、任务、授权） |
| `model/` | GORM 模型与数据库访问、AutoMigrate 入口 |
| `relay/` | 上游协议适配与转发（按厂商分 channel） |
| `relaykit/` | 独立 Go module：协议 DTO 与转换 |
| `tokenkit/` | 独立 Go module：token 计数与估算 |
| `setting/` | 系统设置项定义与默认值 |
| `web/` | 官方管理前端（React） |
| `plugins/tasks/` | JS 任务插件 |
| `i18n/` | 后端国际化资源 |

**本项目外层结构**（与官方无关，全部自研）：

```
New API/
├── backend/                 官方源码（本报告审计对象）
├── frontend/                Portal monorepo
│   ├── apps/website/        品牌官网
│   ├── apps/console/        用户控制台
│   └── packages/            api-client / design-tokens / types（没有 ui 包，组件在各自 app 内）
├── deploy/nginx/            反向代理
├── company/patches/         补丁文件与清单
├── scripts/                 升级、发版、冒烟、导出脚本
└── docs/                    本报告、接口清单、数据库结构
```

## 五、接口面

实测 379 条，分布：

| 区域 | 条数 | 说明 |
| --- | ---: | --- |
| `/api` | 316 | 管理接口：用户、Key、渠道、日志、订阅、系统设置、权限、审计 |
| `/v1`、`/v1beta` | 44 | 客户程序调用面：对话、补全、嵌入、语音、图片、文件、任务、视频 |
| `/mj` | 16 | Midjourney 兼容接口 |
| `/dashboard` | 2 | 旧版 OpenAI 计费查询 |
| `/pg` | 1 | Playground |

方法分布：GET 167、POST 156、DELETE 32、PUT 19、PATCH 4、HEAD 1。

**对我们最重要的一条结论**：用户控制台需要的接口全部现成，不需要改后端。关键几条：

| 能力 | 接口 |
| --- | --- |
| 登录 / 资料 / 余额 | `POST /api/user/login`、`GET|PUT /api/user/self` |
| 可用模型 | `GET /api/user/models`、`GET /api/pricing` |
| API Key 管理 | `GET|POST|PUT /api/token/`、`DELETE /api/token/:id` |
| 用量与账单 | `GET /api/log/self`、`GET /api/log/self/stat`、`GET /api/log/self/search` |
| 登录设备 | `GET /api/user/sessions`（删除单台设备也现成） |
| 充值 | `GET /api/user/topup/info`、`POST /api/user/topup`（兑换码） |

完整清单见 `docs/API-INVENTORY.md`，含每条的定义文件与行号，可直接对照代码。

## 六、数据库

| 项目 | 值 |
| --- | --- |
| 表数量 | 38 |
| 字段总数 | 472 |
| 外键 | 0 条（官方不用数据库外键，关系全在代码里） |
| 主键/唯一索引 | 68 个 |
| 迁移方式 | 启动时 GORM `AutoMigrate`，无迁移编号、无迁移脚本目录 |

三个直接影响升级方式的事实：

1. 没有「迁移版本 42」这种锚点，版本记录只能用「表数量 + 备份时间」。
2. 官方改表是幂等的：同一版本反复启动不应再改结构。
3. 回滚靠还原备份，不靠反向迁移。

完整表清单、字段明细、索引与备份命令见 `docs/DATABASE.md`。

## 七、管理员权限体系

三级角色，定义在 `common/`：

| 角色 | 常量值 | 含义 |
| --- | ---: | --- |
| `RoleCommonUser` | 1 | 普通用户 |
| `RoleAdminUser` | 10 | 管理员 |
| `RoleRootUser` | 100 | 超级管理员 |

路由层两级把关，定义在 `backend/middleware/auth.go`：

- `AdminAuth()`：管理员及以上可过，用于渠道、日志、用户、兑换码、订阅、模型、审计等管理接口。
- `RootAuth()`：仅超级管理员，用于系统设置、性能、比例同步、自定义 OAuth、系统任务、任务插件等。
- 普通用户接口用 `UserAuth()`，控制台只能走这一层。

另有 Casbin 细粒度授权（`service/authz/`、`authz_roles`、`casbin_rule` 两张表），权限点按资源+动作划分，例如 `ChannelRead`、`ChannelWrite`、`ChannelSensitiveWrite`、`AuditRead`、`TaskPluginBind`。`channelPermissionRoutes` 里的 44 条接口就是按权限点注册的。

对我们的约束（已写进 `ARCHITECTURE.md` 红线）：

- 前端不得直接访问数据库。
- 管理员 Token 不放浏览器（`localStorage` 一律不用）。
- 不为 UI 方便绕过官方权限校验；不够用就组合现成接口或写独立 BFF。

## 八、前端主题配置能力

边界清楚，分两类：

**后台可配、改完即时生效（存在 `options` 表，不用重新构建）**

- 站点名称、Logo、favicon
- 首页内容（可填 URL / HTML / Markdown 覆盖官方默认首页）
- 公告、支付方式、邮件、注册与登录开关等系统设置

**必须改代码、重新构建镜像**

- 主色调（`web/src/styles/theme.css` 里的 CSS 变量）
- 布局、组件形态、导航结构

我们的做法：

- 主色走补丁 `P-001`（7 个颜色变量，不动布局），登记在 `company/patches/PATCHES.md` 与 `company/patches/manifest.json`，升级时脚本自动重放。
- Logo、平台名称、favicon 等公司素材到位后**在后台配**，不打补丁、不重新构建。
- 这条边界决定了上线顺序：先部署，再在后台换 Logo 和名称，不需要发一次版。

## 九、许可证与第三方依赖

| 项目 | 结论 |
| --- | --- |
| 主许可证 | **AGPL-3.0**（`backend/LICENSE`，35 KB 全文） |
| 版权声明 | `backend/NOTICE`，须保留 |
| 商用含义 | 把改造后的版本作为网络服务对外提供时，需向使用者提供对应源码；商用前要按此做合规安排 |
| 第三方依赖 | 官方自带 `backend/THIRD-PARTY-LICENSES.md`，覆盖 Go（含 relaykit / tokenkit）、`web/package.json`、`electron/package.json` 的**直接依赖**，逐条列许可证 |
| 未完成 | **传递依赖审计**。该文件自己写明：Transitive dependencies should be audited before a final external release. |

我们的现状与待办：

1. 官方业务代码 0 行改动、只改 7 行颜色，AGPL 的「修改」范围很小；但外层官网/控制台通过 HTTP 调用后端，是否构成「结合作品」需要法务判断，不给结论。
2. 对外发布前做一次传递依赖审计（`go list -m all` + `npm ls` 导出，逐条对许可证），重点看有没有 GPL/SSPL/商用限制类依赖。
3. AGPL 合规的两种常见处理：整包开源（含我们的补丁），或取得官方商业授权（是否存在需向官方确认）。二选一，上线前定。

## 十、二开边界

**允许**

- 外层三块界面自研：品牌官网、用户控制台、管理员后台换皮。
- 官方代码只做登记过的补丁（当前仅 `P-001`：7 行主色）。
- 通过现成接口组合满足新需求；不够时优先写独立 BFF。

**禁止**

- 改官方计费、鉴权、渠道路由等业务逻辑（md 第十一章红线）。
- 在 `backend/` 里手改官方代码而不登记补丁——下次升级会被覆盖。
- 删除或破坏官方管理员功能。

**怎么证明边界没破**：用当前锁定的版本重跑升级脚本，`git status` 应为空。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.49
git status
```

2026-11-10 实测结果：零差异；把补丁文件改坏时会停在冲突处并给出修复指引；tag 不存在时立即失败。

### 10.1 领导文档第十一章 10 条禁止事项核对

2026-11-10 逐条复查，结论：**一条没犯**。证据如下。

| # | 禁止事项 | 结论 | 证据 |
| ---: | --- | --- | --- |
| 1 | 改造成无法跟随官方升级的深度 Fork | 未违背 | 后端 0 行业务改动、只 7 行颜色；升级脚本用 rc.49 演练零差异，官方发新版一条命令可跟。注意：形式上是新建库不是 Fork（Phase 0 第 1 项记 🟡），但这条禁止的是「改到跟不动」，我们跟得动 |
| 2 | 把公司业务写进 New API 核心 | 未违背 | `backend/` 与官方 v1.0.0-rc.49 逐文件比对只差 5 个：`theme.css`（7 行颜色）+ 4 个自建部署文件；业务全在 `company/portal/` 三块界面 |
| 3 | 删除或破坏官方管理员功能 | 未违背 | 官方管理后台原样保留（只换色），`/api` 管理接口 316 条全在，见 `docs/API-INVENTORY.md` |
| 4 | 用前端隐藏按钮代替后端权限控制 | 未违背 | 控制台只调用户级接口（`UserAuth`），没有管理员功能入口；官方后台的 admin/root 权限由后端 `AdminAuth`/`RootAuth` + Casbin 校验，管理路由 40+ 处逐条挂中间件 |
| 5 | 用模拟数据冒充真实消费统计 | 未违背 | 控制台与官网数据全部来自 `/api/*`；代码里搜不到 mock/假数据；价格拉不到时显示「价格暂时不可用」，不填假数字 |
| 6 | 把管理员 Token 放到用户浏览器 | 未违背 | 控制台的 access token 只存在内存变量（`api-client/src/client.ts:68`），不落 localStorage；登录态靠 HttpOnly refresh cookie；localStorage 只存「新手引导已读」标记。管理 token 不进控制台 |
| 7 | 绕过原账单系统自行计算余额 | 未违背 | 余额与额度全部读后端（`/api/user/self`、`/api/log/self/stat`）；界面只做 quota → 人民币的单位换算（÷`quota_per_unit`×汇率），不自己记账 |
| 8 | 未经兼容性测试直接升级生产 | 未违背 | 生产尚未上线；本机已演练升级（rc.49 零差异、补丁冲突与错误 tag 两条失败路径均实测） |
| 9 | 升级时覆盖用户数据 | 未违背 | 升级脚本只替换 git 跟踪的官方代码文件，明确不碰 `data/`、`logs/`（脚本第 12 行注释与实现一致）；数据库在 Docker 卷，脚本不执行任何数据库操作 |
| 10 | 把公司密钥、生产库、真实用户数据提交到 Git | 未违背 | `.gitignore` 排除 `.env`、`logs/`，`backend/.gitignore` 有 `/data/`；`git ls-files` 里没有 `data/`、备份 SQL、`.env`。仓库里的 `.env.example` 是官方示例 |

**唯一要盯的一处**：`docker-compose.yml` / `docker-compose.company.yml` 里的 `123456` 是官方文档的示例密码，已随代码进 Git。它不是公司密钥，现在也不连生产，但**上线前必须换**，换完的密码只能放服务器环境变量，不能再提交。

## 十一、与官方的同步方式

**远程**

```
origin    → 我们自己的仓库（唯一推送目标）
upstream  → 官方仓库（只 fetch，永不 push）
```

**升级三步**

1. 拉官方 tag，确认新版本号（只跟 `v1.0.0-rc.xx` 这类正式发布，不跟开发分支）。
2. `git diff --stat` 看两个版本改了哪些文件。
3. 一条命令换代码并重放补丁：`scripts/upgrade-official.ps1 -Tag <新版本>`，脚本依次做「导出官方源码 → 覆盖 `backend/`（自有文件不动）→ 按 manifest 重放补丁 → 更新 `UPSTREAM.md` → `go build`」。

**为什么不能用 `git checkout <tag> -- backend/`**：官方是根目录布局，那个 tag 里没有 `backend/` 目录，命令必然报错。早期文档里的写法已作废，见 `UPGRADE.md` 第三节。

**「不是 Fork」的实际影响**

- 不能用 `git merge upstream/main` 合并官方提交，只能整目录替换（脚本已完成，且演练过零差异）。
- GitHub 上不显示与官方的 fork 关系，领导/审计方按「Fork」字面检查会对不上。
- 不影响功能：拉版本、看差异、重放补丁、编译验证都成立。

**补齐的两种方式**

| 方式 | 做法 | 代价 | 风险 |
| --- | --- | --- | --- |
| A. 结构对齐（推荐） | 官方代码移到仓库根、我们前端放 `portal/`，再把官方历史接上，成为真正的 Fork | 约半天，需重跑一次升级与冒烟 | 中：目录大搬家，容易漏路径 |
| B. 书面报备（过渡） | 说明用「双远程 + 脚本替换」替代 Fork，效果等同，附演练证据 | 10 分钟 | 低：但字面仍不符 |

建议：上线前做 A，B 作为过渡期说明。

## 十二、部署现状（与版本记录的偏差）

2026-11-10 15:30 实测：

| 项目 | 记录值（`VERSION.md`） | 实际值 |
| --- | --- | --- |
| `:3000` 运行镜像 | `company-newapi:0.3.0` | `calciumion/new-api:latest`（容器创建于 2026-11-10 09:14） |

影响：

1. 当前运行的实例**不带品牌色补丁**——补丁打在 `company-newapi` 镜像里。
2. 版本记录第 7 项还原不了这次部署，8.1 的「能准确还原某次生产部署所用版本」在这一条上不成立。

处理：上线前按 `DEPLOY.md` 用 `company-newapi` 镜像重建容器；若确需临时跑官方镜像做对照，在 `VERSION.md` 里注明日期与原因。

## 十三、结论与遗留

**10 项工作**：达成 8 项、部分 1 项（第三方传递依赖未审）、形式不符 1 项（非 Fork，目的已达到）。

**6 项交付物**：全部有实物。

| 交付物 | 文件 |
| --- | --- |
| 官方架构审计报告 | 本文 |
| 官方 API 接口清单 | `docs/API-INVENTORY.md`（脚本导出，379 条） |
| 数据库结构报告 | `docs/DATABASE.md`（实测 38 表 / 472 字段） |
| 二开边界说明 | 本文第十节 + `ARCHITECTURE.md` 第二、八节 + `company/patches/PATCHES.md` |
| Git 管理方案 | `UPGRADE.md` 第八节（双远程、四条分支、发版脚本） |
| 升级验证方案 | `UPGRADE.md` 第四节（13 项检查）+ `scripts/smoke-test.ps1` |

**遗留项**

| # | 事项 | 何时做 | 谁 |
| ---: | --- | --- | --- |
| 1 | 结构对齐成真正的 Fork | 上线前，约半天 | 开发 |
| 2 | 传递依赖许可证审计 | 对外发布前 | 开发 + 法务 |
| 3 | AGPL 合规方案（开源或商业授权） | 对外发布前 | 法务 |
| 4 | 部署镜像与版本记录对齐 | 下次部署时 | 开发 |
| 5 | 第九章 9.3 官方同步验收（真版本升级演练） | 官方发新版本后 | 开发 |

## 十四、怎么复核这份报告

```powershell
# 接口清单：重跑导出，条数应与 379 一致
node scripts/export-api-inventory.mjs

# 数据库：表数量应为 38
docker exec postgres psql -U root -d new-api -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"

# 是不是 Fork：输出为空即不是
git merge-base HEAD upstream/main

# 补丁边界：应无输出
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.49
git status --short
```
