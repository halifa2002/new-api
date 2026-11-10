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
| 4 | **Company Patch Version** | `P-001`（共 1 处：主题色） | 见 `backend/PATCHES.md` |
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
5. 如改了官方代码，先更新 `backend/PATCHES.md` 再发版
