/**
 * 模型相关接口
 * 官方路由：/api/user/models、/api/pricing
 */

import { http } from './client';
import type { ModelInfo } from '@portal/types';

/** GET /api/user/models —— 当前用户所在分组可用的模型名列表 */
export function listUserModels() {
  return http.get<string[]>('/api/user/models');
}

/** GET /api/pricing —— 模型价格表（官方计价规则，前端只展示不计算） */
export function listPricing() {
  return http.get<{
    data?: ModelInfo[];
    models?: ModelInfo[];
    usable_group?: Record<string, string>;
    [key: string]: unknown;
  }>('/api/pricing');
}
