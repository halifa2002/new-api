# 数据库结构报告

> 对应领导文档第十章 Phase 0 交付物「数据库结构报告」。
> 数据直接取自运行中的 PostgreSQL，不是照代码推测。

## 采样环境

| 项目 | 值 |
| --- | --- |
| 采样时间 | 2026-11-10 15:30 |
| 数据库 | PostgreSQL 15，库名 `new-api`，schema `public` |
| 应用容器 | `new-api`，镜像 `calciumion/new-api:latest`（与版本记录不一致，见下方「部署现状」） |
| 表数量 | **38 张** |
| 字段总数 | 472 个 |
| 外键约束 | 0 条（官方不用数据库外键，表间关系全在代码里） |
| 主键/唯一索引 | 68 个 |

## 迁移机制

官方**没有迁移编号、没有迁移脚本目录**。启动时由 GORM 的 `AutoMigrate` 对比结构：缺表建表、缺字段加字段，已有数据不动。入口在 `backend/model/main.go`：

- 主库：`DB.AutoMigrate(...)`，一次登记 36 个模型，订阅套餐表单独补一次（SQLite 走另一条建表分支）。
- 日志库：`LOG_DB.AutoMigrate(&Log{})` 与审计日志表；配 ClickHouse 时改走建表 SQL 与 TTL 同步。

由此带来的三个事实：

1. **升级没有「迁移版本 42」这种锚点**，无法用编号还原某次部署的库状态。
2. 版本记录里用「表数量 + 备份时间」当锚点，见 `VERSION.md` 第 6 项。
3. 正式升级前必须整库备份，回滚靠还原备份，不靠反向迁移。

## 表清单

| # | 表名 | 字段数 | 行数（近似） | 用途 |
| ---: | --- | ---: | ---: | --- |
| 1 | `abilities` | 7 | 2 | 模型与渠道的可用性索引，决定某个模型请求路由到哪个渠道 |
| 2 | `audit_logs` | 19 | 47 | 管理操作审计日志 |
| 3 | `auth_flows` | 11 | 0 | 登录与第三方授权流程的临时状态 |
| 4 | `authz_roles` | 9 | 2 | Casbin 角色定义（细粒度权限） |
| 5 | `casbin_rule` | 8 | 3 | Casbin 权限规则本体 |
| 6 | `channels` | 30 | 1 | 上游渠道配置（密钥、地址、模型范围） |
| 7 | `checkins` | 5 | 0 | 用户每日签到记录 |
| 8 | `custom_oauth_providers` | 21 | 0 | 自定义 OAuth 登录源配置 |
| 9 | `external_identity_claims` | 5 | 0 | 外部身份与本地账号的绑定声明 |
| 10 | `login_encryption_keys` | 3 | 0 | 登录表单传输加密用的密钥对 |
| 11 | `logs` | 21 | 12 | 调用与消费日志（计费对账的主数据） |
| 12 | `midjourneys` | 24 | 0 | Midjourney 任务记录 |
| 13 | `models` | 13 | 0 | 模型元数据（名称、图标、归属厂商等） |
| 14 | `options` | 2 | 4 | 系统设置项，键值存储 |
| 15 | `passkey_credentials` | 19 | 0 | Passkey（无密码登录）凭证 |
| 16 | `perf_metrics` | 11 | 3 | 接口性能指标采样 |
| 17 | `prefill_groups` | 8 | 0 | 渠道预填分组 |
| 18 | `quota_data` | 14 | 5 | 按天聚合的额度用量 |
| 19 | `redemptions` | 11 | 0 | 兑换码 |
| 20 | `setups` | 3 | 1 | 初始化完成标记 |
| 21 | `subscription_orders` | 11 | 0 | 订阅订单 |
| 22 | `subscription_plans` | 23 | 0 | 订阅套餐定义 |
| 23 | `subscription_pre_consume_records` | 8 | 0 | 订阅额度预扣流水 |
| 24 | `system_instances` | 6 | 1 | 多实例部署时的实例登记 |
| 25 | `system_task_locks` | 5 | 0 | 后台系统任务的互斥锁 |
| 26 | `system_tasks` | 12 | 26 | 后台系统任务队列 |
| 27 | `task_plugins` | 11 | 0 | 任务插件登记与配置 |
| 28 | `tasks` | 19 | 0 | 通用异步任务（视频、图片等） |
| 29 | `tokens` | 19 | 7 | API Key（含额度、模型权限、IP 白名单） |
| 30 | `top_ups` | 10 | 0 | 充值记录 |
| 31 | `two_fa_backup_codes` | 7 | 0 | 两步验证备用码 |
| 32 | `two_fas` | 10 | 0 | 两步验证绑定信息 |
| 33 | `user_access_tokens` | 10 | 0 | 用户个人访问令牌 |
| 34 | `user_oauth_bindings` | 5 | 0 | 用户与 OAuth 登录源的绑定 |
| 35 | `user_sessions` | 16 | 32 | 登录会话（设备、过期时间） |
| 36 | `user_subscriptions` | 17 | 0 | 用户当前订阅 |
| 37 | `users` | 31 | 6 | 用户账号（含分组、额度、角色） |
| 38 | `vendors` | 8 | 0 | 模型厂商 |

