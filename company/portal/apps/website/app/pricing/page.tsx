import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { MODEL_CATALOG } from '@/lib/model-catalog';
import { loadModelList } from '@/lib/pricing';
import { PricingClient } from './pricing-client';

export const metadata = { title: '价格' };

/**
 * 价格页 —— 文档 4.1「定价页面」。
 *
 * 与模型广场共用同一份数据源（模型目录 ∩ 后端 /api/pricing），
 * 价格不在前端写死，后台调价后重新构建即同步。
 */
export default async function PricingPage() {
  const { models, pricingAvailable } = await loadModelList(MODEL_CATALOG);

  return (
    <>
      <SiteHeader />
      <PricingClient models={models} pricingAvailable={pricingAvailable} />
      <SiteFooter />
    </>
  );
}
