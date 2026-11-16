# 升级报告 · 2026-11-16（官方 rc.49 → rc.51）

## 一、基本信息

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-11-16 |
| 性质 | **本机演练**（非生产；生产环境尚等服务器与域名） |
| 起点版本 | `v1.0.0-rc.49` / `48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0`（2026-11-08 发布） |
| 目标版本 | `v1.0.0-rc.51` / `c9c6da2786b6a0912215127e78e28fbc6650c85f`（2026-11-13 发布） |
| 跳过版本 | `v1.0.0-rc.50`（2026-11-12）。rc.51 是它的补丁版，含「moego 升级到 v0.1.0-alpha.3，修复无 AVX 的 x86-64 CPU 上 SIGILL 崩溃」，因此不取 rc.50 |
| 合并方式 | Fork 模式 `git merge`，走 `company/scripts/upgrade-official.ps1` |
| 升级分支 | `upgrade/v1.0.0-rc.51` → 合并提交 `6437eb68` |

## 二、升级前检查

| 检查项 | 结果 |
| --- | --- |
| 工作区是否干净 | 有 3 个未跟踪项（`company/new-api-linux` 135 MB、`dsh-image-gen/`、`company/docs/_backup/`）。已写入 `.git/info/exclude`（本机忽略，不改官方 `.gitignore`），清理后 `git status` 为 0 项 |
| 未推送提交 | `develop` 有 2 个提交未推（`cf20d65d` P-002 修复、`73010839` 补登提交号）。已推送到 `origin/develop`，`ls-remote` 与本地一致 |
| 补丁清单 | P-001（`web/src/styles/theme.css` 主题色）、P-002（`model/user_session.go`、`service/auth_session.go` 会话去重）。官方 rc.49→rc.51 的 463 个改动文件里**不含这两个文件** |
| 冲突预判 | `git merge-tree --write-tree develop v1.0.0-rc.51` 返回干净树，预判零冲突 |
| 数据库备份 | `backups/new-api-before-rc51-20261116-0901.sql`，0.2 MB，容器内 `pg_dump` 后 `docker cp` 导出（不在 Git 仓库内） |
| 升级前基线 | 38 张表 / 7 个用户 / 6 把有效 Key（另 6 行软删除记录）/ 13 条日志；镜像 `company-newapi:0.3.0` |

## 三、执行过程

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 1. 合并 | `upgrade-official.ps1 -Tag v1.0.0-rc.51` | 零冲突（`Automatic merge went well`），15 个官方提交、463 个文件 |
| 2. 编译（首次） | 脚本内 `go build ./...` | **失败**：Go 模块缓存与编译缓存在工作区外（`C:\Users\lo\go-workspace`、`AppData\Local\go-build`），被文件沙箱拒绝写入。与代码无关 |
| 3. 编译（复跑） | 完整权限下 `go build ./...` | 通过，120 秒，退出码 0 |
| 4. 提交合并 | `git commit -F <UTF-8 无 BOM 描述文件>` | `6437eb68` |
| 5. 官方后台前端 | `cd web && bun install && bun run build` | 通过：安装 1222 个包（56 秒），构建 82 秒，dist 由 2026-11-09 更新为 2026-11-16 09:06 |
| 6. 交叉编译 | `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w -X ...common.Version=v0.2.0-company"` | 通过，100 秒，产物 134.8 MB |
| 7. 镜像 | `docker build -f company/Dockerfile -t company-newapi:0.4.0 -t company-newapi:latest .` | 通过，23 秒，镜像 510 MB |
| 8. 重建服务 | `docker compose -p backend -f company/docker-compose.company.yml up -d --force-recreate new-api` | 30 秒转 healthy |
| 9. 版本串核对 | `GET /api/status` | 首次显示 `v0.0.0`（漏注入 ldflags），补版本号重编后为 `v0.2.0-company` |
| 10. 公司前端构建 | `company-portal: bun install && bun run build` | 通过，41 秒，官网与控制台页面全部生成 |
| 11. 冒烟测试（首轮） | `smoke-test.ps1 -ApiKey sk-***`（无管理员账号） | 4 项通过、0 项失败、5 项跳过 |
| 12. 冒烟测试（补齐管理员） | `smoke-test.ps1 -ApiKey sk-*** -AdminUser cdadmin -AdminPass ***` | **10 项通过 / 0 失败 / 3 项人工**（三项人工由第 3、5、7 步实际执行） |
| 13. 新功能点验 | `GET /api/task_plugin_options`、`GET /api/request_plugin/instances` | 均 HTTP 200 success=true，data 有值，插件子系统挂载正常 |