> 行数取自 `pg_stat_user_tables`（采样前已执行 `ANALYZE`），用于判断表是否在用，不作为对账依据。

## 字段明细

### `abilities`（7 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `group` | character varying | 否 |  |
| `model` | character varying | 否 |  |
| `channel_id` | bigint | 否 |  |
| `enabled` | boolean | 是 |  |
| `priority` | bigint | 是 | `0` |
| `weight` | bigint | 是 | `0` |
| `tag` | text | 是 |  |

唯一约束/索引：`abilities_pkey`

### `audit_logs`（19 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('audit_logs_id_seq'::regclass)` |
| `event_id` | character varying | 是 |  |
| `user_id` | bigint | 是 |  |
| `username` | character varying | 是 |  |
| `actor_role` | bigint | 是 |  |
| `created_at` | bigint | 是 |  |
| `category` | character varying | 是 |  |
| `action` | character varying | 是 |  |
| `token_ref` | character varying | 是 |  |
| `auth_method` | character varying | 是 |  |
| `ip` | character varying | 是 |  |
| `user_agent` | character varying | 是 |  |
| `method` | character varying | 是 |  |
| `route` | character varying | 是 |  |
| `status` | bigint | 是 |  |
| `success` | boolean | 是 |  |
| `request_id` | character varying | 是 |  |
| `content` | text | 是 |  |
| `other` | json | 是 |  |

唯一约束/索引：`audit_logs_pkey`、`idx_audit_logs_event_id`

### `auth_flows`（11 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('auth_flows_id_seq'::regclass)` |
| `token_hash` | character | 否 |  |
| `purpose` | character varying | 否 |  |
| `provider` | character varying | 是 |  |
| `intent` | character varying | 是 |  |
| `user_id` | bigint | 是 |  |
| `session_id` | character varying | 是 |  |
| `payload` | text | 是 |  |
| `created_at` | timestamp with time zone | 是 |  |
| `expires_at` | timestamp with time zone | 否 |  |
| `consumed_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`auth_flows_pkey`、`idx_auth_flows_token_hash`

### `authz_roles`（9 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('authz_roles_id_seq'::regclass)` |
| `key` | character varying | 否 |  |
| `name` | character varying | 否 |  |
| `description` | text | 是 |  |
| `built_in` | boolean | 是 |  |
| `enabled` | boolean | 是 |  |
| `sort` | bigint | 是 |  |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`authz_roles_pkey`、`idx_authz_roles_key`

### `casbin_rule`（8 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('casbin_rule_id_seq'::regclass)` |
| `ptype` | character varying | 是 |  |
| `v0` | character varying | 是 |  |
| `v1` | character varying | 是 |  |
| `v2` | character varying | 是 |  |
| `v3` | character varying | 是 |  |
| `v4` | character varying | 是 |  |
| `v5` | character varying | 是 |  |

唯一约束/索引：`casbin_rule_pkey`、`idx_casbin_rule_unique`

