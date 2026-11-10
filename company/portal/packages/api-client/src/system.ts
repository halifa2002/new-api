/**
 * 系统状态接口
 * 官方路由：GET /api/status（公开，不需要登录）
 *
 * 控制台需要的金额换算全在这里：
 *   quota_per_unit      1 单位货币等于多少 quota（官方默认 500000）
 *   usd_exchange_rate   1 美元折合多少人民币
 *   display_in_currency true 时按人民币显示（前端乘汇率），false 时按美元显示
 *
 * 2026-11-10 之前控制台把 quota/500000 直接当人民币显示，没乘汇率，
 * 后端配了 7.3 的汇率时金额会少算 7 倍多。
 */

import { http } from './client';

export interface SystemStatus {
  quota_per_unit?: number;
  usd_exchange_rate?: number;
  display_in_currency?: boolean;
  system_name?: string;
  [key: string]: unknown;
}

/** GET /api/status —— 系统状态与金额换算参数 */
export function getStatus() {
  return http.get<SystemStatus>('/api/status');
}
