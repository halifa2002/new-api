# 公司补丁清单

本文件记录对官方代码做过的每一处改动。跟随官方升级时，按这份清单重新应用。

规则：**没写进来的改动视为不存在**，升级时可能被覆盖丢失。

机器读的那份在 `company-patches/manifest.json`，升级脚本只认它；这里是给人看的说明。两边必须对得上。

| 编号 | 文件/目录 | 改动内容 | 补丁文件 | 日期 | 对应提交 |
| --- | --- | --- | --- | --- | --- |
| P-001 | `web/src/styles/theme.css` | 主色调由天蓝（hue 243°/248°）改为品牌靛蓝 `#4F46E5`（hue 277°）。涉及 7 个变量：浅色与深色两套 `--primary`、`--ring`、`--chart-1`，以及 `--secondary-foreground`。仅改颜色值，不动任何布局与业务逻辑。对应 md 第五章第 4 项「修改主色调」。 | `company-patches/branding/0001-admin-primary-color.patch` | 2026-11-09 | `7286533` |

## 维护方式

1. 改官方代码前，先在表格登记一行（编号用 `P-001` 这类流水号）。
2. 改完用 `git diff` 生成补丁文件放进 `company-patches/`，同时在 `manifest.json` 的 `patches` 里加一条。
3. 提交时 commit message 带上编号，例如 `P-001: 替换后台 Logo 与品牌名`。
4. 官方升级后由脚本自动重放，不用手工贴；打不上时脚本会停下并告诉你改哪个文件。

## 升级时怎么用

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.50
```

详细流程见仓库根目录 `UPGRADE.md` 第三节。
