/**
 * 官方 New API 接口数据类型
 *
 * 字段来源：直接读官方 Go 结构体与 controller 返回值，不是猜的。
 * - 用户：backend/controller/user.go  buildSelfUserData
 * - Key：backend/model/token.go  Token
 * - 日志：backend/model/log.go  Log
 *
 * ⚠️ 金额单位：官方用整数 quota，不是元。换算比例由后端 QuotaPerUnit 决定
 *    （默认 500000 quota = 1 单位货币），前端必须从后端取配置，不能写死。
 */

export * from './model-catalog';

/** 官方统一响应信封 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** 分页结构，官方 common.PageInfo */
export interface PageResult<T> {
  page: number;
  page_size: number;
  total: number;
  items: T[];
}

/** GET /api/user/self —— 当前登录用户 */
export interface SelfUser {
  id: number;
  username: string;
  display_name: string;
  has_password: boolean;
  /** 1=普通用户 10=管理员 100=超级管理员 */
  role: number;
  /** 1=启用 2=禁用 */
  status: number;
  email: string;
  group: string;
  /** 剩余额度（quota 整数） */
  quota: number;
  /** 已用额度 */
  used_quota: number;
  request_count: number;
  aff_code: string;
  aff_count: number;
  aff_quota: number;
  aff_history_quota: number;
  inviter_id: number;
  setting: string;
  sidebar_modules: string;
  permissions: Record<string, boolean | unknown>;
  [key: string]: unknown;
}

/** /api/token/ —— API Key */
export interface Token {
  id: number;
  user_id: number;
  /** 打码后的 key，完整值需单独调 POST /api/token/:id/key */
  key: string;
  /** 1=启用 2=禁用 3=已过期 4=额度耗尽 */
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  /** -1 表示永不过期 */
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  model_limits_enabled: boolean;
  /** 逗号分隔的模型名 */
  model_limits: string;
  allow_ips: string | null;
  used_quota: number;
  group: string;
  cross_group_retry: boolean;
  allow_user_quota_query: boolean;
}

/** 创建/更新 Key 的请求体 */
export interface TokenInput {
  name: string;
  remain_quota: number;
  unlimited_quota: boolean;
  expired_time: number;
  model_limits_enabled: boolean;
  model_limits: string;
  group?: string;
  allow_ips?: string;
}

/** GET /api/log/self —— 消费明细 */
export interface UsageLog {
  id: number;
  user_id: number;
  created_at: number;
  /** 日志类型：1=充值 2=消费 3=管理 4=系统 */
  type: number;
  content: string;
  username: string;
  token_name: string;
  model_name: string;
  /** 本条消耗的 quota，负数表示消费 */
  quota: number;
  prompt_tokens: number;
  completion_tokens: number;
  /** 耗时（秒） */
  use_time: number;
  is_stream: boolean;
  channel: number;
  channel_name: string;
  token_id: number;
  group: string;
  ip: string;
  request_id?: string;
}

/** GET /api/log/self/stat —— 用量统计 */
export interface UsageStat {
  quota: number;
  rpm: number;
  tpm: number;
  [key: string]: unknown;
}

/** GET /api/user/models —— 当前用户可用模型 */
export interface ModelInfo {
  id?: number;
  model_name: string;
  description?: string;
  /** 输入价格倍率 */
  ratio?: number;
  /** 补全价格倍率 */
  completion_ratio?: number;
  /** 是否可启用 */
  enable_groups?: string[];
  [key: string]: unknown;
}

/** 登录请求 */
export interface LoginInput {
  username: string;
  password: string;
}

/**
 * 登录/刷新返回
 * 官方 controller/user.go writeLoginResponse：
 * data = { access_token, token_type, access_expires_at, session, user }
 */
export interface LoginResponse {
  /** 访问令牌，之后每个请求都要放在 Authorization: Bearer <token> */
  access_token: string;
  token_type: string;
  access_expires_at: number;
  session: {
    id?: string;
    login_method?: string;
    [key: string]: unknown;
  };
  user: SelfUser;
}