### `channels`（30 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('channels_id_seq'::regclass)` |
| `type` | bigint | 是 | `0` |
| `key` | text | 否 |  |
| `open_ai_organization` | text | 是 |  |
| `test_model` | text | 是 |  |
| `status` | bigint | 是 | `1` |
| `name` | text | 是 |  |
| `weight` | bigint | 是 | `0` |
| `created_time` | bigint | 是 |  |
| `test_time` | bigint | 是 |  |
| `response_time` | bigint | 是 |  |
| `base_url` | text | 是 | `''::text` |
| `other` | text | 是 |  |
| `balance` | numeric | 是 |  |
| `balance_updated_time` | bigint | 是 |  |
| `models` | text | 是 |  |
| `group` | character varying | 是 | `'default'::character varying` |
| `used_quota` | bigint | 是 | `0` |
| `model_mapping` | text | 是 |  |
| `status_code_mapping` | character varying | 是 | `''::character varying` |
| `priority` | bigint | 是 | `0` |
| `auto_ban` | bigint | 是 | `1` |
| `other_info` | text | 是 |  |
| `tag` | text | 是 |  |
| `setting` | text | 是 |  |
| `param_override` | text | 是 |  |
| `header_override` | text | 是 |  |
| `remark` | character varying | 是 |  |
| `channel_info` | json | 是 |  |
| `settings` | text | 是 |  |

唯一约束/索引：`channels_pkey`

### `checkins`（5 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('checkins_id_seq'::regclass)` |
| `user_id` | bigint | 否 |  |
| `checkin_date` | character varying | 否 |  |
| `quota_awarded` | bigint | 否 |  |
| `created_at` | bigint | 是 |  |

唯一约束/索引：`checkins_pkey`、`idx_user_checkin_date`

### `custom_oauth_providers`（21 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('custom_oauth_providers_id_seq'::regclass)` |
| `name` | character varying | 否 |  |
| `slug` | character varying | 否 |  |
| `icon` | character varying | 是 | `''::character varying` |
| `enabled` | boolean | 是 | `false` |
| `client_id` | character varying | 是 |  |
| `client_secret` | character varying | 是 |  |
| `authorization_endpoint` | character varying | 是 |  |
| `token_endpoint` | character varying | 是 |  |
| `user_info_endpoint` | character varying | 是 |  |
| `scopes` | character varying | 是 | `'openid profile email'::character varying` |
| `user_id_field` | character varying | 是 | `'sub'::character varying` |
| `username_field` | character varying | 是 | `'preferred_username'::character varying` |
| `display_name_field` | character varying | 是 | `'name'::character varying` |
| `email_field` | character varying | 是 | `'email'::character varying` |
| `well_known` | character varying | 是 |  |
| `auth_style` | bigint | 是 | `0` |
| `access_policy` | text | 是 |  |
| `access_denied_message` | character varying | 是 |  |
| `created_at` | timestamp with time zone | 是 |  |
| `updated_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`custom_oauth_providers_pkey`、`idx_custom_oauth_providers_slug`

### `external_identity_claims`（5 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('external_identity_claims_id_seq'::regclass)` |
| `provider` | character varying | 否 |  |
| `subject` | character varying | 否 |  |
| `user_id` | bigint | 否 |  |
| `created_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`external_identity_claims_pkey`、`idx_external_identity_subject`、`idx_external_identity_user`

### `login_encryption_keys`（3 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('login_encryption_keys_id_seq'::regclass)` |
| `slot` | character varying | 否 |  |
| `private_key_pem` | text | 否 |  |

唯一约束/索引：`idx_login_encryption_keys_slot`、`login_encryption_keys_pkey`

### `logs`（21 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('logs_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `created_at` | bigint | 是 |  |
| `type` | bigint | 是 |  |
| `content` | text | 是 |  |
| `username` | text | 是 | `''::text` |
| `token_name` | text | 是 | `''::text` |
| `model_name` | text | 是 | `''::text` |
| `quota` | bigint | 是 | `0` |
| `prompt_tokens` | bigint | 是 | `0` |
| `completion_tokens` | bigint | 是 | `0` |
| `use_time` | bigint | 是 | `0` |
| `is_stream` | boolean | 是 |  |
| `channel_id` | bigint | 是 |  |
| `channel_name` | text | 是 |  |
| `token_id` | bigint | 是 | `0` |
| `group` | text | 是 |  |
| `ip` | text | 是 | `''::text` |
| `request_id` | character varying | 是 | `''::character varying` |
| `upstream_request_id` | character varying | 是 | `''::character varying` |
| `other` | text | 是 |  |

