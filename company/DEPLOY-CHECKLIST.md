# 部署清单 · 搬到生产服务器

> 用途：把本机这套（后端 + 官网 + 控制台 + 数据库）搬到一台干净的服务器。
> 按顺序做，每步都有「怎么算过」。新服务器上 **从零起库、再导入备份**，不是拷数据目录。
>
> ⚠️ `company/DEPLOY.md` 里的路径（`backend/Dockerfile.company`、`frontend/apps/website`）已过期，
> 以本清单和实际目录为准；DEPLOY.md 待单独修正。

---

## 0. 前置条件（缺一项就先别开始）

- [ ] 服务器：Ubuntu 22.04 或更新，2 核 4G 起，已装 Docker 与 `docker compose` 插件
- [ ] 三个域名都解析到这台服务器的公网 IP：`tokenflow365.com`、`api.tokenflow365.com`、`console.tokenflow365.com`
- [ ] 本机已构建镜像 `company-newapi:0.4.0`（`docker images | grep company-newapi` 能看到）
- [ ] 已备份数据库，并且记下了对账基准数字（见 1.2）

---

## 1. 本机准备（搬之前做完，别跳）

### 1.1 备份数据库

```bash
docker exec postgres pg_dump -U root -d new-api -Fc -f /tmp/new-api-$(date +%Y%m%d).dump
docker cp postgres:/tmp/new-api-$(date +%Y%m%d).dump ./backup/
```

- [ ] `backup/` 下拿到一个几十 KB 以上的 `.dump` 文件

### 1.2 记下对账基准（搬完要一项项对）

```bash
docker exec postgres psql -U root -d new-api -c "
select 'users' t, count(*) from users
union all select 'channels', count(*) from channels
union all select 'tokens', count(*) from tokens
union all select 'logs', count(*) from logs;"
```

把四个数字抄在纸上。**这是搬完验收的唯一标准**，凭「页面能打开」不算搬成。

### 1.3 导出镜像（服务器拉不到本地镜像，只能传过去）

```bash
docker save company-newapi:0.4.0 | gzip > company-newapi-0.4.0.tar.gz
```

### 1.4 构建前端产物

```bash
cd company-portal
bun install
bun run build:website   # 产物在 apps/website/out/，静态站
bun run build:console   # 控制台是服务端渲染，需要服务器上常驻 node
```

> ⚠️ **官网打包必须带上后端地址**，否则 27 个模型的价签会全部变成「以控制台为准」：
>
> ```bash
> PORTAL_API_BASE=http://127.0.0.1:4100 bun run build:website
> ```
>
> 原因：`apps/website/lib/pricing.ts` 在**构建时**从后端拉 `/api/pricing`，
> 默认地址是 `http://localhost:4100`；在服务器上构建而变量没给、或后端还没起，
> 拉不到就按「拿不到价格」处理，页面显示「以控制台为准」而不是编数字。

### 1.5 后台开关（部署后登录管理后台改，都是点点鼠标的事）

| 项 | 现在 | 上线要求 | 不动会怎样 |
|---|---|---|---|
| 系统名称 | `New API` | 改成 `TokenFlow` | 管理后台顶部还是上游名字 |
| 注册开关 | 开 | 开（但要配合下面两项） | — |
| 邮箱验证 | 关 | 建议开（需先配 SMTP） | 公网开放后被批量注册 |
| 人机验证 | 关 | 建议开（Turnstile 需先申请 key） | 同上 |
| 用户协议 | 关 | **必须开** | 用户没有同意依据 |
| 隐私政策 | 关 | **必须开** | 同上 |

> 前端协议勾选已经做了（2026-11-16：注册页必勾、登录页提示），
> 但后台这两个开关不打开，等于只有提示没有记录。

---

## 2. 必改清单（上线前逐条勾掉）

配置文件：`company/docker-compose.company.yml`

| # | 位置 | 现在 | 改成 | 不改的后果 |
|---|---|---|---|---|
| 1 | `postgres.environment.POSTGRES_PASSWORD`（约 L65） | `"123456"` | 强密码 `<DB_PASSWORD>` | 弱口令被扫库 |
| 2 | `new-api.environment.SQL_DSN`（约 L29） | `...root:123456@postgres...` | 密码与 1 **完全相同** | 只改一处 → 连不上库 |
| 3 | `redis.command --requirepass`（约 L50） | `123456` | 强密码 `<REDIS_PASSWORD>` | Redis 裸奔可被写文件 |
| 4 | `new-api.environment.REDIS_CONN_STRING`（约 L30） | `redis://:123456@redis:6379` | 与 3 **完全相同** | 同上，连不上 |
| 5 | `new-api.environment` | 无 | 新增 `SESSION_SECRET=<随机串>` | 重启掉登录、多实例互不认 |
| 6 | `new-api.ports`（约 L24） | `"4100:3000"` | `"127.0.0.1:4100:3000"` | 后端端口公网直连，绕过 nginx |
| 7 | `postgres.ports` | 已注释（正确） | 保持不映射 | 数据库暴露公网 |
| 8 | 后台管理员密码 | `root / 123456` | 登录后立刻改 | 后台被接管 |

生成密码与密钥：

```bash
openssl rand -base64 24   # 数据库 / Redis 密码
openssl rand -hex 32      # SESSION_SECRET
```

- [ ] 1–8 全部改完
- [ ] 密码里没有 `@ : / ?` 等会破坏 DSN 的字符；若有，改用一个干净密码

> **坑**：`POSTGRES_PASSWORD` 只在**数据卷为空、第一次初始化**时生效。
> 如果复用旧卷，改了密码也不会变，必须进库 `ALTER USER root WITH PASSWORD '...'`。
> 本次是**新服务器、新卷**，所以第一次起就是新密码——但别再复用旧卷。

