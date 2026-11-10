/**
 * 官网的价格入口。
 *
 * 解析与换算的算法放在 @portal/pricing（控制台的模型卡片也用同一套），
 * 这里只保留「构建时从后端拉数据」的部分。
 *
 * 金额换算：
 *   quota 数量 ÷ quota_per_unit = 美元
 *   美元 × usd_exchange_rate = 人民币
 */

import { computePrice, type Conversion, type PricingRow } from '@portal/pricing';
import type { ModelCatalogEntry } from './model-catalog';

export * from '@portal/pricing';

export type ModelView = ModelCatalogEntry & {
  price: import('@portal/pricing').ModelPrice;
};

export type ModelListView = {
  models: ModelView[];
  /** 构建时拿不到后端价格时为 false，页面要提示而不是显示假数字 */
  pricingAvailable: boolean;
};

const API_BASE = process.env.PORTAL_API_BASE ?? 'http://localhost:3000';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`${path} 返回 ${response.status}`);
  }
  return (await response.json()) as T;
}

type PricingPayload = { data?: PricingRow[] };
type StatusPayload = {
  data?: { quota_per_unit?: number; usd_exchange_rate?: number };
};

/**
 * 构建时从后端拉价格。失败不抛错——返回 null 让页面提示「价格以下单时为准」，
 * 而不是让整站构建失败或显示编造的数字。
 */
export async function loadModelList(catalog: ModelCatalogEntry[]): Promise<ModelListView> {
  try {
    const [pricing, status] = await Promise.all([
      fetchJson<PricingPayload>('/api/pricing'),
      fetchJson<StatusPayload>('/api/status'),
    ]);

    const conv: Conversion = {
      quotaPerUsd: status.data?.quota_per_unit ?? 500_000,
      usdToCny: status.data?.usd_exchange_rate ?? 7.3,
    };

    const rowsByName = new Map((pricing.data ?? []).map((row) => [row.model_name, row]));

    // 只保留后端真实存在的模型——这是文档 4.2「只有实际接入并验证的能力才能展示为可用服务」的落地
    const models = catalog
      .filter((entry) => rowsByName.has(entry.id))
      .map((entry) => ({
        ...entry,
        price: computePrice(rowsByName.get(entry.id) as PricingRow, conv),
      }));

    if (models.length === 0) {
      console.warn('[models] 后端没有返回任何与模型目录匹配的模型，页面将显示空状态');
    }

    return { models, pricingAvailable: true };
  } catch (error) {
    console.warn('[models] 拉取后端价格失败，本次构建不显示具体价格：', error);
    return {
      models: catalog.map((entry) => ({ ...entry, price: { mode: 'unknown' as const } })),
      pricingAvailable: false,
    };
  }
}