唯一约束/索引：`logs_pkey`

### `midjourneys`（24 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('midjourneys_id_seq'::regclass)` |
| `code` | bigint | 是 |  |
| `user_id` | bigint | 是 |  |
| `action` | character varying | 是 |  |
| `mj_id` | text | 是 |  |
| `prompt` | text | 是 |  |
| `prompt_en` | text | 是 |  |
| `description` | text | 是 |  |
| `state` | text | 是 |  |
| `submit_time` | bigint | 是 |  |
| `start_time` | bigint | 是 |  |
| `finish_time` | bigint | 是 |  |
| `image_url` | text | 是 |  |
| `video_url` | text | 是 |  |
| `video_urls` | text | 是 |  |
| `status` | character varying | 是 |  |
| `progress` | character varying | 是 |  |
| `fail_reason` | text | 是 |  |
| `channel_id` | bigint | 是 |  |
| `quota` | bigint | 是 |  |
| `buttons` | text | 是 |  |
| `properties` | text | 是 |  |
| `token_id` | bigint | 是 | `0` |
| `billing_channel_id` | bigint | 是 | `0` |

唯一约束/索引：`midjourneys_pkey`

### `models`（13 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('models_id_seq'::regclass)` |
| `model_name` | character varying | 否 |  |
| `description` | text | 是 |  |
| `icon` | character varying | 是 |  |
| `tags` | character varying | 是 |  |
| `vendor_id` | bigint | 是 |  |
| `endpoints` | text | 是 |  |
| `status` | bigint | 是 | `1` |
| `sync_official` | bigint | 是 | `1` |
| `created_time` | bigint | 是 |  |
| `updated_time` | bigint | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |
| `name_rule` | bigint | 是 | `0` |

唯一约束/索引：`models_pkey`、`uk_model_name_delete_at`

### `options`（2 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `key` | text | 否 |  |
| `value` | text | 是 |  |

唯一约束/索引：`options_pkey`

### `passkey_credentials`（19 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('passkey_credentials_id_seq'::regclass)` |
| `user_id` | bigint | 否 |  |
| `rp_id` | character varying | 是 |  |
| `credential_id` | character varying | 否 |  |
| `public_key` | text | 否 |  |
| `attestation_type` | character varying | 是 |  |
| `aa_guid` | character varying | 是 |  |
| `sign_count` | bigint | 是 | `0` |
| `clone_warning` | boolean | 是 |  |
| `user_present` | boolean | 是 |  |
| `user_verified` | boolean | 是 |  |
| `backup_eligible` | boolean | 是 |  |
| `backup_state` | boolean | 是 |  |
| `transports` | text | 是 |  |
| `attachment` | character varying | 是 |  |
| `last_used_at` | timestamp with time zone | 是 |  |
| `created_at` | timestamp with time zone | 是 |  |
| `updated_at` | timestamp with time zone | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`idx_passkey_credentials_credential_id`、`idx_passkey_credentials_user_id`、`passkey_credentials_pkey`

### `perf_metrics`（11 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('perf_metrics_id_seq'::regclass)` |
| `model_name` | character varying | 是 |  |
| `group` | character varying | 是 |  |
| `bucket_ts` | bigint | 是 |  |
| `request_count` | bigint | 是 | `0` |
| `success_count` | bigint | 是 | `0` |
| `total_latency_ms` | bigint | 是 | `0` |
| `ttft_sum_ms` | bigint | 是 | `0` |
| `ttft_count` | bigint | 是 | `0` |
| `output_tokens` | bigint | 是 | `0` |
| `generation_ms` | bigint | 是 | `0` |

唯一约束/索引：`idx_perf_model_group_bucket`、`perf_metrics_pkey`

### `prefill_groups`（8 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('prefill_groups_id_seq'::regclass)` |
| `name` | character varying | 否 |  |
| `type` | character varying | 否 |  |
| `items` | json | 是 |  |
| `description` | character varying | 是 |  |
| `created_time` | bigint | 是 |  |
| `updated_time` | bigint | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`prefill_groups_pkey`、`uk_prefill_name`

