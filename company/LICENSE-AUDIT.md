# 第三方依赖许可证清单（传递依赖审计）

审计日期：2026-11-11
范围：后端 Go 依赖（含传递依赖）+ 前端 npm 依赖
目的：领导文档 Phase 0 第 9 项遗留的「传递依赖许可证审计」，先把「有没有雷」查出来。
边界：本文件只出清单和事实，**"要不要开源 / 要不要买商业授权"由法务定性**，不在这里下结论。

## 一、结论

| 项目 | 依赖数 | 结果 |
| --- | ---: | --- |
| 后端（Go） | 132 | 无 GPL / AGPL / SSPL 类传染性许可；96% 为 MIT / Apache-2.0 / BSD / Unlicense |
| 前端（npm） | 60 | 无 GPL / AGPL / SSPL；以 MIT 为主 |
| 需法务确认 | 5 个包 | 见第三节，均为「弱 copyleft」或「署名」类，不是传染性 |

**没有发现"用了就必须把我们的代码也开源"的依赖。** 需要法务看的只有 5 处，性质都是「保留声明 / 不修改即可 / 署名」这一档。

## 二、分布

### 2.1 后端 Go（132 个，已排除自家 relaykit / tokenkit / 主模块）

| 许可证 | 数量 |
| --- | ---: |
| MIT | 71 |
| Apache-2.0 | 31 |
| BSD-3-Clause | 22 |
| BSD-2-Clause | 3 |
| Unlicense（公有领域） | 3 |
| MPL-2.0 | 2 |

### 2.2 前端 npm（60 个）

| 许可证 | 数量 |
| --- | ---: |
| MIT | 38 |
| Apache-2.0 | 5 |
| ISC | 3 |
| 0BSD | 2 |
| MPL-2.0 | 2 |
| BSD-3-Clause | 1 |
| Apache-2.0 AND LGPL-3.0-or-later | 1 |
| CC-BY-4.0 | 1 |
| 无 license 字段（自家 `@portal/*` 工作区包） | 7 |

## 三、需要法务确认的 5 处

| 包 | 版本 | 许可证 | 用在哪 | 需要判断什么 |
| --- | --- | --- | --- | --- |
| `@img/sharp-win32-x64` | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | Next.js 图片处理的原生二进制 | LGPL 只要求「可替换该库、不修改其源码」；我们没改它。确认"以动态库形式调用"是否可接受 |
| `lightningcss` | 1.33.0 | MPL-2.0 | 构建期 CSS 处理 | MPL 是文件级 copyleft：不修改其文件就没有开源义务。确认它只在构建期出现 |
| `lightningcss-win32-x64-msvc` | 1.33.0 | MPL-2.0 | 同上（平台二进制） | 同上 |
| `caniuse-lite` | 1.0.30001823 | CC-BY-4.0 | 浏览器兼容数据（数据，不是代码） | CC-BY 要求署名；确认打包分发时是否需要附来源说明 |
| `github.com/go-sql-driver/mysql`<br>`github.com/hashicorp/go-version` | v1.7.0<br>v1.8.0 | MPL-2.0 | 数据库驱动、版本号比较 | 同 MPL：未修改即可，确认无本地改动 |

补充说明：

- **主程序自身是 AGPL-3.0**（官方许可证），这一条不是"依赖问题"，而是"我们对外提供服务时需要提供修改后的源码"。处理方式见 `company/AUDIT.md` 第九节。
- 前端 7 个无 license 字段的包是自家 `@portal/*`（`api-client`、`console`、`design-tokens`、`pricing`、`types`、`ui`、`website`）。建议给它们的 `package.json` 补一行 `"license": "UNLICENSED"`（私有、不对外），免得以后扫描工具报"未知许可"。

## 四、怎么复核

后端（离线，用本机模块缓存）：

```powershell
cd "C:\Users\lo\Desktop\chongdong-ai\New API"
$env:GOFLAGS = '-mod=mod'
$env:GOPROXY = 'off'
go list -deps -f '{{with .Module}}{{.Path}} {{.Version}} {{.Dir}}{{end}}' ./...
```

逐个模块读 `LICENSE` / `COPYING` / `UNLICENSE` 文件，按正文归类。本次结果已导出为临时 CSV，复核时可重跑同一段脚本对数量。

前端：

```powershell
cd "C:\Users\lo\Desktop\chongdong-ai\company-portal"
# 遍历 node_modules 读每个 package.json 的 license 字段
node <扫描脚本>
```

## 五、这次没做的

1. **法律定性**：MPL / LGPL / CC-BY 在「网络服务 + 不修改」场景下的具体义务，需法务给结论。
2. **AGPL 处置方案**：整包开源，还是取得官方商业授权。
3. **构建产物内含的许可证汇总页**：如果对外发布前要附第三方声明，可在此基础上生成。
