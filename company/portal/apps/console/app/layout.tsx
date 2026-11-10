import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '控制台',
  description: '管理 API 密钥、查看用量与账单',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