### `quota_data`（14 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('quota_data_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `username` | character varying | 是 | `''::character varying` |
| `model_name` | character varying | 是 | `''::character varying` |
| `created_at` | bigint | 是 |  |
| `use_group` | character varying | 是 | `''::character varying` |
| `token_id` | bigint | 是 | `0` |
| `channel_id` | bigint | 是 | `0` |
| `node_name` | character varying | 是 | `''::character varying` |
| `token_used` | bigint | 是 | `0` |
| `count` | bigint | 是 | `0` |
| `quota` | bigint | 是 | `0` |
| `cache_read_tokens` | bigint | 是 | `0` |
| `cache_creation_tokens` | bigint | 是 | `0` |

唯一约束/索引：`quota_data_pkey`

### `redemptions`（11 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('redemptions_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `key` | character | 是 |  |
| `status` | bigint | 是 | `1` |
| `name` | text | 是 |  |
| `quota` | bigint | 是 | `100` |
| `created_time` | bigint | 是 |  |
| `redeemed_time` | bigint | 是 |  |
| `used_user_id` | bigint | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |
| `expired_time` | bigint | 是 |  |

唯一约束/索引：`idx_redemptions_key`、`redemptions_pkey`

### `setups`（3 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('setups_id_seq'::regclass)` |
| `version` | character varying | 否 |  |
| `initialized_at` | bigint | 否 |  |

唯一约束/索引：`setups_pkey`

### `subscription_orders`（11 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('subscription_orders_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `plan_id` | bigint | 是 |  |
| `money` | numeric | 是 |  |
| `trade_no` | character varying | 是 |  |
| `payment_method` | character varying | 是 |  |
| `payment_provider` | character varying | 是 | `''::character varying` |
| `status` | text | 是 |  |
| `create_time` | bigint | 是 |  |
| `complete_time` | bigint | 是 |  |
| `provider_payload` | text | 是 |  |

唯一约束/索引：`subscription_orders_pkey`、`uni_subscription_orders_trade_no`

### `subscription_plans`（23 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('subscription_plans_id_seq'::regclass)` |
| `title` | character varying | 否 |  |
| `subtitle` | character varying | 是 | `''::character varying` |
| `price_amount` | numeric | 否 | `0` |
| `currency` | character varying | 否 | `'USD'::character varying` |
| `duration_unit` | character varying | 否 | `'month'::character varying` |
| `duration_value` | bigint | 否 | `1` |
| `custom_seconds` | bigint | 否 | `0` |
| `enabled` | boolean | 是 | `true` |
| `sort_order` | bigint | 是 | `0` |
| `allow_balance_pay` | boolean | 是 |  |
| `allow_wallet_overflow` | boolean | 是 |  |
| `stripe_price_id` | character varying | 是 | `''::character varying` |
| `creem_product_id` | character varying | 是 | `''::character varying` |
| `waffo_pancake_product_id` | character varying | 是 | `''::character varying` |
| `max_purchase_per_user` | bigint | 是 | `0` |
| `upgrade_group` | character varying | 是 | `''::character varying` |
| `downgrade_group` | character varying | 是 | `''::character varying` |
| `total_amount` | bigint | 否 | `0` |
| `quota_reset_period` | character varying | 是 | `'never'::character varying` |
| `quota_reset_custom_seconds` | bigint | 是 | `0` |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`subscription_plans_pkey`

### `subscription_pre_consume_records`（8 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('subscription_pre_consume_records_id_seq'::regclass)` |
| `request_id` | character varying | 是 |  |
| `user_id` | bigint | 是 |  |
| `user_subscription_id` | bigint | 是 |  |
| `pre_consumed` | bigint | 否 | `0` |
| `status` | character varying | 是 |  |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`idx_subscription_pre_consume_records_request_id`、`subscription_pre_consume_records_pkey`

### `system_instances`（6 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `node_name` | character varying | 否 |  |
| `info` | text | 是 |  |
| `started_at` | bigint | 是 |  |
| `last_seen_at` | bigint | 是 |  |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`system_instances_pkey`

### `system_task_locks`（5 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `type` | character varying | 否 |  |
| `task_id` | character varying | 是 |  |
| `locked_by` | character varying | 是 |  |
| `locked_until` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`system_task_locks_pkey`

