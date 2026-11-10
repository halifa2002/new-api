/**
 * 价格解析与换算（官网与控制台共用）。
 *
 * 全部来自后端 /api/pricing 与 /api/status，前端不写死任何单价。
 *
 * 后端两种计费模式都要支持：
 * 1. tiered_expr —— 分时动态计费，价格写在表达式里（本平台当前用的就是这种）
 *    形如 tier("peak", p * 0.3 + cr * 0.006 + c * 1.2)
 * 2. ratio —— 传统倍率计费，USD/百万 = model_ratio × 2（官方前端同款换算）
 *
 * 金额换算：
 *   quota 数量 ÷ quota_per_unit = 美元
 *   美元 × usd_exchange_rate = 人民币
 *
 * 这里只放纯函数；拉数据由调用方负责（官网构建时拉、控制台运行时拉）。
 */

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

export type Conversion = { quotaPerUsd: number; usdToCny: number };

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

/** 卡片上的一行摘要：分时取最高峰与最低谷两档，非分时给单一价格 */
export function summarizePrice(price: ModelPrice): {
  text: string;
  hint?: string;
} {
  if (price.mode === 'tiered') {
    const inputs = price.tiers.map((t) => t.inputPerM);
    const high = Math.max(...inputs);
    const low = Math.min(...inputs);
    return {
      text:
        high === low
          ? `${formatCnyPerMillion(high)} / 百万`
          : `${formatCnyPerMillion(low)}–${formatCnyPerMillion(high)} / 百万`,
      hint: '分时计价',
    };
  }
  if (price.mode === 'flat') {
    return {
      text: `${formatCnyPerMillion(price.inputPerM)} / 百万`,
    };
  }
  return { text: '暂未定价' };
}
