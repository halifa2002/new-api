/**
 * 用量与消费记录接口
 * 官方路由：/api/log/self*
 */

import { http } from './client';
import type { PageResult, UsageLog, UsageStat } from '@portal/types';

/**
 * GET /api/log/self —— 消费明细
 * 官方参数：p（页码）、page_size、type、start_timestamp、end_timestamp、model_name、token_name
 */
export function listUsageLogs(params: {
  page?: number;
  page_size?: number;
  type?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  model_name?: string;
  token_name?: string;
  group?: string;
} = {}) {
  return http.get<PageResult<UsageLog>>('/api/log/self', {
    p: params.page ?? 1,
    page_size: params.page_size ?? 20,
    type: params.type,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    model_name: params.model_name,
    token_name: params.token_name,
    group: params.group,
  });
}

/** GET /api/log/self/stat —— 区间用量统计（额度、RPM、TPM） */
export function getUsageStat(params: {
  type?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  model_name?: string;
  token_name?: string;
} = {}) {
  return http.get<UsageStat>('/api/log/self/stat', {
    type: params.type,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    model_name: params.model_name,
    token_name: params.token_name,
  });
}