## 四、结果核对

| 核对项 | 结论 |
| --- | --- |
| 合并文件量 | 自 rc.49 起 463 个文件（227 个 Go、205 个 web、16 个 plugins 等），+73831 / -3300 行 |
| 公司自有文件是否被动 | 否。`git diff v1.0.0-rc.51..HEAD` 显示差异只有 `company/` 全部内容、`.gitignore` 追加段、以及 4 个补丁文件（`theme.css`、`user_session.go`、`auth_session.go`、`auth_session_test.go`） |
| 补丁是否只改颜色 | P-001 仍是 7 个颜色变量；P-002 仍是会话去重逻辑（25 行 + 13 行 + 测试），未与其他代码缠绕 |
| 数据是否一致 | 结构不变：38 张表、7 个用户与升级前一致。有效 Key 6 把（15 行中含 9 行软删除，均为测试残留）。日志 13 → 18，新增 5 条全部是本次冒烟与手工验证产生的真实调用记录（每条 quota=9，可核对） |
| 服务可用性 | `/api/status` 返回 `success`，版本串 `v0.2.0-company`，容器健康检查通过，登录页 HTTP 200 |
| 模型能力 | 冒烟实测模型列表 2 个（`deepseek-flash`、`deepseek-v4-pro`），真实调用返回正常，消耗 39 tokens |
| 计费一致性 | 用管理员自己的 Key 调用后，管理员余额准确扣减 9 quota，与消费日志条数、金额对得上 |

## 五、本轮修掉的两个测试缺陷（与升级无关，属历史遗留）

1. **`smoke-test.ps1` 缺 UTF-8 BOM**：Windows PowerShell 5.1 按 GBK 读取，整个脚本解析失败（6 处中文乱码报错），即该脚本在本机从未成功运行过。已补 BOM，语法校验 0 错误。
2. **Key 列表读取方式错误**：官方 `/api/token/` 返回的是分页对象 `{ page, page_size, total, items }`，脚本按数组解析，导致「API Key 创建与删除」自建立起一直误报「回查不到记录」。已核实 rc.49 与 rc.51 此接口代码完全一致（`controller/token.go` 无差异），所以**不是升级导致的**。已改为读 `items`。
3. 附带修正「额度扣减」检查的失败提示：该检查要求 `-ApiKey` 与 `-AdminUser` 属于同一账号，否则扣的是别人余额、管理员余额自然不变。

三条均已写入脚本，重跑 10/10 通过。

## 六、回滚验证

代码回滚路径（未执行，仅确认可用）：

```powershell
git switch develop
git reset --hard 73010839          # 升级前 develop 的提交
git branch -D upgrade/v1.0.0-rc.51
docker compose -p backend -f company\docker-compose.company.yml up -d --force-recreate new-api
```

数据库回滚：用 `backups/new-api-before-rc51-20261116-0901.sql` 还原。本次表数量未变（38 → 38），说明官方本版没有新增表，回退旧镜像的风险低于表结构变更的情形。

## 七、遗留与注意

1. 编译 Go 代码与构建前端时必须放开文件沙箱（Go 模块缓存与 Bun 缓存都在工作区外），属本机环境限制，生产构建应在 CI 或服务器上进行。
2. 官方 rc.50 引入的插件子系统（JS 插件、插件市场、插件路由分发器）体量很大，本轮只验证了管理接口可访问、未做插件安装/卸载的写入测试——生产前如需启用插件功能，需单独补一轮验证。
3. 同花顺式（同类的）测试残留：`tokens` 表有 9 行软删除记录（id 9–15 等测试 Key），不影响业务，如需干净可另行清理。
4. 镜像编号（0.4.0）与公司版本号（v0.2.0）不同步，属历史遗留的编号方式，已在 `VERSION.md` 注明以版本卡为准。
5. 冒烟脚本的中文注释在 `edit` 工具改写后会丢失 BOM，**每次编辑该文件后必须重新补 BOM**，否则脚本再次不可运行。

## 八、结论

**升级验证通过。** 零冲突合并、后端编译、官方前端构建、公司前端构建、镜像构建、容器重建、数据一致性、真实调用与计费核对、管理员登录与渠道接口、插件子系统挂载，全部实际执行并通过；公司两处补丁未被触碰，能回滚。

对照领导文档 9.3「官方同步验收 7 项」：取版本 ✅、识别变化 ✅、重放补丁（无需重放，随提交历史带过）✅、识别冲突（预判与实际均零冲突）✅、运行升级测试 ✅（10/10 + 人工 3 项）、生成报告 ✅、回滚上一稳定版本 ✅（路径与备份已确认）。
