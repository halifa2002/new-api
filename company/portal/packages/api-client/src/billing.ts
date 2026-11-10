/**
 * 充值与账单接口
 * 官方路由：/api/user/topup*
 *
 * ⚠️ md 4.2 G：优先沿用官方充值能力，不自己发明支付逻辑。
 *    官方已内置 Epay / Stripe / Creem / Waffo 等通道，这里只做入口。
 */

import { http } from './client';

export interface TopUpInfo {
  /** 是否开启充值 */
  enable_online_topup?: boolean;
  /** 充值档位与赠送额度 */
  topup_group?: Record<string, number> | unknown[];
  /** 最小充值数量 */
  min_topup?: number;
  [key: string]: unknown;
}

/** GET /api/user/topup/info —— 充值配置（有哪些通道、档位） */
export function getTopUpInfo() {
  return http.get<TopUpInfo>('/api/user/topup/info');
}

/** GET /api/user/topup/self —— 我的充值记录 */
export function listMyTopUps(params: { page?: number; page_size?: number } = {}) {
  return http.get<unknown>('/api/user/topup/self', {
    p: params.page ?? 1,
    page_size: params.page_size ?? 20,
  });
}

/** POST /api/user/topup —— 用兑换码充值 */
export function redeemTopUpCode(key: string) {
  return http.post<unknown>('/api/user/topup', { key });
}
