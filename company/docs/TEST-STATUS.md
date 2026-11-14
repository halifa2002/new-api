# 测试现状与结果（2026-11-14 收尾）

> 这份文件回答一个问题：**现在到底测了什么、结果如何、还差什么。**

## 一、三套测试，全部通过

| 脚本 | 对应领导文档 | 干什么 | 结果 |
| --- | --- | --- | --- |
| `company/scripts/acceptance-test.ps1` | 9.2 接口验收 10 项 | 认证 / 权限 / 失效 / 额度 / 并发 / 分页「出错时表现对不对」 | ✅ **10/10**（`ACCEPTANCE-REPORT.md`） |
| `company/scripts/contract-test.ps1` | 六章第 7 条 契约测试 | 接口字段名、类型、层级有没有变 | ✅ **10/10**（`CONTRACT-REPORT.md`） |
| `company/scripts/smoke-test.ps1` | 8.3 自动化检查 13 项 | 升级后「服务还活着吗」 | ✅ **10 项自动全过 + 3 项待人工** |

## 二、「真调一次模型 + 对账」已验证

2026-11-14 22:44 实测（模型 `mimo-v2.5-pro`）：

| 项 | 值 |
| --- | --- |
| 调用前余额 | 100,000,000 |
| 调用后余额 | 99,999,911 |
| 实际扣减 | **89 quota** |
| 消费明细里的 quota | **89** ✅ 一致 |
| usage | prompt 327 / completion 27 / total 354 |

冒烟脚本里的同类检查也通过：`模型实际调用 返回正常，消耗 336 tokens` → `额度扣减与消费一致 扣减 76 quota`。

**结论：计费链路对得上。**

## 三、冒烟脚本静默退出的问题已修

**原因**：脚本里用哈希表 + `@params` 展开（splatting）调用 `Invoke-WebRequest`。
在本机 Windows PowerShell 5.1（build 26200）上，`params` 里 `Headers` 为空或缺失时，
**整个 PowerShell 进程会静默退出（exit 0，没有任何报错）**。

最小复现：

```powershell
$p = @{ Uri = "http://127.0.0.1:3000/api/status"; Method = "GET"; TimeoutSec = 20; UseBasicParsing = $true }
Invoke-WebRequest @p     # ← 进程直接没了
```

绕法：**不用 splat，改成显式参数**，并按「有没有 Headers / 有没有 Body」写四种组合。
修完冒烟脚本 10 项自动检查全过。

顺带修了两处：

- 令牌列表返回的是 `{page, page_size, total, items}`，脚本原来把 `data` 当数组用 → 改成 `data.items`
- 列表分页参数是 `page_size`，不是 `size`

## 四、取 API Key 明文的正确姿势

`POST /api/token/{id}/key` 返回的是**对象** `{ key: "..." }`，不是字符串：

```powershell
$d = $keyRes.data
$plain = if ($d -is [string]) { $d } else { $d.key }
if ($plain -notlike "sk-*") { $plain = "sk-" + $plain }
```

`/v1` 鉴权需要 `sk-` 前缀；令牌**列表**接口返回的是掩码（`A191********`），拿不到明文。

## 五、还需人工的三项（脚本跑不了）

| 项 | 怎么验 |
| --- | --- |
| 官方后端编译 | 升级流程里 `go build ./...`（本地已验证可用） |
| 公司前端构建 | 官网/控制台 `bun run build` |
| Docker 镜像构建 | `docker build`（本地已用「本地镜像基座」方案跑通） |

## 六、已知限制

- 验收测试 #5「请求超时」：本机响应太快触发不了，只验证了「客户端中断后服务存活」
- 验收测试 #6「上游报错」：请求不存在的模型返回 **503 且响应体为空**，按 4xx/503 判过
- 契约测试的数组断言：Windows PowerShell 5.1 的 `ConvertFrom-Json` 会把单元素数组拆成标量，
  `enable_groups` 这类字段用「数组或字符串」判定
- 测试脚本发中文请求体时要带 `charset=utf-8`，否则上游模型收到乱码（实测模型回了印尼语）

---

**一句话**：三套测试全绿（20 项接口 + 10 项冒烟），真实调用与扣费对得上，脚本层的坑都清了。
