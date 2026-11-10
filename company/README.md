# New API 公司版

基于开源项目 [New API](https://github.com/Calcium-Ion/new-api) 做的品牌化二次开发：对外换公司自己的品牌，对内保留官方完整管理能力，并保证官方升级时可跟进。

## 目录

| 目录 | 内容 |
| --- | --- |
| `backend/` | New API 官方源码（Go + 自带 React 前端），基线版本见 `backend/UPSTREAM.md`，改动登记见 `backend/PATCHES.md` |
| `frontend/` | 公司自己的品牌官网与用户控制台（尚未开工） |
| `writing-block.md` | 整体技术方案 |

## 许可证

`backend/` 是 New API 官方源码，采用 **AGPL-3.0**，版权归 QuantumNous 及贡献者所有。许可证文件与版权声明必须保留。

AGPL 的实际含义：把改造后的版本作为网络服务对外提供时，需要向使用者提供对应源码。商用前需按此要求做合规安排。

## 推送

```text
git add -A
git commit -m "说明"
git push
```

远程仓库：`https://github.com/halifa2002/New-API-chongdong`（私有）
