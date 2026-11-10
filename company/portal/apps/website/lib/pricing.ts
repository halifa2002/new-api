/**
 * 价格：全部来自后端 /api/pricing 与 /api/status，前端不写死任何单价。
 *
 * 后端两种计费模式都要支持：
 * 1. tiered_expr —— 分时动态计费，价格写在表达式里（本平台当前用的就是这种）
 *    形如 tier("peak", p * 0.3 + cr * 0.006 + c * 1.2)
 * 2. ratio —— 传统倍率计费，USD/百万 = model_ratio × 2（官方前端同款换算）
 *
 * 金额换算：
 *   quota 数量 ÷ quota_per_unit = 美元
 *   美元 × usd_exchange_rate = 人民币
 */

import type { ModelCatalogEntry } from './model-catalog';

const API_BASE = process.env.PORTAL_API_BASE ?? 'http://localhost:3000';

/** 后端 /api/pricing 的返回结构（只取用到的字段） */
export type PricingRow = {
  model_name: string;
  billing_mode?: string;
  billing_expr?: string;
  model_ratio?: number;
  completion_ratio?: number;
  quota_type?: number;
};

export type PriceTier = {
  key: string;
  label: string;
  /** 人民币 / 百万 token */
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
};

export type ModelPrice =
  | {
      mode: 'tiered';
      tiers: PriceTier[];
      /** 从表达式里解析出的时段说明；解析不出来时为 null */
      schedule: string | null;
    }
  | { mode: 'flat'; inputPerM: number; outputPerM: number }
  | { mode: 'unknown' };

export type ModelView = ModelCatalogEntry & { price: ModelPrice };

export type ModelListView = {
  models: ModelView[];
  /** 构建时拿不到后端价格时为 false，页面要提示而不是显示假数字 */
  pricingAvailable: boolean;
};

type Conversion = { quotaPerUsd: number; usdToCny: number };

const TIER_LABELS: Record<string, string> = {
  peak: '高峰时段',
  off_peak: '空闲时段',
};

/** 人民币金额格式化：一元以上保留两位，小额多给几位有效数字 */
export function formatCnyPerMillion(value: number): string {
  if (value >= 1) return `¥${value.toFixed(2)}`;
  if (value >= 0.01) return `¥${value.toFixed(3)}`;
  return `¥${value.toFixed(4)}`;
}

/** quota 系数 → 人民币/百万 token */
function toCnyPerMillion(coeff: number, conv: Conversion): number {
  return (coeff * 1_000_000 * conv.usdToCny) / conv.quotaPerUsd;
}

/** 从单个 tier 的表达式体里取某个变量的系数，取不到按 0 处理 */
function readCoefficient(body: string, symbol: 'p' | 'c' | 'cr'): number {
  const matched = body.match(new RegExp(`\\b${symbol}\\s*\\*\\s*([0-9]*\\.?[0-9]+)`));
  return matched ? Number(matched[1]) : 0;
}

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 从 tiered_expr 里读出「高峰时段是什么时候」，让人看得懂价格为什么有两个数。
 * 只认 weekday 范围 + 一到多段 hour 区间这种常见写法；读不准就返回 null，不猜。
 */
function describeSchedule(expr: string): string | null {
  const hourPattern = /hour\([^)]*\)\s*>=\s*(\d{1,2})\s*&&\s*hour\([^)]*\)\s*<\s*(\d{1,2})/g;
  const windows: string[] = [];
  let matched: RegExpExecArray | null;

  while ((matched = hourPattern.exec(expr)) !== null) {
    const pad = (value: number) => String(value).padStart(2, '0');
    windows.push(`${pad(Number(matched[1]))}:00–${pad(Number(matched[2]))}:00`);
  }

  if (windows.length === 0) return null;

  const weekdayMatch = expr.match(
    /weekday\([^)]*\)\s*>=\s*(\d)\s*&&\s*weekday\([^)]*\)\s*<=\s*(\d)/
  );

  let dayText = '';
  if (weekdayMatch) {
    const from = Number(weekdayMatch[1]);
    const to = Number(weekdayMatch[2]);
    if (from === 1 && to === 5) {
      dayText = '工作日';
    } else if (from === 1 && to === 7) {
      dayText = '每天';
    } else if (WEEKDAY_NAMES[from] && WEEKDAY_NAMES[to]) {
      dayText = `${WEEKDAY_NAMES[from]}至${WEEKDAY_NAMES[to]}`;
    }
  }

  // 每个模型自带时段，不再输出「全表通用」的说法——不同模型的时段可能不一样，
  // 也有根本不分时的模型，那类模型的 schedule 会是 null。
  return `${dayText ? `${dayText} ` : ''}${windows.join('、')} 为高峰，其余为空闲`;
}

/** 把 tier("name", 表达式) 拆成每个档位的单价 */
function parseTieredExpression(expr: string, conv: Conversion): PriceTier[] {
  const heads: Array<{ key: string; start: number }> = [];
  const headPattern = /tier\(\s*"([^"]+)"/g;
  let matched: RegExpExecArray | null;

  while ((matched = headPattern.exec(expr)) !== null) {
    heads.push({ key: matched[1], start: matched.index });
  }

  return heads.map((head, index) => {
    const end = index + 1 < heads.length ? heads[index + 1].start : expr.length;
    const body = expr.slice(head.start, end);
    return {
      key: head.key,
      label: TIER_LABELS[head.key] ?? head.key,
      inputPerM: toCnyPerMillion(readCoefficient(body, 'p'), conv),
      outputPerM: toCnyPerMillion(readCoefficient(body, 'c'), conv),
      cacheReadPerM: toCnyPerMillion(readCoefficient(body, 'cr'), conv),
    };
  });
}

export function computePrice(row: PricingRow, conv: Conversion): ModelPrice {
  if (row.billing_mode === 'tiered_expr' && row.billing_expr) {
    const tiers = parseTieredExpression(row.billing_expr, conv);
    if (tiers.length > 0) {
      return { mode: 'tiered', tiers, schedule: describeSchedule(row.billing_expr) };
    }
  }

  if (typeof row.model_ratio === 'number' && row.model_ratio > 0) {
    const inputUsdPerM = row.model_ratio * 2;
    const outputUsdPerM = inputUsdPerM * (row.completion_ratio ?? 1);
    return {
      mode: 'flat',
      inputPerM: inputUsdPerM * conv.usdToCny,
      outputPerM: outputUsdPerM * conv.usdToCny,
    };
  }

  return { mode: 'unknown' };
}

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
