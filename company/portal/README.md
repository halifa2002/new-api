# 前端（品牌官网 + 用户控制台）

尚未开工。这里将放公司自己的前端代码，与 `backend/` 里的官方前端（`backend/web/`）分开。

## 规划结构

```text
frontend/
├── apps/
│   ├── website/      # 品牌官网：首页、模型介绍、价格、文档
│   └── console/      # 用户控制台：仪表盘、模型广场、API Key、用量、消费、账户
├── packages/
│   ├── api-client/   # 统一封装对 backend 的接口调用
│   ├── ui/           # 统一组件
│   ├── design-tokens/# 品牌色、字号、间距
│   └── types/        # 接口数据类型
└── docs/             # 开发者文档
```

## 边界

- 前端只调 `backend/` 暴露的接口，不直接读数据库。
- 管理员后台仍用官方自带的那一套（在 `backend/web/` 里），这里不重做。
