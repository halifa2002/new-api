# 正式部署手册

> 对应领导文档「十二、最终交付要求」第 10 项。
> 适用对象：第一次把平台从本机搬到公网的人。按顺序做，每步都有验收方法。

---

## 一、开工前必须到位的四样

| 东西 | 具体要求 | 为什么 |
| --- | --- | --- |
| 服务器 | ≥2 核 4G，Ubuntu 22.04 或 24.04，公网 IP，root 或 sudo 权限 | 跑 Docker + Postgres + Redis 的最低配置 |
| 域名 | 至少一个主域名，且**能改 DNS 解析**（不是只有域名本身） | 解析改不了等于没有域名 |
| 备案 | 服务器在中国大陆则必须先完成 ICP 备案 | 未备案的国内服务器 80/443 会被拦 |
| 镜像 | `company-newapi:<版本>` 已构建并推到可访问的镜像仓库，或本机 `docker save` 出 tar | 服务器上要能拿到镜像 |

> 备案周期通常 1–3 周。若赶时间，可选香港/海外服务器免备案，代价是大陆访问延迟略高。

---

## 二、服务器准备

```bash
# 1. 更新系统
apt update && apt upgrade -y

# 2. 装 Docker（官方脚本）
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 3. 建目录（三端 + 数据都放这里）
mkdir -p /opt/company-ai/{backend,nginx/conf.d,nginx/certs,website}
```

**验收**：`docker version` 能看到 Client 和 Server 两段；`docker run --rm hello-world` 成功。

---

## 三、代码与镜像

### 3.1 后端镜像

镜像里已经包含官方后端二进制和改过配色的管理后台前端。**改过品牌色或 Logo 必须重新构建**
（官方镜像是预构建的，改本地文件不生效）。

```bash
# 在开发机或 CI 上构建
cd backend
docker build -f Dockerfile.company -t company-newapi:<版本号> .

# 推到你自己的镜像仓库
docker tag company-newapi:<版本号> registry.example.com/company-newapi:<版本号>
docker push registry.example.com/company-newapi:<版本号>
```

版本号规则见 `VERSION.md`，必须同时记录官方版本与 Commit SHA。

### 3.2 前端静态站

官网是 Next.js 静态导出，构建产物直接交给 nginx。

```bash
cd company/portal/apps/website
# 关键：这两个环境变量决定页面上显示的 API 地址和控制台地址
NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
NEXT_PUBLIC_CONSOLE_URL=https://console.example.com \
npm run build

# 产物在 out/，整个目录传到服务器
scp -r out/* root@<服务器IP>:/opt/company-ai/website/
```

> `NEXT_PUBLIC_API_BASE_URL` 不设的话，文档和模型详情页里的示例会显示占位域名
> `https://api.example.com`，用户复制了跑不通。

### 3.3 用户控制台

控制台是 Next.js 服务端渲染，需要常驻进程，见下一节的 compose 配置。

**验收**：`out/index.html` 存在；控制台 `npm run build` 无报错。

---

## 四、编排文件

在服务器 `/opt/company-ai/backend/` 放 `docker-compose.yml`：

```yaml
services:
  new-api:
    image: registry.example.com/company-newapi:<版本号>
    container_name: new-api
    restart: always
    command: --log-dir /app/logs
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - SQL_DSN=postgresql://root:<强密码>@postgres:5432/new-api
      - REDIS_CONN_STRING=redis://:<强密码>@redis:6379
      - TZ=Asia/Shanghai
      - SESSION_SECRET=<随机 32 位字符串>
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
    depends_on:
      - postgres
      - redis
    networks: [app-net]

  postgres:
    image: postgres:15
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: "<强密码>"
      POSTGRES_DB: new-api
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks: [app-net]

  redis:
    image: redis:latest
    container_name: redis
    restart: always
    command: ["redis-server", "--requirepass", "<强密码>"]
    networks: [app-net]

volumes:
  pg_data:

networks:
  app-net:
    driver: bridge
```

**三个必须改的地方**：数据库密码、Redis 密码、`SESSION_SECRET`。
后端起不来的第一嫌疑就是 `SQL_DSN` 里的密码没改。

> 端口不对外暴露——所有流量走 nginx，backend 只在 `app-net` 内部可达。

