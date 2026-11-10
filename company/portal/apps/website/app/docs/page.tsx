import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { MODEL_CATALOG } from '@/lib/model-catalog';
import { loadModelList } from '@/lib/pricing';
import { DocsContent } from './docs-content';

export const metadata = { title: '文档' };

/**
 * 开发者文档 —— 文档 4.1「文档页面」。
 *
 * 可用模型列表与模型广场共用同一份数据源（模型目录 ∩ 后端 /api/pricing），
 * 保证文档里写的模型名真的能调用（文档 9.1「文档示例可实际调用」）。
 */
export default async function DocsPage() {
  const { models } = await loadModelList(MODEL_CATALOG);

  return (
    <>
      <SiteHeader />
      <DocsContent models={models} />
      <SiteFooter />
    </>
  );
}
