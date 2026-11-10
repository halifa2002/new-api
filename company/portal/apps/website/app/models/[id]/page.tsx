import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { MODEL_CATALOG } from '@/lib/model-catalog';
import { loadModelList } from '@/lib/pricing';
import { ModelDetail } from './model-detail';

type PageProps = { params: Promise<{ id: string }> };

/** 静态导出必须列出所有详情页路径 */
export function generateStaticParams() {
  return MODEL_CATALOG.map((entry) => ({ id: entry.id }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const entry = MODEL_CATALOG.find((item) => item.id === id);

  if (!entry) return { title: '模型详情' };

  return {
    title: `${entry.displayName} 模型详情`,
    description: entry.description,
  };
}

/**
 * 模型详情页。
 *
 * 和列表页用同一份数据：模型目录 ∩ 后端 /api/pricing。
 * 目录里有但后端已经下线的模型，这里直接 404，避免展示不可用的服务。
 */
export default async function ModelDetailPage(props: PageProps) {
  const { id } = await props.params;
  const { models } = await loadModelList(MODEL_CATALOG);
  const model = models.find((item) => item.id === id);

  if (!model) notFound();

  return (
    <>
      <SiteHeader />
      <ModelDetail model={model} />
      <SiteFooter />
    </>
  );
}