### `system_tasks`（12 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('system_tasks_id_seq'::regclass)` |
| `task_id` | character varying | 是 |  |
| `type` | character varying | 是 |  |
| `status` | character varying | 是 |  |
| `active_key` | character varying | 是 |  |
| `payload` | text | 是 |  |
| `state` | text | 是 |  |
| `result` | text | 是 |  |
| `error` | text | 是 |  |
| `locked_by` | character varying | 是 |  |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`idx_system_tasks_active_key`、`idx_system_tasks_task_id`、`system_tasks_pkey`

### `task_plugins`（11 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('task_plugins_id_seq'::regclass)` |
| `key` | character varying | 否 |  |
| `api_version` | bigint | 否 |  |
| `version` | character varying | 否 |  |
| `source` | text | 否 |  |
| `source_hash` | character varying | 否 |  |
| `icon` | text | 是 |  |
| `enabled` | boolean | 否 |  |
| `active` | boolean | 否 |  |
| `created_at` | bigint | 否 |  |
| `remark` | text | 是 |  |

唯一约束/索引：`task_plugins_pkey`、`uk_task_plugin_key_version`

### `tasks`（19 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('tasks_id_seq'::regclass)` |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |
| `task_id` | character varying | 是 |  |
| `platform` | character varying | 是 |  |
| `user_id` | bigint | 是 |  |
| `group` | character varying | 是 |  |
| `channel_id` | bigint | 是 |  |
| `quota` | bigint | 是 |  |
| `action` | character varying | 是 |  |
| `status` | character varying | 是 |  |
| `fail_reason` | text | 是 |  |
| `submit_time` | bigint | 是 |  |
| `start_time` | bigint | 是 |  |
| `finish_time` | bigint | 是 |  |
| `progress` | character varying | 是 |  |
| `properties` | json | 是 |  |
| `private_data` | json | 是 |  |
| `data` | json | 是 |  |

唯一约束/索引：`tasks_pkey`

### `tokens`（19 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('tokens_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `key` | character varying | 是 |  |
| `status` | bigint | 是 | `1` |
| `name` | text | 是 |  |
| `created_time` | bigint | 是 |  |
| `accessed_time` | bigint | 是 |  |
| `expired_time` | bigint | 是 | `'-1'::integer` |
| `remain_quota` | bigint | 是 | `0` |
| `unlimited_quota` | boolean | 是 |  |
| `model_limits_enabled` | boolean | 是 |  |
| `model_limits` | text | 是 |  |
| `allow_ips` | text | 是 | `''::text` |
| `used_quota` | bigint | 是 | `0` |
| `group` | text | 是 | `''::text` |
| `cross_group_retry` | boolean | 是 |  |
| `auto_groups` | text | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |
| `allow_user_quota_query` | boolean | 是 |  |

唯一约束/索引：`idx_tokens_key`、`tokens_pkey`

### `top_ups`（10 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('top_ups_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `amount` | bigint | 是 |  |
| `money` | numeric | 是 |  |
| `trade_no` | character varying | 是 |  |
| `payment_method` | character varying | 是 |  |
| `payment_provider` | character varying | 是 | `''::character varying` |
| `create_time` | bigint | 是 |  |
| `complete_time` | bigint | 是 |  |
| `status` | text | 是 |  |

唯一约束/索引：`top_ups_pkey`、`uni_top_ups_trade_no`

### `two_fa_backup_codes`（7 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('two_fa_backup_codes_id_seq'::regclass)` |
| `user_id` | bigint | 否 |  |
| `code_hash` | character varying | 否 |  |
| `is_used` | boolean | 是 |  |
| `used_at` | timestamp with time zone | 是 |  |
| `created_at` | timestamp with time zone | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`two_fa_backup_codes_pkey`

### `two_fas`（10 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('two_fas_id_seq'::regclass)` |
| `user_id` | bigint | 否 |  |
| `secret` | character varying | 否 |  |
| `is_enabled` | boolean | 是 |  |
| `failed_attempts` | bigint | 是 | `0` |
| `locked_until` | timestamp with time zone | 是 |  |
| `last_used_at` | timestamp with time zone | 是 |  |
| `created_at` | timestamp with time zone | 是 |  |
| `updated_at` | timestamp with time zone | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`two_fas_pkey`、`uni_two_fas_user_id`

