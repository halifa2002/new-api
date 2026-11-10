# 官方更新怎么跟（操作手册）

这份文件回答一个问题：**官方出新版本了，我们怎么跟上去，又不把公司改动弄丢。**

对应领导 md 第八章「官方持续更新机制」。

---

## 一、当前跟的是哪一版

| 项目 | 值 |
| --- | --- |
| 官方仓库 | https://github.com/Calcium-Ion/new-api |
| 我们锁定的官方版本 | **v1.0.0-rc.49** |
| 对应的官方提交号 | `48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0` |
| 这个版本发布日期 | 2026-11-08 |
| 我们引入的日期 | 2026-11-09 |

**我们自己改了多少官方代码：后端业务代码一行没改，官方前端只改了主题色 7 行（P-001）。**

这一点很关键——因为改动极少，所以跟升级几乎零成本。以后如果非改不可，必须登记到 `backend/PATCHES.md` 并在 `company-patches/` 留补丁文件，升级时由脚本自动重放。

---

## 二、仓库连了两个地址

```
origin    → 我们自己的仓库（github.com/halifa2002/New-API-chongdong）
upstream  → 官方仓库（github.com/Calcium-Ion/new-api）
```

`origin` 用来存我们自己的东西，`upstream` 只用来**看官方出了什么新东西**，永远不往它推。

---

## 三、升级分三步

### 第一步：看看官方有什么新版本

```bash
# 拉官方最新版本标记（不下载全部历史，十几秒）
git fetch upstream --depth=1 --tags

# 看官方最新的版本号
git tag --list "v*" | sort -V | tail -5

# 看官方自己发了什么版本
git log upstream/main --oneline -10
```

**判断标准**：只跟官方 `v1.0.0-rc.xx` 这种正式发布的版本，**不要跟 main 分支上的开发提交**。

md 原话：「不直接无条件追随官方开发主分支」。因为开发分支随时可能半成品。

### 第二步：看新版本改了什么

```bash
# 假设官方发了 v1.0.0-rc.50
git fetch upstream --depth=1 --tags

# 对比我们当前锁定版本和新版本，只看改了哪些文件
git diff --stat v1.0.0-rc.49 v1.0.0-rc.50
```

如果改动只涉及 `backend/` 下的官方代码，而我们 `frontend/` 是自己的，互不干扰——**直接升级，风险极低**。

### 第三步：换上新版本并验证

一条命令搞定，**不要手工复制文件**（md 3.3 第 9 条明令禁止）：

```powershell
# 1. 建升级分支，出问题不影响主干
git switch -c upgrade/rc50

# 2. 同步官方代码 + 自动重放公司补丁（默认会跑 go build，编译不过会停下）
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.50

# 3. 看改动：应当只有官方代码在变，我们的补丁都已经贴回去
git status

# 4. 按第四节做功能验证

# 5. 提交
git add -A
git commit -m "chore(upstream): 同步官方 v1.0.0-rc.50"

# 6. 验证通过后合回主干
git switch main
git merge upgrade/rc50
```

脚本做的事：把官方该版本源码导出 → 覆盖 `backend/`（公司自有文件不动）→ 按 `company-patches/manifest.json` 重放补丁 → 更新 `backend/UPSTREAM.md` → 编译。

**为什么不能用 `git checkout <tag> -- backend/`**：官方仓库是根目录布局，那个 tag 里根本没有 `backend/` 目录，这条命令必然报错。早先写在这里的做法是错的，已作废。

**升级前先演练**（几分钟，能证明补丁清单没漏东西）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.49 -SkipBuild
```

拿当前已锁定的版本重跑一遍，`git status` 应该是空的。不空，说明有改动没登记进补丁清单。

---

## 四、换完之后必须验证这几件事

md 第八章列了 13 项检查，按重要性排序，**前六项必须过**：

1. **后端能编译**：`cd backend && go build -o /tmp/newapi .`
   （注意：要先构建前端产物 `backend/web/dist`，否则 embed 会报错）
2. **能打开登录页**：浏览器访问 `localhost:3000`，能出现登录界面
3. **管理员能登录**：用 `cdadmin` 登录后台
4. **用户控制台能登录**：`localhost:3002`，用同一账号登录，余额能显示
5. **模型列表能出来**：控制台「模型广场」不报错
6. **API Key 能建能删**：控制台「API 密钥」新建一个，能删掉

后七项（真实调用、额度一致、消费明细、渠道管理、镜像构建、数据库升级）等接了渠道之后再补。

---

## 五、升级失败怎么退回去

```bash
# 1. 切回升级前的分支
git checkout main

