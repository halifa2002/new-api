# deploy（前端）

官网与控制台的构建产物怎么放到服务器上。

- **官网**：Next.js 静态导出，产物在 `apps/website/out/`，由 nginx 直接托管。
- **控制台**：Next.js 服务端渲染，需要常驻进程（PM2 或 systemd），nginx 反代到它。

服务器上的 nginx 配置、域名与证书在仓库根的 `company/deploy/nginx/`，不在这里重复。

详细的部署步骤见 `company/DEPLOY.md`。
