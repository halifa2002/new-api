import type { Metadata } from 'next';
import './globals.css';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  keywords: ['AI API', '大模型接口', 'API 聚合', '按量计费'],
  openGraph: {
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    type: 'website',
  },
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
