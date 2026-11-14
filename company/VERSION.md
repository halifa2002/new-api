# 版本记录卡

对应领导文档 8.1「版本管理」：每个公司发行版本必须记录 7 项，且**不允许只记录公司自己的版本号**。

用途：任何一次生产部署，都能凭这张卡准确还原当时用的官方代码版本。

---

## 当前版本：v0.1.0

记录日期：2026-11-09

| # | 项目 | 值 | 怎么查 |
| --- | --- | --- | --- |
| 1 | **Company Edition Version** | `v0.1.0` | `git tag --list "company-*"` |
| 2 | **New API Upstream Version** | `v1.0.0-rc.49` | `git tag --list "v1.0.0-rc.*" \| sort -V \| tail -1` |
| 3 | **New API Commit SHA** | `48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0` | `git rev-list -n 1 v1.0.0-rc.49` |
| 4 | **Company Patch Version** | `P-001`（共 1 处：主题色） | 见 `company/patches/PATCHES.md` |
| 5 | **Portal Version** | 与公司版同号 `v0.1.0` | 前后端同一仓库同一提交，见下表提交号 |
| 6 | **Database Migration Version** | 无独立版本号（官方用 GORM AutoMigrate 自动建表，当前 38 张表） | `docker exec postgres psql -U root -d new-api -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"` |
| 7 | **Docker Image Tag** | `company-newapi:0.3.0`（2026-11-10 15:40 已按 `docker-compose.company.yml` 重建 `:3000` 并核对镜像、版本串与前端主色） | `docker inspect new-api --format '{{.Config.Image}}'` |

补充信息（不属于 7 项，但排障要用）：

| 项目 | 值 |
| --- | --- |
| 代码提交（Git SHA） | 见 `git log -1 --format=%H` |
| 数据库类型与版本 | PostgreSQL 15 |
| 缓存 | Redis latest |
| 后端二进制版本串 | `v0.1.0-company`（`GET /api/status` 的 `version` 字段可查） |

---

## 环境核对（2026-11-14 实测）

代码基线与本机运行实例对不上，部署/验收前必须重建：

| 项 | 实测值 |
| --- | --- |
| 代码基线 | `v1.0.0-rc.49`（`48a6c87`），HEAD = `v1.0.0-rc.49-6-gbfd8aabf7` |
| 本机 `:3000` 运行实例 | `GET /api/status` → `version = v1.0.0-rc.51` |
| 运行实例主色 | CSS `--primary:#3ea4ec`（官方蓝），不是补丁色 `#4F46E5` |

**结论：本机演示跑的是官方 `v1.0.0-rc.51` 镜像，不是公司构建 `company-newapi:0.3.0`。**
因此 `P-001` 主题色补丁与任何 `web/` 改动在当前实例上都看不到；要看到公司版界面必须按 `docker build` 重建镜像。

品牌显示名例外：`SystemName` 是运行时 options（后台设置 → 系统设置），2026-11-14 已改为「虫洞 AI」，不依赖镜像即在 `/api/status` 生效。
Logo / favicon 需把图形文件放进 `web/public/` 并重建镜像，再设置 `Logo` 指向该路径。

---

## 第 6 项为什么没有版本号

官方 New API 用 GORM 的 `AutoMigrate` 在启动时对比结构自动建表、加字段，**不维护 migration 版本号**。

所以无法用「迁移版本 42」这样的编号还原。替代做法：

- 记**表数量**（当前 38 张，2026-11-10 实测），升级后对比数量与结构变化
- 正式升级前**完整备份数据库**（见 `UPGRADE.md` 第五节）
- 需要精确还原时，用备份文件恢复，而不是靠迁移号回退

---

## 历史记录

| 公司版本 | 官方版本 | 官方 SHA | 补丁 | 镜像标签 | 记录日期 |
| --- | --- | --- | --- | --- | --- |
| v0.1.0 | v1.0.0-rc.49 | `48a6c87` | P-001 | `company-newapi:0.3.0` | 2026-11-09 |

> 新增版本时在表格追加一行，同时更新上面的「当前版本」区块。

---

## 每次发版要做的事

1. 打公司版本 tag：`git tag -a company-vX.Y.Z -m "说明"`
2. 构建并打镜像：`docker build -f Dockerfile.company -t company-newapi:X.Y.Z .`
3. 更新本文件「当前版本」7 项 + 历史记录追加一行
4. 提交推送
5. 如改了官方代码，先更新 `company/patches/PATCHES.md` 再发版
