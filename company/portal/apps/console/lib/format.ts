/**
 * 金额与时间格式化
 *
 * 单一真源在 `@portal/api-client/src/format.ts`（md 第六章原则 4）。
 * 这里只做转出，保留 `@/lib/format` 这个历史导入路径，页面不用改。
 */

export {
  ensureMoneySettings,
  moneyUnit,
  quotaToAmount,
  quotaToAmountValue,
  usdToDisplay,
  amountToQuota,
  formatTime,
  formatNumber,
} from '@portal/api-client';

/**
 * 官方 group 字段是「计费分组」：不同分组的价格倍率与可用模型不同，由管理员分配，用户改不了。
 * 直接给用户看 `default` 等于甩了个内部词，这里换成「标准档 / xx 档」。
 * 注意：分组名是后端配置的，除了 default 之外一律原样显示，不猜语义。
 */
export function groupLabel(group: string | undefined | null): string {
  if (!group || group === 'default') return '标准档';
  return `${group} 档`;
}
