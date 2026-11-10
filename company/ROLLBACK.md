# 故障回滚手册

> 对应领导文档「十二、最终交付要求」第 12 项，以及 8.4「升级回滚」。
> 核心原则：**能回滚是因为事先备份了，不是因为镜像还在。**

---

## 一、什么情况该回滚

出现以下任一情况，立即回滚，不要在现场调试：

- 登录不了，或登录后立刻掉线
- 模型调用全部失败（不是个别模型，是全部）
- 扣费金额明显错误，或余额与消费记录对不上
- 数据库报错，后端反复重启
- 管理后台打不开或关键菜单 500

判断依据：跑一遍 `scripts/smoke-test.ps1`，只要有 `[FAIL]` 且不是凭证问题，就先回滚再查。

---

## 二、升级前必须做的三件备份

缺任何一件，就**不允许开始升级**。

### 2.1 备份数据库

```bash
# 在服务器上执行，文件名带时间戳
docker exec postgres pg_dump -U root new-api \
  > /opt/company-ai/backup/new-api-$(date +%Y%m%d-%H%M).sql

# 立刻验证备份文件不是空的
ls -lh /opt/company-ai/backup/new-api-*.sql
head -20 /opt/company-ai/backup/new-api-*.sql | tail -5
```

> 备份文件小于 1KB，或里面没有 `CREATE TABLE`，说明备份失败，重做。

### 2.2 记录当前运行的镜像版本

```bash
docker inspect --format '{{.Config.Image}}' new-api
# 记下来，例如 registry.example.com/company-newapi:0.3.0
```

同时确认这个镜像**还在镜像仓库里**，没有被覆盖或删除——回滚要能拉回来。

### 2.3 记录官方版本与数据库状态

```bash
# 官方版本
curl -s https://api.example.com/api/status | grep -o '"version":"[^"]*"'

# 数据库表数量（官方用 GORM AutoMigrate，没有迁移编号，用表数量当锚点）
docker exec postgres psql -U root -d new-api -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

把镜像版本、官方版本、表数量、时间一起记进 `VERSION.md` 的新版本记录。

---

## 三、回滚操作

### 3.1 只回滚应用（数据库没动过）

适用：新版本起来后功能异常，但**没有触发数据库结构变更**。

```bash
cd /opt/company-ai/backend

# 1. 停掉当前容器
docker compose stop new-api

# 2. 把镜像标签改回旧版本
#    编辑 docker-compose.yml，image 改成上一版（第 2.2 步记下的）
#    或者用环境变量覆盖：
export NEWAPI_IMAGE=registry.example.com/company-newapi:<旧版本>

# 3. 拉取并启动
docker compose pull new-api
docker compose up -d new-api

# 4. 验证
docker logs --tail 50 new-api
```

**验收**：`scripts/smoke-test.ps1` 全部通过，且后台能登录。

### 3.2 需要连数据库一起回滚

**这是高风险操作。** 先读完这一节再动手。

先判断到底要不要回滚数据库：

| 情况 | 要不要回滚数据库 |
| --- | --- |
| 新版本只加了表/列，旧版本代码不认识但也用不到 | **不要**回滚数据库，直接回滚应用即可 |
| 新版本改了字段含义、或建了唯一索引导致旧代码写不进去 | 必须回滚数据库 |
| 新版本写坏了数据（比如批量扣费错误） | 必须回滚数据库 |

第二种情况最难判断。**拿不准就先只回滚应用**，观察是否恢复正常；不恢复再动数据库。

确认要回滚数据库时：

```bash
# 1. 先停掉所有写入
docker compose stop new-api

# 2. 把当前（坏掉的）数据库也备份一份，留证据
docker exec postgres pg_dump -U root new-api \
  > /opt/company-ai/backup/broken-$(date +%Y%m%d-%H%M).sql

# 3. 清空并重建数据库
docker exec postgres psql -U root -c "DROP DATABASE \"new-api\";"
docker exec postgres psql -U root -c "CREATE DATABASE \"new-api\";"

# 4. 导入备份
docker exec -i postgres psql -U root -d new-api < /opt/company-ai/backup/new-api-<时刻>.sql

# 5. 启动旧版本应用
docker compose up -d new-api
```

**验收**：表数量与第 2.3 步记录的一致；用旧账号能登录；消费记录条数对得上。

### 3.3 回滚失败怎么办

1. **不要反复重试**，每次失败都可能让数据更乱
2. 保留现场：`docker logs new-api > /tmp/crash.log`，`pg_dump` 一份当前状态
3. 把 `crash.log`、两个备份文件和操作时间点整理好
4. 找后端负责人介入

---

## 四、容易踩的三个坑

**坑一：以为换了镜像数据库就回去了**

不对。数据库是独立容器和独立卷，换应用镜像完全不影响它。新版本 AutoMigrate 加的表和列会留在库里。

**坑二：以为恢复旧镜像就能恢复旧数据**

更不对。AutoMigrate 只加不删——它不会把新加的列删掉，也不会把改过的数据改回去。数据只能靠 `pg_dump` 的备份恢复。

**坑三：备份了但没验证**

`pg_dump` 因为权限或磁盘满而写出空文件的情况真实存在。**每次备份后必须 `ls -lh` 看一眼大小、`head` 看一眼内容**，否则回滚时才发现备份是空的，就彻底没办法了。

---

## 五、演练记录

文档 8.4 要求「在测试环境完成升级验证」，回滚同理。每次演练后填这张表。

| 日期 | 演练内容 | 结果 | 耗时 | 发现的问题 |
| --- | --- | --- | --- | --- |
| 待填 | 仅回滚应用（数据库不动） | — | — | — |
| 待填 | 完整回滚（含数据库恢复） | — | — | — |

> 演练必须在**测试环境**做，不要拿生产练手。上线前至少完成一次「仅回滚应用」的演练。

---

## 六、回滚后的收尾

- [ ] 确认 `smoke-test.ps1` 全部通过
- [ ] 把故障现象、时间、处理过程写进事故记录
- [ ] 把坏掉的版本从镜像仓库标记为不可用（避免误拉）
- [ ] 分析根因，修好后再走一次完整升级流程
