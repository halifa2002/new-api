# 接口契约测试报告

- 目标地址：`http://127.0.0.1:3000`
- 执行时间：2026-11-14 21:13:16
- 结果：**通过 10 / 10**（失败 0）
- 依据：领导文档第六章第 7 条「对官方接口进行契约测试」

| 用例 | 接口 | 结果 | 问题 |
| --- | --- | --- | --- |
| 系统状态：版本与品牌字段 | `GET /api/status` | PASS |  |
| 当前用户：身份与额度字段 | `GET /api/user/self` | PASS |  |
| 令牌列表：分页外壳与条目字段 | `GET /api/token/` | PASS |  |
| 消费日志：分页外壳与条目字段 | `GET /api/log/self` | PASS |  |
| 消费统计：按时间范围 | `GET /api/log/self/stat` | PASS |  |
| 用量曲线：按日期聚合 | `GET /api/data/self` | PASS |  |
| 模型定价：价格字段 | `GET /api/pricing` | PASS |  |
| 系统设置：键值对数组 | `GET /api/option/` | PASS |  |
| 模型列表（v1）：OpenAI 兼容外壳 | `GET /v1/models` | PASS |  |
| 错误契约：未认证访问返回 401 | `GET /api/user/self` | PASS |  |

> 契约指字段名、类型与层级；官方升级后若结构变化，这里会红，避免页面静默白屏。
