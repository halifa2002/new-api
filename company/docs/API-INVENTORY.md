# 官方接口清单

> 对应领导文档第十章 Phase 0 交付物「官方 API 接口清单」。
> 由 `scripts/export-api-inventory.mjs` 从 `backend/router/*.go` 静态导出，不是手抄。
> 生成时间：2026-11-10 15:25　｜　基线：官方 v1.0.0-rc.49（commit 48a6c87）

## 统计口径

- 共 **379 条**注册路由（同一方法同一路径只保留一条，重复 0 条已合并）。
- 一条注册算一条；gin 的 `Any` 按 1 条计（运行时展开为多个 HTTP 方法）。
- 循环注册的路由表（`channelPermissionRoutes`，44 条）与内联 `handlePermissionRoute`（2 条）已计入。
- 注释掉的注册语句不计；插件路由（`plugins/tasks/` 下 JS 运行时注册）不在清单内。
- 路径为 gin 实际注册路径，含 `:id`/`*path` 占位符与尾斜杠。

## 按方法分布

| 方法 | 条数 |
| --- | ---: |
| GET | 167 |
| POST | 156 |
| DELETE | 32 |
| PUT | 19 |
| PATCH | 4 |
| HEAD | 1 |
| **合计** | **379** |

## 按文件分布

| 文件 | 条数 |
| --- | ---: |
| `api-router.go` | 270 |
| `relay-router.go` | 51 |
| `channel-router.go` | 45 |
| `task-router.go` | 5 |
| `dashboard.go` | 4 |
| `video-router.go` | 3 |
| `authz-router.go` | 1 |

## 管理接口 /api（316 条）

| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/api/about` | `GetAbout` | `api-router.go:35` |  |
| GET | `/api/audit` |  | `api-router.go:321` | Casbin 权限路由 |
| GET | `/api/audit/self` | `GetAuditLogs` | `api-router.go:322` |  |
| GET | `/api/authz/catalog` | `GetPermissionCatalog` | `authz-router.go:17` |  |
| GET | `/api/channel/` | `GetAllChannels` | `channel-router.go:60` | 循环注册 |
| POST | `/api/channel/` | `AddChannel` | `channel-router.go:71` | 循环注册 |
| PUT | `/api/channel/` | `UpdateChannel` | `channel-router.go:72` | 循环注册 |
| DELETE | `/api/channel/:id` | `DeleteChannel` | `channel-router.go:79` | 循环注册 |
| GET | `/api/channel/:id` | `GetChannel` | `channel-router.go:66` | 循环注册 |
| POST | `/api/channel/:id/codex/refresh` | `RefreshCodexChannelCredential` | `channel-router.go:86` | 循环注册 |
| GET | `/api/channel/:id/codex/usage` | `GetCodexChannelUsage` | `channel-router.go:87` | 循环注册 |
| POST | `/api/channel/:id/codex/usage/reset` | `ResetCodexChannelUsage` | `channel-router.go:89` | 循环注册 |
| GET | `/api/channel/:id/codex/usage/reset-credits` | `GetCodexChannelRateLimitResetCredits` | `channel-router.go:88` | 循环注册 |
| POST | `/api/channel/:id/key` | `GetChannelKey` | `channel-router.go:44` |  |
| GET | `/api/channel/:id/sglang/status` | `GetSGLangChannelStatus` | `channel-router.go:84` | 循环注册 |
| POST | `/api/channel/:id/status` | `UpdateChannelStatus` | `channel-router.go:74` | 循环注册 |
| GET | `/api/channel/:id/vllm/status` | `GetVLLMChannelStatus` | `channel-router.go:83` | 循环注册 |
| POST | `/api/channel/batch` | `DeleteChannelBatch` | `channel-router.go:80` | 循环注册 |
| POST | `/api/channel/batch/tag` | `BatchSetChannelTag` | `channel-router.go:94` | 循环注册 |
| POST | `/api/channel/copy/:id` | `CopyChannel` | `channel-router.go:96` | 循环注册 |
| GET | `/api/channel/default_base_urls` | `GetChannelDefaultBaseURLs` | `channel-router.go:63` | 循环注册 |
| DELETE | `/api/channel/disabled` | `DeleteDisabledChannel` | `channel-router.go:75` | 循环注册 |
| POST | `/api/channel/fetch_models` | `FetchModels` | `channel-router.go:85` | 循环注册 |
| GET | `/api/channel/fetch_models/:id` | `FetchUpstreamModels` | `channel-router.go:82` | 循环注册 |
| POST | `/api/channel/fix` | `FixChannelsAbilities` | `channel-router.go:81` | 循环注册 |
| GET | `/api/channel/models` | `ChannelListModels` | `channel-router.go:62` | 循环注册 |
| GET | `/api/channel/models_enabled` | `EnabledListModels` | `channel-router.go:64` | 循环注册 |
| POST | `/api/channel/multi_key/manage` | `ManageMultiKeys` | `channel-router.go:97` | 循环注册 |
| DELETE | `/api/channel/ollama/delete` | `OllamaDeleteModel` | `channel-router.go:92` | 循环注册 |
| POST | `/api/channel/ollama/pull` | `OllamaPullModel` | `channel-router.go:90` | 循环注册 |
| POST | `/api/channel/ollama/pull/stream` | `OllamaPullModelStream` | `channel-router.go:91` | 循环注册 |
| GET | `/api/channel/ollama/version/:id` | `OllamaVersion` | `channel-router.go:93` | 循环注册 |
| GET | `/api/channel/ops` | `GetChannelOps` | `channel-router.go:65` | 循环注册 |
| GET | `/api/channel/priority/order` | `GetChannelPriorityOrder` | `channel-router.go:58` | 循环注册 |
| POST | `/api/channel/priority/reorder` | `ReorderChannelPriority` | `channel-router.go:59` | 循环注册 |
| GET | `/api/channel/search` | `SearchChannels` | `channel-router.go:61` | 循环注册 |
| POST | `/api/channel/status/batch` | `BatchUpdateChannelStatus` | `channel-router.go:73` | 循环注册 |
| PUT | `/api/channel/tag` | `EditTagChannels` | `channel-router.go:78` | 循环注册 |
| POST | `/api/channel/tag/disabled` | `DisableTagChannels` | `channel-router.go:76` | 循环注册 |
| POST | `/api/channel/tag/enabled` | `EnableTagChannels` | `channel-router.go:77` | 循环注册 |
| GET | `/api/channel/tag/models` | `GetTagModels` | `channel-router.go:95` | 循环注册 |
| GET | `/api/channel/test` | `TestAllChannels` | `channel-router.go:67` | 循环注册 |
| GET | `/api/channel/test/:id` | `TestChannel` | `channel-router.go:68` | 循环注册 |
| GET | `/api/channel/update_balance` | `UpdateAllChannelsBalance` | `channel-router.go:69` | 循环注册 |
| GET | `/api/channel/update_balance/:id` | `UpdateChannelBalance` | `channel-router.go:70` | 循环注册 |
| POST | `/api/channel/upstream_updates/apply` | `ApplyChannelUpstreamModelUpdates` | `channel-router.go:98` | 循环注册 |
| POST | `/api/channel/upstream_updates/apply_all` | `ApplyAllChannelUpstreamModelUpdates` | `channel-router.go:99` | 循环注册 |
| POST | `/api/channel/upstream_updates/detect` | `DetectChannelUpstreamModelUpdates` | `channel-router.go:100` | 循环注册 |
| POST | `/api/channel/upstream_updates/detect_all` | `DetectAllChannelUpstreamModelUpdates` | `channel-router.go:101` | 循环注册 |
| POST | `/api/creem/webhook` | `CreemWebhook` | `api-router.go:65` |  |
| GET | `/api/custom-oauth-provider/` | `GetCustomOAuthProviders` | `api-router.go:241` |  |
| POST | `/api/custom-oauth-provider/` | `CreateCustomOAuthProvider` | `api-router.go:243` |  |
| DELETE | `/api/custom-oauth-provider/:id` | `DeleteCustomOAuthProvider` | `api-router.go:245` |  |
| GET | `/api/custom-oauth-provider/:id` | `GetCustomOAuthProvider` | `api-router.go:242` |  |
| PUT | `/api/custom-oauth-provider/:id` | `UpdateCustomOAuthProvider` | `api-router.go:244` |  |
| POST | `/api/custom-oauth-provider/discovery` | `FetchCustomOAuthDiscovery` | `api-router.go:240` |  |
| GET | `/api/data/` | `GetAllQuotaDates` | `api-router.go:352` |  |
| GET | `/api/data/flow` | `GetAllFlowQuotaDates` | `api-router.go:355` |  |
| GET | `/api/data/flow/self` | `GetUserFlowQuotaDates` | `api-router.go:356` |  |
| GET | `/api/data/self` | `GetUserQuotaDates` | `api-router.go:354` |  |
| GET | `/api/data/users` | `GetQuotaDatesByUser` | `api-router.go:353` |  |
| GET | `/api/deployments/` | `GetAllDeployments` | `api-router.go:422` |  |
| POST | `/api/deployments/` | `CreateDeployment` | `api-router.go:430` |  |
| DELETE | `/api/deployments/:id` | `DeleteDeployment` | `api-router.go:439` |  |
| GET | `/api/deployments/:id` | `GetDeployment` | `api-router.go:432` |  |
| PUT | `/api/deployments/:id` | `UpdateDeployment` | `api-router.go:436` |  |
| GET | `/api/deployments/:id/containers` | `ListDeploymentContainers` | `api-router.go:434` |  |
| GET | `/api/deployments/:id/containers/:container_id` | `GetContainerDetails` | `api-router.go:435` |  |
| POST | `/api/deployments/:id/extend` | `ExtendDeployment` | `api-router.go:438` |  |
| GET | `/api/deployments/:id/logs` | `GetDeploymentLogs` | `api-router.go:433` |  |
| PUT | `/api/deployments/:id/name` | `UpdateDeploymentName` | `api-router.go:437` |  |
| GET | `/api/deployments/available-replicas` | `GetAvailableReplicas` | `api-router.go:427` |  |
| GET | `/api/deployments/check-name` | `CheckClusterNameAvailability` | `api-router.go:429` |  |
| GET | `/api/deployments/hardware-types` | `GetHardwareTypes` | `api-router.go:425` |  |
| GET | `/api/deployments/locations` | `GetLocations` | `api-router.go:426` |  |
| POST | `/api/deployments/price-estimation` | `GetPriceEstimation` | `api-router.go:428` |  |
| GET | `/api/deployments/search` | `SearchDeployments` | `api-router.go:423` |  |
| GET | `/api/deployments/settings` | `GetModelDeploymentSettings` | `api-router.go:420` |  |
| POST | `/api/deployments/settings/test-connection` | `TestIoNetConnection` | `api-router.go:421` |  |
| POST | `/api/deployments/test-connection` | `TestIoNetConnection` | `api-router.go:424` |  |
| GET | `/api/group/` | `GetGroups` | `api-router.go:365` |  |
| GET | `/api/home_page_content` | `GetHomePageContent` | `api-router.go:37` |  |
| GET | `/api/log/` | `GetAllLogs` | `api-router.go:324` |  |
| GET | `/api/log/channel_affinity_usage_cache` | `GetChannelAffinityUsageCacheStats` | `api-router.go:327` |  |
| GET | `/api/log/export` | `ExportAllLogs` | `api-router.go:330` |  |
| GET | `/api/log/search` | `SearchAllLogs` | `api-router.go:328` |  |
| GET | `/api/log/self` | `GetUserLogs` | `api-router.go:329` |  |
| GET | `/api/log/self/export` | `ExportUserLogs` | `api-router.go:331` |  |
| GET | `/api/log/self/search` | `SearchUserLogs` | `api-router.go:332` |  |
| GET | `/api/log/self/stat` | `GetLogsSelfStat` | `api-router.go:326` |  |
| GET | `/api/log/stat` | `GetLogsStat` | `api-router.go:325` |  |
| GET | `/api/log/token` | `GetLogByKey` | `api-router.go:360` |  |
| GET | `/api/mj/` | `GetAllMidjourney` | `api-router.go:379` |  |
| GET | `/api/mj/self` | `GetUserMidjourney` | `api-router.go:378` |  |
| GET | `/api/models` | `DashboardListModels` | `api-router.go:30` |  |
| GET | `/api/models/` | `GetAllModelsMeta` | `api-router.go:408` |  |
| POST | `/api/models/` | `CreateModelMeta` | `api-router.go:411` |  |
| PUT | `/api/models/` | `UpdateModelMeta` | `api-router.go:412` |  |
| DELETE | `/api/models/:id` | `DeleteModelMeta` | `api-router.go:413` |  |
| GET | `/api/models/:id` | `GetModelMeta` | `api-router.go:410` |  |
| POST | `/api/models/delete` | `BatchDeleteModelMeta` | `api-router.go:406` |  |
| GET | `/api/models/missing` | `GetMissingModels` | `api-router.go:407` |  |
| GET | `/api/models/search` | `SearchModelsMeta` | `api-router.go:409` |  |
| POST | `/api/models/sync_upstream` | `SyncUpstreamModels` | `api-router.go:405` |  |
| GET | `/api/models/sync_upstream/preview` | `SyncUpstreamPreview` | `api-router.go:404` |  |
| GET | `/api/notice` | `GetNotice` | `api-router.go:32` |  |
| GET | `/api/oauth/:provider` | `HandleOAuth` | `api-router.go:61` |  |
| POST | `/api/oauth/email/bind` | `EmailBind` | `api-router.go:53` |  |
| POST | `/api/oauth/email/bind/resend` | `EmailBindResend` | `api-router.go:52` |  |
| POST | `/api/oauth/email/bind/start` | `EmailBindStart` | `api-router.go:51` |  |
| POST | `/api/oauth/state` | `GenerateOAuthCode` | `api-router.go:50` |  |
| GET | `/api/oauth/telegram/bind/:flow_token` | `TelegramLegacyAuth` | `api-router.go:59` |  |
| POST | `/api/oauth/telegram/bind/start` | `TelegramLegacyAuth` | `api-router.go:58` |  |
| GET | `/api/oauth/telegram/login` | `TelegramLegacyAuth` | `api-router.go:57` |  |
| GET | `/api/oauth/wechat` | `WeChatAuth` | `api-router.go:55` |  |
| POST | `/api/oauth/wechat/bind` | `WeChatBind` | `api-router.go:56` |  |
| GET | `/api/option/` | `GetOptions` | `api-router.go:215` |  |
| PUT | `/api/option/` | `UpdateOption` | `api-router.go:218` |  |
| DELETE | `/api/option/channel_affinity_cache` | `ClearChannelAffinityCache` | `api-router.go:227` |  |
| GET | `/api/option/channel_affinity_cache` | `GetChannelAffinityCacheStats` | `api-router.go:226` |  |
| GET | `/api/option/model_pricing` | `GetModelPricingConfig` | `api-router.go:220` |  |
| PATCH | `/api/option/model_pricing` | `UpdateModelPricingConfig` | `api-router.go:222` |  |
| POST | `/api/option/model_pricing/convert` | `PreviewModelPricingConversion` | `api-router.go:223` |  |
| GET | `/api/option/model_pricing/issues` | `GetModelPricingIssues` | `api-router.go:221` |  |
| POST | `/api/option/model_pricing/preview` | `PreviewModelPricing` | `api-router.go:224` |  |
| PUT | `/api/option/passkey/domains` | `UpdatePasskeyDomains` | `api-router.go:219` |  |
| POST | `/api/option/payment_compliance` | `ConfirmPaymentCompliance` | `api-router.go:225` |  |
| GET | `/api/option/request_policy` | `GetRequestPolicy` | `api-router.go:216` |  |
| PATCH | `/api/option/request_policy` | `UpdateRequestPolicy` | `api-router.go:217` |  |
| POST | `/api/option/rest_model_ratio` | `ResetModelRatio` | `api-router.go:228` |  |
| GET | `/api/option/waffo-pancake/catalog` | `ListWaffoPancakeCatalog` | `api-router.go:229` |  |
| POST | `/api/option/waffo-pancake/pair` | `CreateWaffoPancakePair` | `api-router.go:230` |  |
| POST | `/api/option/waffo-pancake/save` | `SaveWaffoPancake` | `api-router.go:231` |  |
| POST | `/api/option/waffo-pancake/subscription-product` | `CreateWaffoPancakeSubscriptionProduct` | `api-router.go:232` |  |
| GET | `/api/option/waffo-pancake/subscription-product-options` | `ListWaffoPancakeSubscriptionProductOptions` | `api-router.go:233` |  |
| GET | `/api/perf-metrics` | `GetPerfMetrics` | `api-router.go:43` |  |
| GET | `/api/perf-metrics/summary` | `GetPerfMetricsSummary` | `api-router.go:42` |  |
| DELETE | `/api/performance/disk_cache` | `ClearDiskCache` | `api-router.go:251` |  |
| POST | `/api/performance/gc` | `ForceGC` | `api-router.go:253` |  |
| DELETE | `/api/performance/logs` | `CleanupLogFiles` | `api-router.go:255` |  |
| GET | `/api/performance/logs` | `GetLogFiles` | `api-router.go:254` |  |
| POST | `/api/performance/reset_stats` | `ResetPerformanceStats` | `api-router.go:252` |  |
| GET | `/api/performance/stats` | `GetPerformanceStats` | `api-router.go:250` |  |
| GET | `/api/plugin/task` | `ListTaskPlugins` | `api-router.go:266` |  |
| POST | `/api/plugin/task` | `UploadTaskPlugin` | `api-router.go:267` |  |
| PUT | `/api/plugin/task` | `UploadTaskPlugin` | `api-router.go:268` |  |
| GET | `/api/plugin/task/:key` | `GetTaskPlugin` | `api-router.go:272` |  |
| POST | `/api/plugin/task/:key/activate` | `ActivateTaskPlugin` | `api-router.go:275` |  |
| POST | `/api/plugin/task/:key/dryrun` | `DryRunTaskPlugin` | `api-router.go:277` |  |
| GET | `/api/plugin/task/:key/icon` | `GetTaskPluginIcon` | `api-router.go:273` |  |
| POST | `/api/plugin/task/:key/status` | `SetTaskPluginStatus` | `api-router.go:276` |  |
| GET | `/api/plugin/task/:key/versions` | `GetTaskPluginVersions` | `api-router.go:274` |  |
| DELETE | `/api/plugin/task/:key/versions/:version` | `DeleteTaskPluginVersion` | `api-router.go:278` |  |
| GET | `/api/plugin/task/marketplace/sources` | `GetTaskPluginMarketplaceSources` | `api-router.go:270` |  |
| PUT | `/api/plugin/task/marketplace/sources` | `UpdateTaskPluginMarketplaceSources` | `api-router.go:271` |  |
| GET | `/api/plugin/task/runtime/status` | `GetTaskPluginRuntime` | `api-router.go:269` |  |
| GET | `/api/prefill_group/` | `GetPrefillGroups` | `api-router.go:371` |  |
| POST | `/api/prefill_group/` | `CreatePrefillGroup` | `api-router.go:372` |  |
| PUT | `/api/prefill_group/` | `UpdatePrefillGroup` | `api-router.go:373` |  |
| DELETE | `/api/prefill_group/:id` | `DeletePrefillGroup` | `api-router.go:374` |  |
| GET | `/api/pricing` | `GetPricing` | `api-router.go:38` |  |
| GET | `/api/privacy-policy` | `GetPrivacyPolicy` | `api-router.go:34` |  |
| GET | `/api/rankings` | `GetRankings` | `api-router.go:45` |  |
| GET | `/api/ratio_config` | `GetRatioConfig` | `api-router.go:62` |  |
| GET | `/api/ratio_sync/channels` | `GetSyncableChannels` | `api-router.go:260` |  |
| POST | `/api/ratio_sync/fetch` | `FetchUpstreamRatios` | `api-router.go:261` |  |
| GET | `/api/redemption/` | `GetAllRedemptions` | `api-router.go:312` |  |
| POST | `/api/redemption/` | `AddRedemption` | `api-router.go:315` |  |
| PUT | `/api/redemption/` | `UpdateRedemption` | `api-router.go:317` |  |
| DELETE | `/api/redemption/:id` | `DeleteRedemption` | `api-router.go:319` |  |
| GET | `/api/redemption/:id` | `GetRedemption` | `api-router.go:314` |  |
| POST | `/api/redemption/batch` | `DeleteRedemptionBatch` | `api-router.go:316` |  |
| DELETE | `/api/redemption/invalid` | `DeleteInvalidRedemption` | `api-router.go:318` |  |
| GET | `/api/redemption/search` | `SearchRedemptions` | `api-router.go:313` |  |
| GET | `/api/reset_password` | `SendPasswordResetEmail` | `api-router.go:47` |  |
| GET | `/api/setup` | `GetSetup` | `api-router.go:26` |  |
| POST | `/api/setup` | `PostSetup` | `api-router.go:27` |  |
| GET | `/api/status` | `GetStatus` | `api-router.go:28` |  |
| GET | `/api/status/test` | `TestStatus` | `api-router.go:31` |  |
| POST | `/api/stripe/webhook` | `StripeWebhook` | `api-router.go:64` |  |
| POST | `/api/subscription/admin/bind` | `AdminBindSubscription` | `api-router.go:196` |  |
| GET | `/api/subscription/admin/plans` | `AdminListSubscriptionPlans` | `api-router.go:192` |  |
| POST | `/api/subscription/admin/plans` | `AdminCreateSubscriptionPlan` | `api-router.go:193` |  |
| PATCH | `/api/subscription/admin/plans/:id` | `AdminUpdateSubscriptionPlanStatus` | `api-router.go:195` |  |
| PUT | `/api/subscription/admin/plans/:id` | `AdminUpdateSubscriptionPlan` | `api-router.go:194` |  |
| POST | `/api/subscription/admin/plans/:id/subscriptions/reset` | `AdminResetPlanSubscriptions` | `api-router.go:197` |  |
| DELETE | `/api/subscription/admin/user_subscriptions/:id` | `AdminDeleteUserSubscription` | `api-router.go:204` |  |
| POST | `/api/subscription/admin/user_subscriptions/:id/invalidate` | `AdminInvalidateUserSubscription` | `api-router.go:203` |  |
| GET | `/api/subscription/admin/users/:id/subscriptions` | `AdminListUserSubscriptions` | `api-router.go:200` |  |
| POST | `/api/subscription/admin/users/:id/subscriptions` | `AdminCreateUserSubscription` | `api-router.go:201` |  |
| POST | `/api/subscription/admin/users/:id/subscriptions/reset` | `AdminResetUserSubscriptionsByPlan` | `api-router.go:202` |  |
| POST | `/api/subscription/balance/pay` | `SubscriptionRequestBalancePay` | `api-router.go:183` |  |
| POST | `/api/subscription/creem/pay` | `SubscriptionRequestCreemPay` | `api-router.go:186` |  |
| GET | `/api/subscription/epay/notify` | `SubscriptionEpayNotify` | `api-router.go:209` |  |
| POST | `/api/subscription/epay/notify` | `SubscriptionEpayNotify` | `api-router.go:208` |  |
| POST | `/api/subscription/epay/pay` | `SubscriptionRequestEpay` | `api-router.go:184` |  |
| GET | `/api/subscription/epay/return` | `SubscriptionEpayReturn` | `api-router.go:210` |  |
| POST | `/api/subscription/epay/return` | `SubscriptionEpayReturn` | `api-router.go:211` |  |
| GET | `/api/subscription/plans` | `GetSubscriptionPlans` | `api-router.go:180` |  |
| GET | `/api/subscription/self` | `GetSubscriptionSelf` | `api-router.go:181` |  |
| PUT | `/api/subscription/self/preference` | `UpdateSubscriptionPreference` | `api-router.go:182` |  |
| POST | `/api/subscription/stripe/pay` | `SubscriptionRequestStripePay` | `api-router.go:185` |  |
| POST | `/api/subscription/waffo-pancake/pay` | `SubscriptionRequestWaffoPancakePay` | `api-router.go:187` |  |
| GET | `/api/system-info/instances` | `ListSystemInstances` | `api-router.go:346` |  |
| DELETE | `/api/system-info/instances/:node_name` | `DeleteStaleSystemInstance` | `api-router.go:348` |  |
| DELETE | `/api/system-info/stale-instances` | `DeleteStaleSystemInstances` | `api-router.go:347` |  |
| GET | `/api/system-task/:task_id` | `GetSystemTask` | `api-router.go:341` |  |
| GET | `/api/system-task/current` | `GetCurrentSystemTask` | `api-router.go:340` |  |
| DELETE | `/api/system-task/history` | `DeleteSystemTaskHistory` | `api-router.go:339` |  |
| GET | `/api/system-task/list` | `ListSystemTasks` | `api-router.go:338` |  |
| POST | `/api/system-task/log-cleanup` | `CreateLogCleanupSystemTask` | `api-router.go:337` |  |
| GET | `/api/task` | `GetAllTask` | `api-router.go:384` |  |
| GET | `/api/task_plugin_options` |  | `api-router.go:280` | Casbin 权限路由 |
| GET | `/api/task/:task_id/artifacts` | `GetDashboardTaskArtifacts` | `api-router.go:385` |  |
| GET | `/api/task/self` | `GetUserTask` | `api-router.go:383` |  |
| GET | `/api/token/` | `GetAllTokens` | `api-router.go:287` |  |
| POST | `/api/token/` | `AddToken` | `api-router.go:292` |  |
| PUT | `/api/token/` | `UpdateToken` | `api-router.go:293` |  |
| DELETE | `/api/token/:id` | `DeleteToken` | `api-router.go:294` |  |
| GET | `/api/token/:id` | `GetToken` | `api-router.go:290` |  |
| POST | `/api/token/:id/key` | `GetTokenKey` | `api-router.go:291` |  |
| GET | `/api/token/auto-groups` | `GetTokenAutoGroups` | `api-router.go:289` |  |
| POST | `/api/token/batch` | `DeleteTokenBatch` | `api-router.go:295` |  |
| POST | `/api/token/batch/keys` | `GetTokenKeysBatch` | `api-router.go:296` |  |
| GET | `/api/token/search` | `SearchTokens` | `api-router.go:288` |  |
| GET | `/api/uptime/status` | `GetUptimeKumaStatus` | `api-router.go:29` |  |
| GET | `/api/usage/token/` | `GetTokenUsage` | `api-router.go:305` |  |
| GET | `/api/user-agreement` | `GetUserAgreement` | `api-router.go:33` |  |
| GET | `/api/user/` | `GetAllUsers` | `api-router.go:156` |  |
| POST | `/api/user/` | `CreateUser` | `api-router.go:164` |  |
| PUT | `/api/user/` | `UpdateUser` | `api-router.go:166` |  |
| DELETE | `/api/user/:id` | `DeleteUser` | `api-router.go:167` |  |
| GET | `/api/user/:id` | `GetUser` | `api-router.go:163` |  |
| DELETE | `/api/user/:id/2fa` | `AdminDisable2FA` | `api-router.go:172` |  |
| DELETE | `/api/user/:id/bindings/:binding_type` | `AdminClearUserBinding` | `api-router.go:162` |  |
| GET | `/api/user/:id/oauth/bindings` | `GetUserOAuthBindingsByAdmin` | `api-router.go:160` |  |
| DELETE | `/api/user/:id/oauth/bindings/:provider_id` | `UnbindCustomOAuthByAdmin` | `api-router.go:161` |  |
| DELETE | `/api/user/:id/reset_passkey` | `AdminResetPasskey` | `api-router.go:168` |  |
| POST | `/api/user/2fa/backup_codes` | `RegenerateBackupCodes` | `api-router.go:142` |  |
| POST | `/api/user/2fa/disable` | `Disable2FA` | `api-router.go:141` |  |
| POST | `/api/user/2fa/enable` | `Enable2FA` | `api-router.go:140` |  |
| POST | `/api/user/2fa/setup` | `Setup2FA` | `api-router.go:139` |  |
| GET | `/api/user/2fa/stats` | `Admin2FAStats` | `api-router.go:171` |  |
| GET | `/api/user/2fa/status` | `Get2FAStatus` | `api-router.go:138` |  |
| GET | `/api/user/access_tokens` | `ListAccessTokens` | `api-router.go:107` |  |
| POST | `/api/user/access_tokens` | `CreateAccessToken` | `api-router.go:110` |  |
| DELETE | `/api/user/access_tokens/:id` | `DeleteAccessToken` | `api-router.go:112` |  |
| PATCH | `/api/user/access_tokens/:id` | `UpdateAccessToken` | `api-router.go:111` |  |
| GET | `/api/user/access_tokens/catalog` | `GetAccessTokenCatalog` | `api-router.go:108` |  |
| DELETE | `/api/user/access_tokens/legacy` | `RevokeLegacyAccessToken` | `api-router.go:113` |  |
| GET | `/api/user/access_tokens/scopes` | `GetAccessTokenScopes` | `api-router.go:109` |  |
| GET | `/api/user/aff` | `GetAffCode` | `api-router.go:121` |  |
| POST | `/api/user/aff_transfer` | `TransferAffQuota` | `api-router.go:134` |  |
| POST | `/api/user/amount` | `RequestAmount` | `api-router.go:126` |  |
| POST | `/api/user/auth/logout` | `AuthLogout` | `api-router.go:78` |  |
| POST | `/api/user/auth/refresh` | `RefreshAuth` | `api-router.go:77` |  |
| GET | `/api/user/checkin` | `GetCheckinStatus` | `api-router.go:145` |  |
| POST | `/api/user/checkin` | `DoCheckin` | `api-router.go:146` |  |
| POST | `/api/user/creem/pay` | `RequestCreemPay` | `api-router.go:129` |  |
| GET | `/api/user/epay/notify` | `EpayNotify` | `api-router.go:90` |  |
| POST | `/api/user/epay/notify` | `EpayNotify` | `api-router.go:89` |  |
| GET | `/api/user/groups` | `GetUserGroups` | `api-router.go:91` |  |
| POST | `/api/user/login` | `Login` | `api-router.go:81` |  |
| POST | `/api/user/login/2fa` | `Verify2FALogin` | `api-router.go:82` |  |
| GET | `/api/user/login/encryption-key` | `GetPasswordEncryptionKey` | `api-router.go:80` |  |
| POST | `/api/user/login/passkey/begin` | `LoginPasskeyBegin` | `api-router.go:84` |  |
| POST | `/api/user/login/passkey/finish` | `LoginPasskeyFinish` | `api-router.go:85` |  |
| POST | `/api/user/login/verify` | `VerifyLogin` | `api-router.go:83` |  |
| POST | `/api/user/manage` | `ManageUser` | `api-router.go:165` |  |
| GET | `/api/user/models` | `GetUserModels` | `api-router.go:101` |  |
| GET | `/api/user/oauth/bindings` | `GetUserOAuthBindings` | `api-router.go:149` |  |
| DELETE | `/api/user/oauth/bindings/:provider_id` | `UnbindCustomOAuth` | `api-router.go:150` |  |
| DELETE | `/api/user/passkey` | `PasskeyDelete` | `api-router.go:120` |  |
| GET | `/api/user/passkey` | `PasskeyStatus` | `api-router.go:115` |  |
| POST | `/api/user/passkey/login/begin` | `PasskeyLoginBegin` | `api-router.go:86` |  |
| POST | `/api/user/passkey/login/finish` | `PasskeyLoginFinish` | `api-router.go:87` |  |
| POST | `/api/user/passkey/register/begin` | `PasskeyRegisterBegin` | `api-router.go:116` |  |
| POST | `/api/user/passkey/register/finish` | `PasskeyRegisterFinish` | `api-router.go:117` |  |
| POST | `/api/user/passkey/verify/begin` | `PasskeyVerifyBegin` | `api-router.go:118` |  |
| POST | `/api/user/passkey/verify/finish` | `PasskeyVerifyFinish` | `api-router.go:119` |  |
| POST | `/api/user/pay` | `RequestEpay` | `api-router.go:125` |  |
| POST | `/api/user/register` | `Register` | `api-router.go:79` |  |
| POST | `/api/user/reset` | `ResetPassword` | `api-router.go:48` |  |
| GET | `/api/user/search` | `SearchUsers` | `api-router.go:159` |  |
| DELETE | `/api/user/self` | `DeleteSelf` | `api-router.go:103` |  |
| GET | `/api/user/self` | `GetSelf` | `api-router.go:100` |  |
| PUT | `/api/user/self` | `UpdateSelf` | `api-router.go:102` |  |
| GET | `/api/user/self/groups` | `GetUserGroups` | `api-router.go:99` |  |
| GET | `/api/user/sessions` | `GetLoginSessions` | `api-router.go:96` |  |
| DELETE | `/api/user/sessions/:sid` | `DeleteLoginSession` | `api-router.go:97` |  |
| POST | `/api/user/sessions/revoke-others` | `RevokeOtherLoginSessions` | `api-router.go:98` |  |
| PUT | `/api/user/setting` | `UpdateUserSetting` | `api-router.go:135` |  |
| POST | `/api/user/stripe/amount` | `RequestStripeAmount` | `api-router.go:128` |  |
| POST | `/api/user/stripe/pay` | `RequestStripePay` | `api-router.go:127` |  |
| GET | `/api/user/topup` | `GetAllTopUps` | `api-router.go:157` |  |
| POST | `/api/user/topup` | `TopUp` | `api-router.go:124` |  |
| POST | `/api/user/topup/complete` | `AdminCompleteTopUp` | `api-router.go:158` |  |
| GET | `/api/user/topup/info` | `GetTopUpInfo` | `api-router.go:122` |  |
| GET | `/api/user/topup/self` | `GetUserTopUps` | `api-router.go:123` |  |
| POST | `/api/user/waffo-pancake/amount` | `RequestWaffoPancakeAmount` | `api-router.go:132` |  |
| POST | `/api/user/waffo-pancake/pay` | `RequestWaffoPancakePay` | `api-router.go:133` |  |
| POST | `/api/user/waffo/amount` | `RequestWaffoAmount` | `api-router.go:130` |  |
| POST | `/api/user/waffo/pay` | `RequestWaffoPay` | `api-router.go:131` |  |
| GET | `/api/vendors/` | `GetAllVendors` | `api-router.go:393` |  |
| POST | `/api/vendors/` | `CreateVendorMeta` | `api-router.go:396` |  |
| PUT | `/api/vendors/` | `UpdateVendorMeta` | `api-router.go:397` |  |
| DELETE | `/api/vendors/:id` | `DeleteVendorMeta` | `api-router.go:398` |  |
| GET | `/api/vendors/:id` | `GetVendorMeta` | `api-router.go:395` |  |
| POST | `/api/vendors/operations` | `ApplyVendorOperation` | `api-router.go:392` |  |
| POST | `/api/vendors/operations/preview` | `PreviewVendorOperation` | `api-router.go:391` |  |
| GET | `/api/vendors/search` | `SearchVendors` | `api-router.go:394` |  |
| GET | `/api/verification` | `SendEmailVerification` | `api-router.go:46` |  |
| POST | `/api/verify` | `UniversalVerify` | `api-router.go:73` |  |
| GET | `/api/verify/methods` | `GetVerificationMethods` | `api-router.go:72` |  |
| POST | `/api/waffo-pancake/webhook/:env` | `WaffoPancakeWebhook` | `api-router.go:69` |  |
| POST | `/api/waffo/webhook` | `WaffoWebhook` | `api-router.go:66` |  |

## 旧版计费接口 /dashboard（2 条）

| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/dashboard/billing/subscription` | `GetSubscription` | `dashboard.go:18` |  |
| GET | `/dashboard/billing/usage` | `GetUsage` | `dashboard.go:20` |  |

