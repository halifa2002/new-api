# New API 公司版（公司维护 Fork）

基于开源项目 [New API](https://github.com/QuantumNous/new-api) 做的品牌化二次开发：对外换公司自己的品牌，对内保留官方完整管理能力，并保证官方升级时可跟进。

## 这个仓库怎么长的

```
new-api/                     ← 官方代码在根目录，与官方仓库同一套布局
├── router/ model/ relay/ web/ ...   官方代码（业务逻辑一行没改）
└── company/                        我们的东西全在这里
    ├── portal/                     品牌官网 + 用户控制台（Next.js monorepo）
    ├── scripts/                    升级、发版、冒烟、接口导出脚本
    ├── deploy/                     反向代理配置（nginx）
    ├── patches/                    补丁清单与 P-001（7 行主题色）
    ├── docs/                       审计报告、接口清单、数据库结构、升级报告
    ├── Dockerfile                  公司镜像（基于官方镜像换二进制）
    └── docker-compose.company.yml  公司部署配置
```

为什么这样分：官方升级时，git 直接合并官方版本，我们只处理自己的改动（通常只有主题色那一处）。领导文档 3.3 要求「不把公司代码覆盖到官方代码上」，这个结构就是为此设计的。

## 常用命令

| 做什么 | 在哪执行 | 命令 |
| --- | --- | --- |
| 本地起官网 | `company/portal` | `npm run dev`（:3001） |
| 本地起控制台 | `company/portal` | `npm run dev`（:3002） |
| 起官方后台 | 仓库根 | `docker compose -f company/docker-compose.company.yml up -d`（:3000） |
| 跟官方升级 | 仓库根 | `company\scripts\upgrade-official.ps1 -Tag <官方tag>` |
| 跑冒烟测试 | 仓库根 | `company\scripts\smoke-test.ps1 -ApiKey sk-xxx` |
| 导出接口清单 | 仓库根 | `node company/scripts/export-api-inventory.mjs` |
| 发版 | `develop` 分支 | `company\scripts\make-release.ps1 -Version 0.2.0` |

## 文档在哪

| 想知道 | 看 |
| --- | --- |
| 系统怎么搭的、请求怎么走 | `company/ARCHITECTURE.md` |
| 怎么部署 | `company/DEPLOY.md` |
| 官方更新怎么跟 | `company/UPGRADE.md` |
| 出问题怎么退 | `company/ROLLBACK.md` |
| 这个版本用的什么 | `company/VERSION.md` |
| 审计结论与红线核对 | `company/AUDIT.md` |
| 当前进度 | `company/CHECKLIST.md` |

## 许可证

根目录的 `LICENSE` 是 New API 官方的 **AGPL-3.0**，版权归 QuantumNous 及贡献者所有。许可证文件与版权声明必须保留。

AGPL 的实际含义：把改造后的版本作为网络服务对外提供时，需要向使用者提供对应源码。商用前需按此要求做合规安排。
