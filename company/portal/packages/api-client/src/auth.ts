/**
 * 认证相关接口
 * 官方路由来源：backend/router/api-router.go
 *
 * 官方认证模型（读 controller/user.go 得出）：
 *   登录 → data.access_token（放 Authorization: Bearer）
 *   令牌过期 → POST /api/user/auth/refresh，靠 HttpOnly 的 refresh cookie 换新令牌
 */

import { ApiError, http, request, setAccessToken, setRefreshHandler } from './client';
import type { LoginInput, LoginResponse, SelfUser } from '@portal/types';

/**
 * 用 refresh cookie 换新 access token，返回新令牌；换不到返回 null
 *
 * 并发去重：页面同时发多个请求时都会 401，只能触发一次刷新，
 * 否则后端的「刷新竞态保护」会返回 409。
 */
let pendingRefresh: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    try {
      // skipAuthRefresh：续期请求自己不能再触发续期，否则自己等自己、永远 pending
      const data = await request<{
        access_token?: string;
        token_type?: string;
      }>('/api/user/auth/refresh', { method: 'POST', skipAuthRefresh: true });
      if (data?.access_token) {
        setAccessToken(data.access_token);
        return data.access_token;
      }
      return null;
    } catch (error) {
      // 只有「明确的没有有效会话」才算掉登录。
      // 限流（429）、服务端错误（5xx）、网络异常都不能判定为掉登录——
      // 否则用户明明还登着，会因为一次限流被踢回登录页，等于被动退出登录。
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setAccessToken(null);
        return null;
      }
      throw error;
    } finally {
      pendingRefresh = null;
    }
  })();

  return pendingRefresh;
}

// 注入到请求层：任何接口遇到 401 都会先尝试续期一次
setRefreshHandler(refreshAccessToken);

/** POST /api/user/login —— 成功后保存令牌 */
export async function login(input: LoginInput): Promise<LoginResponse> {
  const data = await http.post<LoginResponse>('/api/user/login', input);
  if (data?.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

/** GET /api/user/logout */
export async function logout(): Promise<null> {
  try {
    return await http.get<null>('/api/user/logout');
  } finally {
    setAccessToken(null);
  }
}

/** POST /api/user/register */
export function register(input: {
  username: string;
  password: string;
  password2: string;
  email?: string;
  verification_code?: string;
  aff_code?: string;
}) {
  return http.post<null>('/api/user/register', input);
}

/** GET /api/user/self —— 当前登录用户（含余额、已用额度、请求次数） */
export function getSelf() {
  return http.get<SelfUser>('/api/user/self');
}

/** GET /api/status —— 站点公开配置（站点名、是否允许注册等） */
export function getStatus() {
  return http.get<Record<string, unknown>>('/api/status');
}

/**
 * 确保有可用登录态：
 * 页面刷新后内存里的令牌没了，但 refresh cookie 还在，用它静默续期。
 */
export async function ensureSession(): Promise<boolean> {
  const token = await refreshAccessToken();
  return Boolean(token);
}