## Midjourney 兼容 /mj（16 条）

| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |
| --- | --- | --- | --- | --- |
| GET | `/mj/image/:id` |  | `relay-router.go:225` |  |
| POST | `/mj/insight-face/swap` | `RelayMidjourney` | `relay-router.go:242` |  |
| POST | `/mj/submit/action` | `RelayMidjourney` | `relay-router.go:228` |  |
| POST | `/mj/submit/blend` | `RelayMidjourney` | `relay-router.go:235` |  |
| POST | `/mj/submit/change` | `RelayMidjourney` | `relay-router.go:232` |  |
| POST | `/mj/submit/describe` | `RelayMidjourney` | `relay-router.go:234` |  |
| POST | `/mj/submit/edits` | `RelayMidjourney` | `relay-router.go:236` |  |
| POST | `/mj/submit/imagine` | `RelayMidjourney` | `relay-router.go:231` |  |
| POST | `/mj/submit/modal` | `RelayMidjourney` | `relay-router.go:230` |  |
| POST | `/mj/submit/shorten` | `RelayMidjourney` | `relay-router.go:229` |  |
| POST | `/mj/submit/simple-change` | `RelayMidjourney` | `relay-router.go:233` |  |
| POST | `/mj/submit/upload-discord-images` | `RelayMidjourney` | `relay-router.go:243` |  |
| POST | `/mj/submit/video` | `RelayMidjourney` | `relay-router.go:237` |  |
| GET | `/mj/task/:id/fetch` | `RelayMidjourney` | `relay-router.go:239` |  |
| GET | `/mj/task/:id/image-seed` | `RelayMidjourney` | `relay-router.go:240` |  |
| POST | `/mj/task/list-by-condition` | `RelayMidjourney` | `relay-router.go:241` |  |

