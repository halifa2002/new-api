import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { ModelsClient } from './models-client';
import { MODEL_CATALOG } from '@/lib/model-catalog';
import { loadModelList } from '@/lib/pricing';

export const metadata = { title: '模型广场' };

/**
 * 模型广场。
 *
 * 模型清单与价格在构建时从后端 /api/pricing 拉取，再和本地模型目录取交集：
 * 后端没有的模型不展示（文档 4.2），价格也不在前端写死（文档 4.1）。
 */
export default async function ModelsPage() {
  const { models, pricingAvailable } = await loadModelList(MODEL_CATALOG);

  return (
    <>
      <SiteHeader />
      <ModelsClient models={models} pricingAvailable={pricingAvailable} />
      <SiteFooter />
    </>
  );
}
