# extensions（扩展补丁）

官方支持 JavaScript 任务插件（`plugins/tasks/`），我们目前**没有**自定义扩展补丁。

以后如果给官方加扩展（不是改业务逻辑，而是挂新的任务插件或渠道适配），补丁文件放这里，并在 `../manifest.json` 登记一条，编号接着 `P-00x` 往下排。

## 与 branding 的区别

| 目录 | 放什么 |
| --- | --- |
| `branding/` | 换皮类改动（颜色、logo 位置），不涉及功能 |
| `extensions/` | 新增能力类改动（插件、协议适配），不修改官方既有逻辑 |

两者都必须能重复应用，且升级时由 `company/scripts/upgrade-official.ps1` 或人工核对。