## Playground /pg（1 条）

| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |
| --- | --- | --- | --- | --- |
| POST | `/pg/chat/completions` | `Playground` | `relay-router.go:69` |  |

## 模型调用与转发 /v1、/v1beta（44 条）

| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |
| --- | --- | --- | --- | --- |
| POST | `/v1/alpha/search` | `Relay` | `relay-router.go:115` |  |
| POST | `/v1/audio/speech` | `Relay` | `relay-router.go:146` |  |
| POST | `/v1/audio/transcriptions` | `Relay` | `relay-router.go:140` |  |
| POST | `/v1/audio/translations` | `Relay` | `relay-router.go:143` |  |
| POST | `/v1/chat/completions` | `Relay` | `relay-router.go:105` |  |
| POST | `/v1/completions` | `Relay` | `relay-router.go:102` |  |
| GET | `/v1/dashboard/billing/subscription` | `GetSubscription` | `dashboard.go:19` |  |
| GET | `/v1/dashboard/billing/usage` | `GetUsage` | `dashboard.go:21` |  |
| POST | `/v1/edits` | `Relay` | `relay-router.go:130` |  |
| POST | `/v1/embeddings` | `Relay` | `relay-router.go:135` |  |
| POST | `/v1/engines/:model/embeddings` | `Relay` | `relay-router.go:156` |  |
| GET | `/v1/files` | `RelayNotImplemented` | `relay-router.go:170` |  |
| POST | `/v1/files` | `RelayNotImplemented` | `relay-router.go:171` |  |
| DELETE | `/v1/files/:id` | `RelayNotImplemented` | `relay-router.go:172` |  |
| GET | `/v1/files/:id/content` | `RelayNotImplemented` | `relay-router.go:173` |  |
| GET | `/v1/fine-tunes` | `RelayNotImplemented` | `relay-router.go:175` |  |
| POST | `/v1/fine-tunes` | `RelayNotImplemented` | `relay-router.go:174` |  |
| GET | `/v1/fine-tunes/:id` | `RelayNotImplemented` | `relay-router.go:176` |  |
| POST | `/v1/fine-tunes/:id/cancel` | `RelayNotImplemented` | `relay-router.go:177` |  |
| GET | `/v1/fine-tunes/:id/events` | `RelayNotImplemented` | `relay-router.go:178` |  |
| POST | `/v1/images/variations` | `RelayNotImplemented` | `relay-router.go:169` |  |
| POST | `/v1/messages` | `Relay` | `relay-router.go:97` |  |
| GET | `/v1/models` | `ListModels` | `relay-router.go:25` |  |
| DELETE | `/v1/models/:model` | `RelayNotImplemented` | `relay-router.go:179` |  |
| GET | `/v1/models/:model` | `RetrieveModel` | `relay-router.go:36` |  |
| POST | `/v1/models/*path` | `Relay` | `relay-router.go:159` |  |
| POST | `/v1/moderations` | `Relay` | `relay-router.go:164` |  |
| GET | `/v1/realtime` | `Relay` | `relay-router.go:85` |  |
| POST | `/v1/rerank` | `Relay` | `relay-router.go:151` |  |
| GET | `/v1/responses` | `ResponsesWebSocket` | `relay-router.go:78` |  |
| POST | `/v1/responses/compact` | `Relay` | `relay-router.go:110` |  |
| GET | `/v1/tasks/:key` | `GetTask` | `task-router.go:24` |  |
| POST | `/v1/tasks/:key` | `RelayTask` | `task-router.go:18` |  |
| GET | `/v1/tasks/:key/artifacts` | `GetTaskArtifacts` | `task-router.go:25` |  |
| GET | `/v1/tasks/:key/artifacts/:artifact_key/content` | `TaskArtifactContent` | `task-router.go:34` |  |
| HEAD | `/v1/tasks/:key/artifacts/:artifact_key/content` | `TaskArtifactContent` | `task-router.go:35` |  |
| POST | `/v1/tools/fetch` | `Relay` | `relay-router.go:123` |  |
| POST | `/v1/tools/search` | `Relay` | `relay-router.go:120` |  |
| POST | `/v1/video/generations` | `RelayTask` | `video-router.go:15` |  |
| GET | `/v1/video/generations/:task_id` | `RelayTaskFetch` | `video-router.go:30` |  |
| POST | `/v1/videos/:video_id/remix` | `RelayTask` | `video-router.go:31` |  |
| GET | `/v1beta/models` | `ListModels` | `relay-router.go:50` |  |
| POST | `/v1beta/models/*path` | `Relay` | `relay-router.go:218` |  |
| GET | `/v1beta/openai/models` | `ListModels` | `relay-router.go:59` |  |

## 维护方式

官方升级后重新跑一次：

```powershell
node scripts/export-api-inventory.mjs
```

导出的条数与官方代码里实际注册数应一致；条数变化时先确认 `backend/` 是否已同步到新版本。