### `user_access_tokens`（10 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('user_access_tokens_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `name` | character varying | 是 |  |
| `token_hash` | character varying | 是 |  |
| `token_hint` | character varying | 是 |  |
| `scopes` | character varying | 是 |  |
| `expires_at` | bigint | 是 |  |
| `last_used_at` | bigint | 是 |  |
| `last_used_ip` | character varying | 是 |  |
| `created_at` | bigint | 是 |  |

唯一约束/索引：`idx_user_access_tokens_token_hash`、`user_access_tokens_pkey`

### `user_oauth_bindings`（5 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('user_oauth_bindings_id_seq'::regclass)` |
| `user_id` | bigint | 否 |  |
| `provider_id` | bigint | 否 |  |
| `provider_user_id` | character varying | 否 |  |
| `created_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`user_oauth_bindings_pkey`、`ux_provider_userid`、`ux_user_provider`

### `user_sessions`（16 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `sid` | character varying | 否 |  |
| `user_id` | bigint | 否 |  |
| `version` | bigint | 否 | `1` |
| `user_auth_version` | bigint | 否 |  |
| `status` | character varying | 否 |  |
| `refresh_hash` | character | 否 |  |
| `previous_refresh_hash` | character varying | 是 |  |
| `previous_valid_until` | bigint | 否 | `0` |
| `login_method` | character varying | 否 |  |
| `ip` | character varying | 是 |  |
| `user_agent` | text | 是 |  |
| `created_at` | bigint | 是 |  |
| `last_active_at` | bigint | 否 |  |
| `expires_at` | bigint | 否 |  |
| `revoked_at` | bigint | 否 | `0` |
| `revoked_reason` | character varying | 是 |  |

唯一约束/索引：`user_sessions_pkey`

### `user_subscriptions`（17 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('user_subscriptions_id_seq'::regclass)` |
| `user_id` | bigint | 是 |  |
| `plan_id` | bigint | 是 |  |
| `amount_total` | bigint | 否 | `0` |
| `amount_used` | bigint | 否 | `0` |
| `start_time` | bigint | 是 |  |
| `end_time` | bigint | 是 |  |
| `status` | character varying | 是 |  |
| `source` | character varying | 是 | `'order'::character varying` |
| `last_reset_time` | bigint | 是 | `0` |
| `next_reset_time` | bigint | 是 | `0` |
| `upgrade_group` | character varying | 是 | `''::character varying` |
| `prev_user_group` | character varying | 是 | `''::character varying` |
| `downgrade_group` | character varying | 是 | `''::character varying` |
| `allow_wallet_overflow` | boolean | 是 |  |
| `created_at` | bigint | 是 |  |
| `updated_at` | bigint | 是 |  |

唯一约束/索引：`user_subscriptions_pkey`

### `users`（31 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('users_id_seq'::regclass)` |
| `username` | text | 是 |  |
| `password` | text | 否 |  |
| `display_name` | text | 是 |  |
| `role` | bigint | 是 | `1` |
| `status` | bigint | 是 | `1` |
| `email` | text | 是 |  |
| `github_id` | text | 是 |  |
| `discord_id` | text | 是 |  |
| `oidc_id` | text | 是 |  |
| `wechat_id` | text | 是 |  |
| `telegram_id` | text | 是 |  |
| `access_token` | character | 是 |  |
| `access_token_created_at` | bigint | 是 |  |
| `quota` | bigint | 是 | `0` |
| `used_quota` | bigint | 是 | `0` |
| `request_count` | bigint | 是 | `0` |
| `group` | character varying | 是 | `'default'::character varying` |
| `aff_code` | character varying | 是 |  |
| `aff_count` | bigint | 是 | `0` |
| `aff_quota` | bigint | 是 | `0` |
| `aff_history` | bigint | 是 | `0` |
| `inviter_id` | bigint | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |
| `linux_do_id` | text | 是 |  |
| `setting` | text | 是 |  |
| `remark` | character varying | 是 |  |
| `stripe_customer` | character varying | 是 |  |
| `created_at` | bigint | 是 |  |
| `last_login_at` | bigint | 是 | `0` |
| `auth_version` | bigint | 否 | `1` |

