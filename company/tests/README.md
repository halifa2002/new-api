# tests（核心仓库）

跨系统的验证放在这里说明，具体脚本和报告在别处：

| 类型 | 位置 | 怎么跑 |
| --- | --- | --- |
| 升级后冒烟（10 项） | `company/scripts/smoke-test.ps1` | `powershell -ExecutionPolicy Bypass -File company\scripts\smoke-test.ps1 -ApiKey sk-xxx` |
| 接口异常场景（9.2） | `company/docs/` 下的测试报告 | 按报告逐条执行 |
| 后端单元测试 | 仓库根，官方自带 | `go test ./...` |
| 前端单元测试 | `../company-portal/apps/*` | `npm run test:unit` |
| 升级演练 | `company/scripts/upgrade-official.ps1` + 报告 | 见 `company/docs/UPGRADE-REPORT-*.md` |

## 为什么这里没有测试文件

测试都贴着代码放（Go 的 `_test.go`、前端的 `__tests__`），这里只做索引。
出现**跨仓库、跨服务**的测试（比如从官网下单到后台扣费的全链路）时，再在这里放脚本。