# 2. 如果已经合了，回退到上一个提交
git reset --hard HEAD~1

# 3. 重建 Docker 容器
cd backend && docker compose down && docker compose up -d
```

**数据库要特别小心**：官方新版本可能改表结构，一旦升上去，旧版程序可能连不上新表。

所以正式环境升级前，**必须先备份数据库**：

```bash
docker exec postgres pg_dump -U root new-api > backup-$(date +%Y%m%d).sql
```

---

## 六、三条铁律

1. **只跟官方正式版本，不跟开发分支**
2. **升级前先备份数据库**，不要以为换个 Docker 镜像就能退回去
3. **永远不在 `backend/` 里手改官方代码**——要改就登记到 `PATCHES.md`，否则下次升级就丢了

---

## 七、以后每次升级要记什么

md 8.1 要求记录 7 项。目前能填的：

| 项目 | 现在 |
| --- | --- |
| 公司版本 | v0.1.0（见 git tag） |
| 官方版本 | v1.0.0-rc.49 |
| 官方提交号 | `48a6c87f...` |
| 公司补丁版本 | 无（未改官方代码） |
| 前端版本 | 同公司版本 |
| 数据库迁移版本 | 官方自动迁移，未单独记录 |
| Docker 镜像标签 | 暂用官方 `calciumion/new-api:latest`，正式上线前改为固定标签 |

---

## 八、分支怎么用

md 3.1 要求四条分支。实际情况：

| 分支 | 用途 | 状态 |
| --- | --- | --- |
| `upstream/main` | 官方同步基线，**只读，永远不往上推** | 已接通 |
| `main` | 公司稳定发行版本，只放验证过的代码 | 在用，只接受 release 分支的合并 |
| `develop` | 日常开发 | 2026-11-10 已对齐 main（落后 29 个提交的历史问题已修），此后新改动走这里 |
| `release/*` | 每次发版从 develop 切出，如 `release/v0.2.0` | 发版时由脚本临时建、用完删 |

**发版就一条命令**（在 `develop` 分支、工作区干净时执行）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make-release.ps1 -Version 0.2.0
```

脚本自动做：切出 `release/v0.2.0` → 跑前端单元测试 → 合进 `main`（保留合并记录）→ 打标签 `company-v0.2.0` → 删掉临时分支，最后提醒你更新版本记录、构建镜像、部署、回滚方案。

参数：`-SkipChecks` 跳过单测；`-Push` 顺手推远端；`-KeepBranch` 留着 release 分支备查。

**手工做的话**，就是下面五步，脚本做的也是这些：

1. 日常改动提交到 `develop`，不直接推 `main`
2. 发版时：`git switch -c release/v0.2.0`（从 develop 切）
3. 在 release 分支上改 `VERSION.md`、跑 `scripts/smoke-test.ps1` 和 9.1 功能验收
4. 全部通过后：`git switch main` → `git merge --no-ff release/v0.2.0` → `git tag -a company-v0.2.0` → 删掉 release 分支
5. 推：`git push origin main` 和 `git push origin company-v0.2.0`

**唯一例外**：线上出故障需要紧急修复时，可以直接在 `main` 上改并立即部署，
但改完必须 `git cherry-pick` 回 `develop`，否则下次发版会把修复覆盖掉。

> 为什么之前一直在 main 上做：单人开发、没有并行需求。现在 develop 已经对齐，
> 规矩是「没验过的代码不进 main」，发版时那条隔离出来的分支就是验收现场。

**关于「不许在 main 上直接提交」这道保险**

仓库里带了 `.githooks/pre-commit`，理论上能在你直接往 main 提交时拦住。但它**默认是关的**。

原因说清楚：本机的 DSH 沙箱里 git 调 hook 会失败（`sh.exe: couldn't create signal pipe`），一开连正常提交都会被拦死——2026-11-10 实测过，所以撤掉了，不留在半开状态骗人。

在普通终端里确认 git 能跑 hook 之后，一条命令打开：

```powershell
git config core.hooksPath .githooks
```

打开后：在 main 上提交会被拒；发版合并（`MERGE_HEAD` 存在）放行；紧急修复用 `git commit --no-verify` 绕过。

想关回去：`git config --unset core.hooksPath`。

没开这道保险时，靠两样东西兜底：发版脚本只从 develop 切分支（不在 develop 直接报错），以及「main 只在发版时动」这条人工纪律。

