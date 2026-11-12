# 公司补丁清单

本文件记录对官方代码做过的每一处改动。跟随官方升级时，按这份清单重新应用。

规则：**没写进来的改动视为不存在**，升级时可能被覆盖丢失。

机器读的那份在 `company/patches/manifest.json`，两边必须对得上。

注意：升级脚本自改为 Fork 模式后，实际是把官方 tag `git merge` 进来，改动由提交历史带过，不再靠整目录覆盖后重放补丁。`manifest.json` 与本文的补丁文件仍保留，用作改动台账和人工对齐依据——但前提是**改动已经提交**，留在工作区没提交的改动会让升级脚本直接停下。

| 编号 | 文件/目录 | 改动内容 | 补丁文件 | 日期 | 对应提交 |
| --- | --- | --- | --- | --- | --- |
| P-001 | `web/src/styles/theme.css` | 主色调由天蓝（hue 243°/248°）改为品牌靛蓝 `#4F46E5`（hue 277°）。涉及 7 个变量：浅色与深色两套 `--primary`、`--ring`、`--chart-1`，以及 `--secondary-foreground`。仅改颜色值，不动任何布局与业务逻辑。对应 md 第五章第 4 项「修改主色调」。 | `company/patches/branding/0001-admin-primary-color.patch` | 2026-11-09 | `7286533` |
| P-002 | `model/user_session.go`<br>`service/auth_session.go`<br>`service/auth_session_test.go` | **修缺陷（fixes 类，改动官方既有逻辑）**：同一账号、同一设备（IP + User-Agent 完全相同）重新登录时，先把该设备的旧会话置为 `revoked`（reason=`relogin_same_device`），只留新会话；空 IP 或空 UA 一律跳过，避免空值匹配把整个账号的会话清空。<br>现象：控制台「登录设备」把每条会话当一台设备，同一浏览器登录 N 次就显示 N 台（实测 24 台），且会顶满 `USER_SESSION_ACTIVE_LIMIT=50` 把本人锁在门外。<br>边界：不涉及计费、渠道路由，不改数据库表结构，只做会话行状态更新。<br>测试：新增 `TestCreateLoginSessionReplacesSameDeviceSession`；`TestCreateLoginSessionEnforcesActiveLimitAcrossAuthVersions` 两次调用改用不同 UA（同 UA 会就地顶替，测不到上限）。对应 md 第六章「如必须修改官方后端，建立独立补丁和自动化测试」。 | `company/patches/fixes/0002-session-dedup-same-device.patch` | 2026-11-12 | `cf20d65d` |

## 维护方式

1. 改官方代码前，先在表格登记一行（编号用 `P-001` 这类流水号）。
2. 改完用 `git diff` 生成补丁文件放进 `company/patches/<分类>/`，同时在 `manifest.json` 的 `patches` 里加一条。
3. 提交时 commit message 带上编号，例如 `P-001: 替换后台 Logo 与品牌名`。
4. 官方升级用 Fork 模式 `git merge`，改动随提交历史带过；冲突时脚本会停下并指出文件。补丁文件留作人工对齐与旧渠道参考。

## 升级时怎么用

```powershell
powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.50
```

详细流程见仓库根目录 `UPGRADE.md` 第三节。
