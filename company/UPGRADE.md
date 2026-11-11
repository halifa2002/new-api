# 官方更新怎么跟（操作手册）

这份文件回答一个问题：**官方出新版本了，我们怎么跟上去，又不把公司改动弄丢。**

对应领导文档第八章「官方持续更新机制」与第三章 3.3「官方代码修改原则」。

---

## 一、当前跟的是哪一版

| 项目 | 值 |
| --- | --- |
| 官方仓库 | https://github.com/QuantumNous/new-api （原 Calcium-Ion） |
| 我们锁定的官方版本 | **v1.0.0-rc.49** |
| 对应的官方提交号 | `48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0` |
| 这个版本发布日期 | 2026-11-08 |
| 我们引入的日期 | 2026-11-09 |

**我们自己改了多少官方代码：后端业务代码一行没改，官方前端只改了主题色 7 行（P-001）。**

改动登记在 `company/patches/PATCHES.md`，机器读的清单是 `company/patches/manifest.json`，补丁文件在 `company/patches/branding/`。

---

## 二、仓库长什么样

```
new-api/                     ← 后端仓库：官方代码在根目录，与官方仓库同一套布局
├── router/ model/ relay/ web/ ...   官方代码
└── company/                        公司后端相关的内容全在这里
    ├── scripts/                    升级、发版、冒烟、导出脚本
    ├── deploy/                     反向代理配置
    ├── patches/                    补丁清单与补丁文件
    ├── docs/                       审计报告、接口清单、数据库结构
    ├── Dockerfile                  公司镜像
    └── docker-compose.company.yml  公司部署配置
```

前端（品牌官网 + 用户控制台）在**同级独立仓库** `company-portal/`，不在本仓库内，
所以升级官方后端不会碰到前端代码，两边各自合并、各自发版。

**关键点**：官方代码与我们在同一棵提交历史里（真 Fork）。所以升级用 git 合并，不再整包覆盖——这也是领导文档 3.3 第 7、8、9 条要求的做法。

---

## 三、分支怎么用

| 分支 | 用途 | 规矩 |
| --- | --- | --- |
| `upstream/main` | 官方同步基线 | **只读，永远不往上推** |
| `main` | 公司稳定发行版本 | 只接收 `release/*` 的合并；不直接改 |
| `develop` | 公司开发分支 | 日常改动都提交到这里 |
| `release/*` | 公司发布分支 | 发版时从 develop 切出，验收后合回 main，用完删掉 |

发版用一条命令（在 `develop` 分支、工作区干净时）：

```powershell
powershell -ExecutionPolicy Bypass -File company\scripts\make-release.ps1 -Version 0.2.0
```

---

## 四、升级分三步

### 第一步：看看官方有什么新版本

```powershell
# 拉官方标签（只更新标签，不动工作区）
git fetch upstream --tags

# 看官方最近的版本号
git tag --list "v*" | Sort-Object | Select-Object -Last 5
```

**判断标准**：只跟 `v1.0.0-rc.xx` 这种正式发布的版本，**不跟 main 分支上的开发提交**（领导文档 3.1 原话）。

### 第二步：一条命令合并

```powershell
# 在 develop 分支、工作区干净的状态下执行
powershell -ExecutionPolicy Bypass -File company\scripts\upgrade-official.ps1 -Tag v1.0.0-rc.50
```

脚本做这些事：

1. 检查工作区是否干净
2. 解析官方 tag 对应的提交
3. 从当前分支切出 `upgrade/<tag>`
4. `git merge` 该 tag
5. 编译 `go build ./...`
6. 汇总改动，提示下一步

**跟旧版脚本的区别**：旧版把官方源码整包覆盖到 `backend/` 再重放补丁；现在官方代码就在根目录，git 自己会算差异，我们只处理冲突。

### 第三步：处理冲突（通常只有一处）

如果主题色那处官方也改了，脚本会停下并列出 `web/src/styles/theme.css`。处理办法：

