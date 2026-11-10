/**
 * API Key 管理接口
 * 官方路由：/api/token/
 */

import { http } from './client';
import type { PageResult, Token, TokenInput } from '@portal/types';

/** GET /api/token/ —— 分页列出自己的 Key（key 字段已打码） */
export function listTokens(params: { page?: number; page_size?: number } = {}) {
  return http.get<PageResult<Token>>('/api/token/', {
    p: params.page ?? 1,
    page_size: params.page_size ?? 10,
  });
}

/** POST /api/token/ —— 新建 Key */
export function createToken(input: TokenInput) {
  return http.post<null>('/api/token/', input);
}

/** PUT /api/token/ —— 更新 Key（需带 id） */
export function updateToken(input: Partial<TokenInput> & { id: number }) {
  return http.put<null>('/api/token/', input);
}

/** DELETE /api/token/:id —— 删除 Key */
export function deleteToken(id: number) {
  return http.delete<null>(`/api/token/${id}`);
}

/**
 * POST /api/token/:id/key —— 取完整 Key
 * 安全：后端有频率限制，前端不得缓存或写日志
 */
export function revealTokenKey(id: number) {
  return http.post<{ key: string }>(`/api/token/${id}/key`);
}