唯一约束/索引：`idx_users_access_token`、`idx_users_aff_code`、`uni_users_username`、`users_pkey`

### `vendors`（8 个字段）

| 字段 | 类型 | 可空 | 默认值 |
| --- | --- | --- | --- |
| `id` | bigint | 否 | `nextval('vendors_id_seq'::regclass)` |
| `name` | character varying | 否 |  |
| `description` | text | 是 |  |
| `icon` | character varying | 是 |  |
| `status` | bigint | 是 | `1` |
| `created_time` | bigint | 是 |  |
| `updated_time` | bigint | 是 |  |
| `deleted_at` | timestamp with time zone | 是 |  |

唯一约束/索引：`uk_vendor_name_delete_at`、`vendors_pkey`

## 外键与约束

全库 **0 条外键**。这不是遗漏——官方刻意不在数据库层做级联约束，删除用户、删除渠道这类操作由代码保证，避免跨库（SQLite/MySQL/PostgreSQL）行为不一致。

因此升级时：改表结构不会有外键冲突，但**删数据前要自己确认引用关系**（比如删渠道前先看 `abilities` 里还有没有它的记录）。

## 升级与备份怎么用这份报告

1. 升级前备份，并记下当前表数量与备份文件名：

```bash
docker exec postgres pg_dump -U root new-api > backup-$(date +%Y%m%d-%H%M).sql
docker exec postgres psql -U root -d new-api -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

2. 升级后再数一次表：数量变了说明官方加了表或改了结构，按变化逐表核对关键字段。
3. 需要回滚时还原备份，并用「表数量 + 备份时间」确认还原到的是哪一版。

## 部署现状与版本记录

采样时 `:3000` 上跑的容器镜像是 `calciumion/new-api:latest`（2026-11-10 09:14 创建），而 `VERSION.md` 第 7 项记录的是 `company-newapi:0.3.0`。

两者不一致说明两件事：

1. 当时运行的实例**不带品牌色补丁**（补丁打在 company-newapi 镜像里）。
2. 版本记录还原不了那次部署——8.1 要求第 7 项能回答「这版跑的是哪个镜像」，当时答不上来。

**2026-11-10 15:40 已纠正**：按 `backend/docker-compose.company.yml` 用 `company-newapi:0.3.0` 重建 `:3000`，只动应用容器（`--no-deps`，数据库与 Redis 未重启，数据未迁移）。核对结果：

- 容器镜像 `company-newapi:0.3.0`，健康检查通过；
- `GET /api/status` 返回 `version=v0.1.0-company`；
- 前端产物含品牌色 `#4f46e5`（浅色/深色/ring 共 6 处），登录页主按钮已为靛蓝，截图见本机 `docs/screenshots/admin-login-branded-20261110-v2.png`（截图不入库）。

以后每次切换镜像，都要在本节与 `VERSION.md` 第 7 项同步记一笔，否则版本记录会再次对不上部署。

## 已知约束

1. **三库兼容**：官方要求 SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 行为一致，字段类型不能带库特有写法。
2. **日志库可分开**：日志可独立配库（支持 ClickHouse），此时 `logs` 表不在主库，表数量会少一张。
3. **AutoMigrate 幂等**：重复启动不应再改结构；若每次启动都执行 `ALTER`，通常是布尔默认值等标签写法导致的，官方有专门的约束。
4. **表数量不是固定值**：官方每个版本都可能加表，本报告的 38 是 v1.0.0-rc.49 的事实值，升级后要重采样。

## 重新生成这份报告

```powershell
docker exec postgres psql -U root -d new-api -A -F "|" -t -c "SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;" > docs\_tmp_columns.txt
docker exec postgres psql -U root -d new-api -A -F "|" -t -c "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND (indexdef LIKE '%UNIQUE%' OR indexdef LIKE '%PRIMARY%') ORDER BY tablename, indexname;" > docs\_tmp_indexes.txt
docker exec postgres psql -U root -d new-api -A -F "|" -t -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;" > docs\_tmp_rows.txt
node scripts/build-database-report.mjs
```
