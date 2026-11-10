import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 官网是内容站，走静态导出更稳、更快、能直接上 CDN。
  // 需要服务端能力（如在线文档搜索）时改回默认模式。
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
