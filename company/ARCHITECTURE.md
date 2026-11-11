# 系统架构及接口文档

> 对应领导文档「十二、最终交付要求」第 13 项。
> 读完这份应该能回答：系统由哪几块组成、一次调用经过哪些环节、改哪里会影响什么。

---

## 一、总体结构

```
                        用户 / 客户程序
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        www.<域名>      console.<域名>    api.<域名>
         品牌官网         用户控制台        API 网关
              │               │               │
        nginx 静态         Next.js 服务端     nginx 反代
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                     New API 官方后端（不动）
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
          用户管理         渠道管理         模型路由
           API Key         额度计费         调用日志
                              │
                              ▼
                       上游模型服务
                    （DeepSeek 等）
```

另有一条独立入口：

```
admin.<域名>  →  nginx  →  New API 官方管理后台（换过配色）
                          根路径 302 到 /dashboard
```

---

## 二、组件职责

| 组件 | 位置 | 职责 | 能不能改 |
| --- | --- | --- | --- |
| New API 后端 | 仓库根目录 | 用户、渠道、路由、计费、日志，全部核心业务 | **只改品牌色，不改业务逻辑** |
| 管理后台前端 | `web/` | 官方管理界面 | 只换 logo/名称/主色/favicon |
| 品牌官网 | `../company-portal/apps/website/` | 对外展示，静态导出 | 完全自研，随便改 |
| 用户控制台 | `../company-portal/apps/console/` | 注册登录、Key、用量、账单 | 完全自研，随便改 |
| API 适配层 | `../company-portal/packages/api-client/` | 封装所有对官方 API 的调用 | 完全自研 |
| 设计变量 | `../company-portal/packages/design-tokens/` | 颜色、字体、间距、圆角 | 单一真源，页面不许自定义 |
| 反向代理 | `deploy/nginx/` | 域名、HTTPS、转发、静态资源 | 完全自研 |

**架构红线**（来自领导文档第二章）：
- 前端不得直接访问数据库
- 不得在浏览器里保存管理员 Token
- 不得为了 UI 方便绕过官方权限校验

---

## 三、三条访问链路

### 3.1 访客看官网

```
浏览器 → nginx（www 域名）→ 静态文件 out/
```

官网是构建时导出的纯静态页面。模型清单和价格在**构建时**从后端拉一次，写进 HTML。
所以「后台调价后官网没变」是正常的——重新构建即可。

### 3.2 用户用控制台

```
浏览器 → console 服务端 → api-client → New API /api/*
                ↑                            │
                └──── 响应（含 cookie）───────┘
```

控制台自己不存业务数据，全靠 `api-client` 调官方接口。

**为什么控制台要服务端转发？** 因为 `rewrites` 会吃掉路径尾斜杠、`middleware` 在 Next 16 已弃用，
而官方 CORS 返回 `*` 与带凭证的请求冲突。所以用 `app/api/[...path]/route.ts` 直通转发。

### 3.3 客户程序调 API

```
程序 → nginx（api 域名）→ New API /v1/* → 上游模型
```

这一条是产品的正事。请求带 `Authorization: Bearer sk-xxx`，后端按 token 数量扣额度。

---

## 四、技术栈

| 层 | 选型 |
| --- | --- |
| 后端 | Go 1.26 + Gin + GORM |
| 管理后台前端 | React 19 + Rsbuild + Tailwind + TanStack Router/Query |
| 官网 / 控制台 | Next.js 16（官网静态导出，控制台服务端渲染） |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis |
| 反向代理 | nginx |
| 部署 | Docker Compose |

---

## 五、接口清单

### 5.1 转发接口（给客户程序）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/chat/completions` | 对话补全，支持 `stream: true` |
| GET | `/v1/models` | 查询可用模型列表 |

鉴权：`Authorization: Bearer sk-xxx`

### 5.2 管理接口（给控制台和后台）

