/**
 * 价格计算单元测试
 *
 * 只测纯函数：computePrice（含表达式解析与 quota→人民币换算）和 formatCnyPerMillion。
 * 这部分是官网价格的唯一来源，算错一个系数，页面上所有模型的价格都会错，
 * 所以必须有测试兜住。
 *
 * 运行：npm run test:unit
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Node 原生 ESM 解析要求带扩展名；tsconfig 已开 allowImportingTsExtensions
import { computePrice, formatCnyPerMillion } from '../pricing.ts';

/** 与线上一致的换算参数（取自 /api/status） */
const CONV = { quotaPerUsd: 500000, usdToCny: 7.3 };

/** 线上真实使用的分时表达式（deepseek-flash） */
const FLASH_EXPR =
  'weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ' +
  '((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || ' +
  '(hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18)) ? ' +
  'tier("peak", p * 0.3 + cr * 0.006 + c * 1.2) : ' +
  'tier("off_peak", p * 0.15 + cr * 0.003 + c * 0.6)';

function assertClose(actual: number, expected: number, message: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}：期望 ${expected}，实际 ${actual}`
  );
}

test('分时表达式解析出两个档位', () => {
  const price = computePrice(
    { model_name: 'deepseek-flash', billing_mode: 'tiered_expr', billing_expr: FLASH_EXPR },
    CONV
  );

  assert.equal(price.mode, 'tiered');
  if (price.mode !== 'tiered') return;

  assert.equal(price.tiers.length, 2);
  assert.deepEqual(
    price.tiers.map((tier) => tier.key),
    ['peak', 'off_peak']
  );
  assert.deepEqual(
    price.tiers.map((tier) => tier.label),
    ['高峰时段', '空闲时段']
  );
});

test('高峰档单价换算正确（系数 0.3 / 1.2 / 0.006）', () => {
  const price = computePrice(
    { model_name: 'deepseek-flash', billing_mode: 'tiered_expr', billing_expr: FLASH_EXPR },
    CONV
  );
  if (price.mode !== 'tiered') throw new Error('应为 tiered');

  const peak = price.tiers[0];
  // 0.3 * 1e6 / 500000 * 7.3 = 4.38
  assertClose(peak.inputPerM, 4.38, '高峰输入');
  // 1.2 * 1e6 / 500000 * 7.3 = 17.52
  assertClose(peak.outputPerM, 17.52, '高峰输出');
  // 0.006 * 1e6 / 500000 * 7.3 = 0.0876
  assertClose(peak.cacheReadPerM, 0.0876, '高峰缓存命中');
});

test('空闲档单价是高峰的一半', () => {
  const price = computePrice(
    { model_name: 'deepseek-flash', billing_mode: 'tiered_expr', billing_expr: FLASH_EXPR },
    CONV
  );
  if (price.mode !== 'tiered') throw new Error('应为 tiered');

  const [peak, offPeak] = price.tiers;
  assertClose(offPeak.inputPerM, 2.19, '空闲输入');
  assertClose(offPeak.outputPerM, 8.76, '空闲输出');
  assertClose(offPeak.cacheReadPerM, 0.0438, '空闲缓存命中');
  assertClose(offPeak.inputPerM, peak.inputPerM / 2, '空闲输入应为高峰一半');
});

test('从表达式解析出高峰时段描述', () => {
  const price = computePrice(
    { model_name: 'deepseek-flash', billing_mode: 'tiered_expr', billing_expr: FLASH_EXPR },
    CONV
  );
  if (price.mode !== 'tiered') throw new Error('应为 tiered');

  assert.equal(price.schedule, '工作日 09:00–12:00、14:00–18:00 为高峰，其余为空闲');
});

test('不同模型的时段各自独立，不会互相串', () => {
  // 每行价格自带时段，页面不再输出「全表通用」的说明。
  // 注意：时段解析只认 hour() >= a && hour() < b 这种写法，与官方计费表达式一致。
  const night = computePrice(
    {
      model_name: 'night-owl',
      billing_mode: 'tiered_expr',
      billing_expr:
        'hour("Asia/Shanghai") >= 20 && hour("Asia/Shanghai") < 23 ? ' +
        'tier("peak", p * 0.2 + c * 0.8) : tier("off_peak", p * 0.1 + c * 0.4)',
    },
    CONV
  );
  if (night.mode !== 'tiered') throw new Error('应为 tiered');

  assert.equal(night.schedule, '20:00–23:00 为高峰，其余为空闲');
  assert.notEqual(
    night.schedule,
    '工作日 09:00–12:00、14:00–18:00 为高峰，其余为空闲',
    '不同模型的时段描述不应相同'
  );
});

test('不分时的模型没有时段描述，页面只显示单一档位', () => {
  const flatTier = computePrice(
    {
      model_name: 'flat-tier',
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p * 0.1 + c * 0.4)',
    },
    CONV
  );
  if (flatTier.mode !== 'tiered') throw new Error('应为 tiered');

  assert.equal(flatTier.tiers.length, 1, '只有一档');
  assert.equal(flatTier.schedule, null, '没有时间条件时不应编造时段');
});

test('表达式读不出档位时退回倍率模式', () => {
  const price = computePrice(
    {
      model_name: 'legacy',
      billing_mode: 'tiered_expr',
      billing_expr: 'this-is-not-a-tier-expression',
      model_ratio: 37.5,
      completion_ratio: 1,
    },
    CONV
  );

  assert.equal(price.mode, 'flat');
  if (price.mode !== 'flat') return;

  // 官方换算：USD/百万 = model_ratio × 2；再乘汇率
  assertClose(price.inputPerM, 37.5 * 2 * 7.3, '倍率模式输入');
  assertClose(price.outputPerM, 37.5 * 2 * 7.3, '倍率模式输出');
});

test('倍率模式尊重 completion_ratio', () => {
  const price = computePrice(
    { model_name: 'legacy', model_ratio: 1, completion_ratio: 4 },
    CONV
  );
  if (price.mode !== 'flat') throw new Error('应为 flat');

  assertClose(price.inputPerM, 2 * 7.3, '输入 = ratio × 2 × 汇率');
  assertClose(price.outputPerM, 2 * 7.3 * 4, '输出 = 输入 × completion_ratio');
});

test('既无表达式也无倍率时返回 unknown，不猜价格', () => {
  const price = computePrice({ model_name: 'mystery' }, CONV);

  assert.equal(price.mode, 'unknown');
});

test('model_ratio 为 0 时不当作有效倍率', () => {
  const price = computePrice({ model_name: 'zero', model_ratio: 0 }, CONV);

  assert.equal(price.mode, 'unknown');
});

test('金额格式化：大于 1 元保留两位', () => {
  assert.equal(formatCnyPerMillion(4.38), '¥4.38');
  assert.equal(formatCnyPerMillion(17.52), '¥17.52');
  assert.equal(formatCnyPerMillion(1), '¥1.00');
});

test('金额格式化：小额多给有效数字', () => {
  assert.equal(formatCnyPerMillion(0.0876), '¥0.088');
  assert.equal(formatCnyPerMillion(0.0438), '¥0.044');
  assert.equal(formatCnyPerMillion(0.0005), '¥0.0005');
});
