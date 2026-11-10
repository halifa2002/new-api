/**
 * 金额与时间格式化（md 第六章原则 4：统一处理时间和金额格式）
 *
 * 放在 api-client 里而不是各端各写一份：官网和控制台以后都可能展示金额，
 * 两边必须用同一套换算式，否则同一个余额会显示成两个数。
 *
 * 官方用整数 quota 记账，金额怎么显示取决于后端 /api/status：
 *   quota_per_unit     = 500000  → 500000 quota 等于 1 单位货币
 *   usd_exchange_rate  = 7.3     → 1 美元折 7.3 人民币
 *   display_in_currency = true   → 按人民币显示（乘汇率），否则按美元显示
 *
 * 参数只在首次调用时拉一次；拉不到就用官方默认值兜底，不让页面白屏。
 */

import { getStatus } from './system';

/** 取不到后端参数时的兜底，与官方默认一致 */
const FALLBACK = { quotaPerUnit: 500_000, usdToCny: 1, displayInCurrency: false };

let money = { ...FALLBACK };
let loaded = false;
let loadingPromise: Promise<void> | null = null;

/**
 * 拉取金额换算参数（只成功拉一次）。
 * 页面在 load() 里 await 它，保证金额渲染时用的不是兜底值。
 */
export function ensureMoneySettings(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = getStatus()
      .then((status) => {
        money = {
          quotaPerUnit: Number(status.quota_per_unit) || FALLBACK.quotaPerUnit,
          usdToCny: Number(status.usd_exchange_rate) || 1,
          displayInCurrency: Boolean(status.display_in_currency),
        };
        loaded = true;
      })
      .catch(() => {
        // 拉不到就用兜底值，页面不能因为汇率接口挂了而白屏
        loaded = true;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

/** 当前金额单位：按人民币显示就是「元」，否则「美元」 */
export function moneyUnit(): string {
  return money.displayInCurrency ? '元' : '美元';
}

/** quota → 金额数字（不做格式化） */
export function quotaToAmountValue(quota: number | undefined | null): number {
  if (quota === undefined || quota === null || Number.isNaN(quota)) return 0;
  const usd = quota / money.quotaPerUnit;
  return money.displayInCurrency ? usd * money.usdToCny : usd;
}

/** quota → 金额字符串（带千分位，2~4 位小数） */
export function quotaToAmount(quota: number | undefined | null): string {
  if (quota === undefined || quota === null || Number.isNaN(quota)) return '—';
  return quotaToAmountValue(quota).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/**
 * 美元金额 → 当前展示货币的数值。
 * 用在模型详情这类「后端直接给美元价格」的地方（倍率 × 2 = 美元/百万 token），
 * 让它们和余额、账单用同一套汇率口径。
 */
export function usdToDisplay(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return money.displayInCurrency ? usd * money.usdToCny : usd;
}

/**
 * 金额 → quota，用在「给密钥限制额度」这种要用户填金额的地方。
 * 填的是当前单位（元或美元），内部按汇率折算回美元再乘 quota 系数。
 */
export function amountToQuota(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const usd = money.displayInCurrency ? amount / money.usdToCny : amount;
  return Math.round(usd * money.quotaPerUnit);
}

/** 时间戳（秒）格式化为本地时间 */
export function formatTime(ts: number | undefined | null): string {
  if (!ts) return '—';
  const date = new Date(ts * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 数字千分位 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('zh-CN');
}