只列本项目实际用到的，完整 341 条见官方代码 `router/`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/user/login` | 登录，返回 access_token |
| GET | `/api/user/self` | 当前用户资料与余额 |
| PUT | `/api/user/self` | 修改资料 |
| PUT | `/api/user/password` | 修改密码 |
| GET | `/api/user/models` | 当前用户可用的模型 |
| GET | `/api/token/` | API Key 列表（分页） |
| POST | `/api/token/` | 新建 API Key |
| PUT | `/api/token/` | 编辑 API Key |
| DELETE | `/api/token/:id` | 删除 API Key |
| GET | `/api/log/self` | 消费明细（分页） |
| GET | `/api/log/self/stat` | 用量统计 |
| GET | `/api/pricing` | 模型定价（**公开接口**，官网构建时用） |
| GET | `/api/status` | 系统状态与运行参数（**公开接口**） |
| GET | `/api/channel/` | 渠道列表（管理员） |

### 5.3 计费相关的事实

- 计费单位：`quota`，换算关系 `$1 = 500000 quota`（取自 `/api/status` 的 `quota_per_unit`）
- 汇率：`/api/status` 的 `usd_exchange_rate`（当前 7.3）
- **真实单价在 `/api/pricing` 的 `billing_expr` 字段里**，形如：

  ```
  tier("peak", p * 0.3 + cr * 0.006 + c * 1.2)
  ```

  其中 `p` = 输入 token，`c` = 输出 token，`cr` = 缓存命中 token。
  换算：`每百万 token 人民币 = 系数 × 1000000 ÷ quota_per_unit × 汇率`

- `model_ratio` 字段**不参与实际计费**，按它算价格会错约 250 倍。这是本项目踩过的坑。

---

## 六、认证与数据流

### 6.1 两种认证不能混用

| 用途 | 凭证 | 放在哪 |
| --- | --- | --- |
| 控制台 / 后台的页面操作 | `access_token`（Bearer）+ refresh cookie | 页面内存 + httpOnly cookie |
| 客户程序调模型 | `sk-` 开头的 API Key | 客户自己的配置 |

**管理员 Token 绝不放用户浏览器的 localStorage**——这是文档明确禁止的。

### 6.2 一次调用的扣费链路

```
请求 → 校验 Key → 估算预扣额度 → 调上游 → 拿到实际 usage
                                          ↓
                                    按实际 token 结算
                                          ↓
                              写消费日志 + 扣用户余额 + 扣 Key 额度
```

预扣用的是**估算值**，实际结算按真实用量。估算偏低时余额可能变成负数——
这是估算误差，不是「允许透支」。余额为 0 时请求会被直接拒绝（403）。

---

## 七、目录结构

```
new-api/                          官方代码在仓库根，与官方仓库同一套布局
├── router/ model/ relay/ web/ ... 官方后端与官方管理前端
└── company/                      公司自有内容
    ├── portal/                   Portal monorepo
    │   ├── apps/website/         品牌官网
    │   ├── apps/console/         用户控制台
    │   └── packages/
    │       ├── api-client/       官方接口封装
    │       ├── ui/               共用界面零件
    │       ├── design-tokens/    设计变量
    │       └── types/            接口类型
    ├── deploy/nginx/             反向代理配置
    ├── patches/                  补丁清单与 P-001
    ├── scripts/                  升级、发版、冒烟、导出脚本
    ├── docs/                     审计报告、接口清单、数据库结构
    ├── Dockerfile                公司镜像
    ├── docker-compose.company.yml
    ├── DEPLOY.md                 部署手册
    ├── ROLLBACK.md               回滚手册
    ├── VERSION.md                版本记录（7 项）
    └── UPGRADE.md                官方升级流程
```

---

## 八、和官方版本的关系

- 官方代码在仓库根目录，通过 `upstream` 远程跟随
- 公司改动只有一处：`web/src/styles/theme.css` 的主色（登记为补丁 P-001）
- 官方升级时按 `UPGRADE.md` 的合并流程执行（git merge 官方 tag），补丁可重复应用
- 版本记录必须同时记官方版本与 Commit SHA（见 `VERSION.md`）

**不要做的事**：不要为了某个功能去改官方计费、鉴权、渠道路由逻辑。
接口不够用时，优先找现成接口组合，其次写独立 BFF，最后才考虑打补丁。

---

## 九、改动影响速查

| 想改什么 | 改哪里 | 要重新构建什么 |
| --- | --- | --- |
| 官网文案/样式/页面 | `../company-portal/apps/website/` | 官网静态站（`npm run build`） |
| 控制台页面 | `../company-portal/apps/console/` | 控制台服务 |
| 品牌名/域名/邮箱 | `../company-portal/apps/*/lib/brand.ts` | 官网 + 控制台 |
| 后台主色 | `web/src/styles/theme.css` | **必须重建后端镜像** |
| 后台 Logo / 名称 / favicon | 后台系统设置（可配，无需构建） | 不用构建 |
| 模型价格 | 后台「模型定价」 | 官网重新构建后价格才更新 |
| 域名 / 证书 | `deploy/nginx/` | reload nginx |

---

## 十、已知约束

1. **同 host 不同端口会互相顶掉登录**——4100 和 4102 共享 cookie。生产必须分不同子域名。
2. **后台换皮必须重建镜像**——跑的是预构建镜像，改本地文件不生效。
3. **官网价格是构建时快照**——后台调价后要重新发布，不是实时。
4. **官方用 GORM AutoMigrate，没有迁移编号**——数据库版本用「表数量 + 备份时间」当锚点。