---

## 3. 服务器初始化

```bash
sudo mkdir -p /opt/new-api/{data,logs}
# 把 docker-compose.company.yml 传到 /opt/new-api/docker-compose.yml（注意改名，方便后续命令）
# 把 company-newapi-0.4.0.tar.gz 传上去
sudo docker load < company-newapi-0.4.0.tar.gz
```

防火墙（只开这三个）：

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable && sudo ufw status
```

- [ ] 镜像 `docker images` 能看到 `company-newapi:0.4.0`
- [ ] 防火墙只放了 22 / 80 / 443

---

## 4. 启动后端并导入数据

顺序很重要：**先起库 → 再导入 → 最后起应用**，否则应用会先跑自动建表，导入时冲突。

```bash
cd /opt/new-api
sudo docker compose up -d postgres redis        # 只起库和缓存
sudo docker compose ps                          # 等 postgres 变成 healthy
sudo docker exec -i postgres pg_restore -U root -d new-api --clean --if-exists < /path/to/new-api-YYYYMMDD.dump
sudo docker compose up -d                       # 再起后端
sudo docker compose ps                          # new-api 应变成 healthy
```

- [ ] `curl -s http://127.0.0.1:4100/api/status` 返回 `{"success":true,...}`

---

## 5. 前端部署

三个名字各一份 nginx 配置：

- `tokenflow365.com` → 静态目录（`apps/website/out/` 的内容，放到 `/var/www/tokenflow`）
- `console.tokenflow365.com` → 反代到 `127.0.0.1:4102`（控制台 node 进程）
- `api.tokenflow365.com` → 反代到 `127.0.0.1:4100`（后端）

控制台常驻进程（任选其一）：

```bash
cd company-portal/apps/console
bun install --production
PORT=4102 bun run start        # 用 pm2 或 systemd 托管
```

证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tokenflow365.com -d api.tokenflow365.com -d console.tokenflow365.com
```

- [ ] 三个域名 https 都能打开，证书有效期正常
- [ ] 官网页面里的 API 地址显示 `https://api.tokenflow365.com/v1`

---

## 6. 验收（不通过不算搬完）

- [ ] 数量对账：四个数字与 1.2 抄下的完全一致
- [ ] 后台能登录（新密码），渠道列表在、模型价格在
- [ ] 控制台：登录 → 新建一个 Key → 用它调一次 `/v1/chat/completions` 成功
- [ ] 官网：首页 / 价格 / 模型广场 / 文档 / 关于 五个页面 200
- [ ] 页脚：版权行是公司主体，「源代码」跳到 `.../tree/company-v0.2.0`
- [ ] 时间：控制台消费记录时间是北京时间（差 8 小时说明 TZ 没生效）
- [ ] 备份：手动跑一次 7.1 的脚本，能生成文件

---

## 7. 备份与回滚

### 7.1 每日备份（cron）

```bash
# /etc/cron.d/new-api-backup
0 3 * * * root docker exec postgres pg_dump -U root -d new-api -Fc -f /tmp/daily.dump && docker cp postgres:/tmp/daily.dump /opt/backup/new-api-$(date +\%Y\%m\%d).dump && find /opt/backup -name 'new-api-*.dump' -mtime +7 -delete
```

### 7.2 回滚代码

镜像 tag 保留上一版，回滚只改 compose 里 `image:` 一行再 `docker compose up -d`。

### 7.3 回滚数据

```bash
sudo docker compose stop new-api
sudo docker exec -i postgres pg_restore -U root -d new-api --clean --if-exists < /opt/backup/xxx.dump
sudo docker compose start new-api
```

---

## 8. 常见坑（都踩过或差点踩）

1. **密码只改一处** → 后端起来就报连不上数据库。`POSTGRES_PASSWORD` 与 `SQL_DSN` 必须同值，Redis 同理。
2. **复用旧数据卷改密码无效** → 见第 2 节末尾的坑。
3. **先起应用再导入数据** → 自动建表与 dump 打架，导入失败或数据缺。
4. **`pg_data` 是 Docker 命名卷** → 服务器重装系统就没了，必须靠 7.1 的 dump，不能只靠卷。
5. **端口直通** → compose 里 `4100:3000` 默认绑在 `0.0.0.0`，公网可绕过 nginx 直连，务必改 `127.0.0.1:4100:3000`。
6. **时区** → compose 已带 `TZ=Asia/Shanghai`，若日志时间差 8 小时，先查这行有没有被删。
7. **上传大小限制** → 控制台有导入/上传时，nginx 默认 1MB 会 413，加 `client_max_body_size 20m;`。
8. **AGPL 入口** → 上线后页脚「源代码」必须能点到对应版本；发版时同步改 `apps/website/lib/brand.ts` 的 `sourceVersion`。
9. **改价不会自动同步到官网** → 官网是静态导出，价格是**打包那一刻**的快照。后台调价后必须重新 `build:website` 并重新上传，否则官网还是旧价。发版记录里要写清"官网快照日期"。

---

## 附：本次发版记录（填完存档）

| 项 | 值 |
|---|---|
| 公司版本号 | company-v0.2.0 |
| 官方版本 | v1.0.0-rc.51 |
| 后端 Commit | `e5887bab` |
| 补丁号 | P-001（主题色）、P-002（同设备重登作废旧会话） |
| Portal 版本 | 待填（前端仓库 tag） |
| 数据库迁移 | 无结构变更，`pg_dump` 整库迁移 |
| Docker 镜像 | `company-newapi:0.4.0` |
