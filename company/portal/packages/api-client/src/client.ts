/**
 * 统一请求客户端
 *
 * md 第六章要求：认证、错误码、分页、时间金额格式统一在这里处理，
 * 页面组件里不允许直接写 fetch。
 */

import type { ApiEnvelope } from '@portal/types';

/**
 * 后端地址：
 * - 默认走同域相对路径（控制台用 Next rewrites 把 /api 转发到官方后端），
 *   这样 cookie 是同域的，不需要后端开 CORS。
 * - 需要直连时用 NEXT_PUBLIC_API_BASE 覆盖成 http://localhost:3000。
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** 后端返回的业务错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** 需要携带登录态时开启（默认开启，同域 cookie 自动带） */
  withCredentials?: boolean;
  signal?: AbortSignal;
  /**
   * 本请求遇到 401 时不触发令牌续期。
   *
   * 只给「续期请求本身」用。否则会出现自我死锁：续期请求也返回 401 时，
   * 它又会去调 refreshHandler，而 refreshHandler 返回的正是当前正在等的
   * 那个 promise —— 于是永远 pending，页面卡在「加载中」不跳登录页。
   */
  skipAuthRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // 不依赖 new URL()，这样 API_BASE 为空（同域相对路径）时也能用
  const base = path.startsWith('http') ? path : `${API_BASE}${path}`;
  if (!query) return base;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

/**
 * 访问令牌管理
 *
 * 官方认证是「access token（放请求头）+ refresh cookie（HttpOnly）」双轨：
 * - 登录返回 access_token，之后每个请求带 Authorization: Bearer <token>
 * - access token 过期后，用 refresh cookie 换新 token，再重试原请求
 */
let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** 由 auth 模块注入「用 refresh cookie 换新 token」的实现，避免循环依赖 */
export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

interface SendOptions extends RequestOptions {
  /** 内部标记：本次是刷新令牌后的重试，防止无限递归 */
  retried?: boolean;
}

async function send<T>(path: string, options: SendOptions): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    withCredentials = true,
    signal,
    retried = false,
  } = options;

  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: withCredentials ? 'include' : 'same-origin',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? `网络请求失败：${error.message}` : '网络请求失败',
      0,
    );
  }

  // 401：先用 refresh cookie 换一次令牌再重试，换不到才算真的掉登录。
  // 续期本身报错（限流 / 网络 / 5xx）不能吞成 null —— 那不代表掉登录，
  // 吞掉会让页面把用户踢回登录页，等于「被动退出登录」。
  if (response.status === 401 && !retried && refreshHandler && !options.skipAuthRefresh) {
    const fresh = await refreshHandler();
    if (fresh) {
      return send<T>(path, { ...options, retried: true });
    }
    throw new ApiError('登录已失效，请重新登录', 401);
  }

  if (response.status === 401) {
    throw new ApiError('登录已失效，请重新登录', 401);
  }

  // 官方对接口有频率限制，429 时给一句人能看懂的话，而不是原始状态码
  if (response.status === 429) {
    throw new ApiError('操作太频繁了，等十几秒再点一次', 429);
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // 非 JSON 响应（例如反向代理返回的 HTML 错误页）
    if (!response.ok) {
      throw new ApiError(`请求失败（HTTP ${response.status}）`, response.status);
    }
    throw new ApiError('响应格式异常', response.status);
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message || `请求失败（HTTP ${response.status}）`,
      response.status,
    );
  }

  return payload.data;
}

/**
 * 发请求并解包官方信封 { success, message, data }。
 * 失败统一抛 ApiError，页面只需 try/catch 一次。
 */
export function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return send<T>(path, options);
}

/** 便捷方法 */
export const http = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body }),
};
