# 公司补丁与自有文件

这个目录是「升级时要把哪些改动贴回去」的唯一机器可读来源。`scripts/upgrade-official.ps1` 只认这里。

对应领导 md 3.1：「重点是确保补丁可追踪、可重复应用」；对应 md 3.3 第 7 条允许的「可重复补丁应用」。

## 两个文件的分工

| 文件 | 给谁看 | 内容 |
| --- | --- | --- |
| `manifest.json` | 给脚本看 | 哪些文件是公司自有的、要按什么顺序打哪些补丁 |
| `../backend/PATCHES.md` | 给人看 | 补丁的中文说明、编号、对应提交，便于交接和审计 |

两份必须对得上：加一个补丁文件，`manifest.json` 里加一条，`PATCHES.md` 里加一行。

## 自有文件（ownedFiles）

相对 `backend/` 的路径。升级时官方源码整目录覆盖进来，这几个文件不动：

- `Dockerfile.company` — 公司版镜像构建
- `docker-compose.company.yml` — 公司版编排
- `PATCHES.md` — 补丁清单
- `UPSTREAM.md` — 上游版本记录（升级脚本会自动更新版本号与 SHA）

## 加一个新补丁的步骤

1. 在 `backend/` 里改完官方代码，先在 `backend/PATCHES.md` 里登记编号（`P-002` 这种流水号）。
2. 生成补丁文件：

   ```powershell
   git diff -- backend/web/src/xxx > company-patches/branding/0002-说明.patch
   ```

   注意：生成的路径必须带 `backend/` 前缀（在仓库根目录执行 `git diff` 自带），否则升级时打不上。

3. 在 `manifest.json` 的 `patches` 末尾追加一条，`file` 写相对 `company-patches/` 的路径。
4. 跑一遍演练，确认零差异：

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag <当前锁定的版本> -SkipBuild
   ```

   正常情况下 `git status` 应该是空的。

## 硬规则

- 补丁必须能**干净地打上**。官方改了同一段代码时脚本会停下报错，这时人工对齐、重新生成补丁文件，**不要**把补丁改成模糊匹配。
- 不要绕过本目录直接手改 `backend/` 里的官方文件——下次升级会丢，而且没人知道丢过。