1. 打开冲突文件，**保留公司品牌色**：`#4F46E5`、`#6366F1`、`#4338CA`、`#818CF8`，其余取官方新版
2. `git add web/src/styles/theme.css`
3. 继续完成合并：

```powershell
powershell -ExecutionPolicy Bypass -File company\scripts\upgrade-official.ps1 -Tag v1.0.0-rc.50 -Continue
```

### 第四步：验证后合回主干

```powershell
# 跑冒烟测试（需要服务已启动、有可用的 API Key）
powershell -ExecutionPolicy Bypass -File company\scripts\smoke-test.ps1 -ApiKey sk-xxx

# 通过后合回 develop / main
git switch develop
git merge --no-ff upgrade/v1.0.0-rc.50
git push origin develop
```

---

## 五、换完之后必须验证这几件事

领导文档 8.3 列了 13 项，**前六项必须过**：

1. **后端能编译**：`go build ./...`
2. **前端能构建**：`cd web && bun run build`，以及 `cd ../company-portal && bun install && bun run build`
3. **能打开登录页**：浏览器访问 `localhost:4100`
4. **管理员能登录**：用 `cdadmin` 登录后台
5. **用户控制台能登录**：`localhost:4102`，余额能显示
6. **模型列表能出来**：控制台「模型广场」不报错
7. **API Key 能建能删**
8. **模型实际调用正常**：`scripts/smoke-test.ps1` 覆盖
9. **额度和消费统计一致**
10. **消费明细正常**
11. **管理员渠道管理正常**
12. **Docker 镜像能构建**：`docker build -f company/Dockerfile -t company-newapi:<版本> .`
13. **数据库升级成功**：启动后确认表数量，见 `company/docs/DATABASE.md`

---

## 六、升级失败怎么退回去

**代码**：直接回退分支或提交。

```powershell
git switch develop
git reset --hard <升级前的提交>
```

或者把升级分支删掉重来：

```powershell
git branch -D upgrade/v1.0.0-rc.50
```

**数据库**：官方新版本可能改表结构，一旦升上去，旧版程序可能连不上新表。所以正式环境升级前**必须先备份**：

```powershell
docker exec postgres pg_dump -U root new-api > backup-$(Get-Date -Format yyyyMMdd).sql
```

还原用备份文件，不靠反向迁移（官方用 `AutoMigrate`，没有迁移编号可回退）。

详细步骤见 `company/ROLLBACK.md`。

---

## 七、每次升级要记什么

领导文档 8.1 要求记录 7 项，记在 `company/VERSION.md`：

| 项目 | 怎么填 |
| --- | --- |
| Company Edition Version | 公司版本号，如 `v0.2.0` |
| New API Upstream Version | 官方 tag，如 `v1.0.0-rc.50` |
| New API Commit SHA | 官方提交号 |
| Company Patch Version | 补丁编号，当前 `P-001` |
| Portal Version | 前端版本，与公司版本同号 |
| Database Migration Version | 无独立编号，记表数量 + 备份时间 |
| Docker Image Tag | `company-newapi:<版本>` |

---

## 八、四条铁律

1. **只跟官方正式版本，不跟开发分支**
2. **升级前先备份数据库**，别以为换个镜像就能退回去
3. **永远不在官方文件里手改**——要改就登记到 `company/patches/PATCHES.md`
4. **每次升级出一份报告**，格式见 `company/docs/UPGRADE-REPORT-20261110.md`

---

## 九、升级报告模板

每次升级后，在 `company/docs/` 下新建 `UPGRADE-REPORT-<日期>.md`，填这几栏：

- 基本信息：日期、性质（演练/生产）、起点与目标版本及 SHA
- 升级前检查：工作区是否干净、补丁清单、备份情况
- 执行过程：每步结果
- 结果核对：合并了多少文件、自有文件是否被动、补丁是否只改颜色
- 回滚验证：能不能退回去
- 遗留与注意
- 结论
