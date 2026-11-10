/**
 * 账户设置接口
 * 官方路由：/api/user/self、/api/user/sessions
 */

import { http } from './client';

/** PUT /api/user/self —— 更新资料（显示名等） */
export function updateProfile(input: {
  display_name?: string;
  email?: string;
  [key: string]: unknown;
}) {
  return http.put<null>('/api/user/self', input);
}

/**
 * 修改密码
 *
 * 官方走 PUT /api/user/self，且字段名不是直觉的 old/new：
 *   后端 controller/user.go 的 UpdateSelf 读 `password`（新密码），
 *   并把 `original_password` 传给 model.ChangeUserPassword 做旧密码校验。
 *   传错字段名会静默失败或报 Invalid parameters。
 */
export function changePassword(input: {
  original_password: string;
  password: string;
}) {
  return http.put<null>('/api/user/self', input);
}

export interface LoginSession {
  sid: string;
  created_at: number;
  last_active_at?: number;
  expires_at?: number;
  ip?: string;
  user_agent?: string;
  /** 登录方式：password / oauth / 2fa 等，后端字段名是 login_method */
  login_method?: string;
  current?: boolean;
  [key: string]: unknown;
}

/**
 * GET /api/user/sessions —— 登录设备列表
 *
 * 官方返回的 data 是**数组**，不是 { items } 分页结构。
 * 2026-11-10 之前这里按 { items } 解，页面一直显示「暂无登录记录」——是真错，不是没数据。
 */
export function listSessions() {
  return http.get<LoginSession[]>('/api/user/sessions');
}

/** DELETE /api/user/sessions/:sid —— 踢掉某台设备 */
export function revokeSession(sid: string) {
  return http.delete<null>(`/api/user/sessions/${sid}`);
}

/** POST /api/user/sessions/revoke-others —— 踢掉其它所有设备 */
export function revokeOtherSessions() {
  return http.post<null>('/api/user/sessions/revoke-others');
}
