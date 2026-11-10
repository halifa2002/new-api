import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * 不规范化末尾斜杠：官方接口有 /api/token/ 这类带尾斜杠的路径。
   * 转发本身由 middleware.ts 完成（不用 rewrites，避免吃掉尾斜杠
   * 导致 Gin 301 回来、形成无限重定向）。
   */
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