---

## 五、反向代理与证书

把仓库里的 `deploy/nginx/conf.d/site.conf` 复制到 `/opt/company-ai/nginx/conf.d/`，
把三处 `example.com` 换成真实域名：

| 域名 | 指向 | 说明 |
| --- | --- | --- |
| `admin.<域名>` | new-api:3000 | 后台，根路径自动跳 `/dashboard` |
| `api.<域名>` | new-api:3000 | 给客户程序调用的 API |
| `www.<域名>` | 静态目录 | 品牌官网 |

nginx 服务加进 compose：

```yaml
  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - ./website:/usr/share/nginx/html:ro
    networks: [app-net]
```

证书用 Let's Encrypt：

```bash
apt install -y certbot
# 先停 nginx 释放 80 端口，或用 webroot 方式
certbot certonly --standalone -d admin.example.com -d api.example.com -d www.example.com
cp /etc/letsencrypt/live/admin.example.com/fullchain.pem /opt/company-ai/nginx/certs/
cp /etc/letsencrypt/live/admin.example.com/privkey.pem  /opt/company-ai/nginx/certs/
```

然后按 `site.conf` 末尾注释，把三个 server 的 `listen 80` 改成 `listen 443 ssl`，
并加一个 80 跳 443 的 server。改完执行：

```bash
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

> **不要用 `docker restart nginx` 代替 reload**。Windows/挂载场景下 restart 有时仍用旧配置，
> 必须显式 `-s reload`。

---

## 六、DNS 解析

在所有域名下添加 A 记录指向服务器公网 IP：

```
admin    A    <服务器IP>
api      A    <服务器IP>
www      A    <服务器IP>
```

**���收**：`nslookup admin.example.com` 返回正确 IP；`curl -I https://admin.example.com`
返回 302 且 `Location: /dashboard`。

---

## 七、部署后验收

### 7.1 自动检查

```bash
# 在能访问后端的地方执行（Windows 用 scripts/smoke-test.ps1）
pwsh -File scripts/smoke-test.ps1 -BaseUrl https://api.example.com -ApiKey sk-xxx
```

必须「自动检查全部通过」才算过关。三项人工检查（后端编译、前端构建、镜像构建）在部署前已完成。

### 7.2 功能验收（文档 9.1）

**官网**
- [ ] 首页能打开
- [ ] 模型广场显示真实模型（当前 2 个）
- [ ] 价格页单价与后台计费配置一致
- [ ] 文档页示例里的域名是真实 API 域名，代码可复制运行

**用户侧**
- [ ] 注册 → 登录 → 建 Key → 调模型 → 扣费，全链路通
- [ ] 扣费金额与价格页一致
- [ ] 消费记录能查到刚才那一笔

**后台**
- [ ] `admin.<域名>` 打开直接进登录页（不是营销主页）
- [ ] 登录后能进控制台
- [ ] 用户、渠道、模型、日志四个菜单都能打开

---

## 八、常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 后端起不来，日志报数据库连接失败 | `SQL_DSN` 密码错，或 postgres 还没 ready | 看 `docker logs postgres`，确认健康后重启 new-api |
| 打开域名是 404 | nginx 没挂上 conf.d，或 server_name 不匹配 | `docker exec nginx nginx -T` 看生效配置 |
| 后台打开还是营销主页 | 访问的是 3000 端口直连，没走 nginx | 用域名访问，不要用 IP:3000 |
| 登录后立刻掉线 | 三个域名不同导致 cookie 不共享 | 确认控制台、后台各自独立子域名且 `X-Forwarded-Proto` 正确 |
| 页面示例里还是 `api.example.com` | 构建时没设 `NEXT_PUBLIC_API_BASE_URL` | 带上环境变量重新 `npm run build` |
| HTTPS 打开白屏、控制台报混合内容 | 页面里写死了 http 地址 | 检查环境变量与 nginx `X-Forwarded-Proto` |

---

## 九、上线后第一件事

```bash
# 立刻做一次数据库备份，并确认备份文件可读
docker exec postgres pg_dump -U root new-api > /opt/company-ai/backup-$(date +%F).sql
ls -lh /opt/company-ai/backup-*.sql
```

备份策略与回滚步骤见 `ROLLBACK.md`。
