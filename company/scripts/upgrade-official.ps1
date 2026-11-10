<#
.SYNOPSIS
  把官方某个发布版本同步进 backend/，再自动重放公司补丁。

.DESCRIPTION
  对应领导 md 3.3 第 7 条的「可重复补丁应用」，3.1 的「补丁可追踪、可重复应用」。
  脚本按顺序做这些事：

    1. 检查工作区是否干净（有未提交改动就停下）
    2. 解析官方 tag 对应的提交（本地没有就先去 upstream 拉标签）
    3. 把该版本的官方源码导出到临时目录
    4. 删掉 backend/ 里「官方已经删掉」的文件（只动 git 跟踪的文件，不碰 data/logs 这些运行时目录）
    5. 用官方源码覆盖 backend/
    6. 重放 company-patches\manifest.json 里登记的补丁（打不上就停下，并说明怎么修）
    7. 更新 backend\UPSTREAM.md 的版本号、提交号、引入日期
    8. 编译后端（-SkipBuild 可跳过）
    9. 汇总改动；-Commit 时自动提交

  演练（拿当前已经锁定的版本重跑，应该零差异，用来验证脚本没漏东西）：
    powershell -ExecutionPolicy Bypass -File scripts\upgrade-official.ps1 -Tag v1.0.0-rc.49 -SkipBuild

.PARAMETER Tag
  官方版本号，例如 v1.0.0-rc.50。必须带 v 前缀。

.PARAMETER Commit
  同步完成后自动 git add -A 并提交，提交信息里写清官方版本与提交号。

.PARAMETER SkipBuild
  跳过 go build 验证。只做演练时用。

.PARAMETER AllowDirty
  允许工作区有未提交改动就升级（不推荐，容易把升级和手头改动混在一起）。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Tag,

    [switch]$Commit,

    [switch]$SkipBuild,

    [switch]$AllowDirty
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $repo
$exitCode = 0
$work = $null

function Write-Step([string]$Message) {
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw [System.Exception]::new($Message)
}

try {
    if (-not (Test-Path (Join-Path $repo '.git'))) {
        Fail "这里不是 git 仓库：$repo"
    }

    # 1. 工作区必须干净
    $dirty = @(git status --porcelain)
    if ($dirty.Count -gt 0 -and -not $AllowDirty) {
        $preview = ($dirty | Select-Object -First 8) -join "`n    "
        Fail "工作区有未提交的改动，先提交或 stash 再升级。否则分不清哪些是升级带来的：`n    $preview"
    }

    # 2. 解析 tag
    Write-Step "解析官方版本 $Tag"
    $sha = $null
    $rev = @(git rev-parse "$Tag^{commit}" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $rev.Count -ge 1) { $sha = $rev[0].Trim() }

    if (-not $sha) {
        Write-Host '    本地没有这个版本，先确认官方有没有这个标签...'
        $remoteTag = @(& git ls-remote --tags upstream "refs/tags/$Tag" 2>$null)
        if ($LASTEXITCODE -ne 0 -or $remoteTag.Count -eq 0) {
            Fail "官方仓库里没有版本 $Tag。看官方发了哪些版本：git ls-remote --tags upstream | Select-String 'refs/tags/v1' | Select-Object -Last 5"
        }
        Write-Host '    官方有这个标签，只拉这一版（十几秒）...'
        & git fetch upstream --depth=1 "refs/tags/${Tag}:refs/tags/${Tag}" 2>&1 | Out-Null
        $rev = @(git rev-parse "$Tag^{commit}" 2>$null)
        if ($LASTEXITCODE -eq 0 -and $rev.Count -ge 1) { $sha = $rev[0].Trim() }
    }
    if (-not $sha) {
        Fail "本地仍然解析不到 $Tag，拉取可能失败（网络或标签名写错）。"
    }
    Write-Host "    官方提交：$sha"

    # 3. 读清单
    $manifestPath = Join-Path $repo 'company-patches\manifest.json'
    if (-not (Test-Path $manifestPath)) { Fail "找不到清单：company-patches\manifest.json" }
    $manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $owned = @($manifest.ownedFiles)
    $patchList = @($manifest.patches)
    Write-Host "    公司自有文件 $($owned.Count) 个；待重放补丁 $($patchList.Count) 个"

    # 4. 导出官方源码
    Write-Step '导出官方源码到临时目录'
    $work = Join-Path $env:TEMP ('newapi-upgrade-' + (Get-Random -Maximum 999999))
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    $tar = Join-Path $work 'official.tar'
    & git archive --format=tar -o $tar $sha
    if ($LASTEXITCODE -ne 0) { Fail 'git archive 导出失败' }

    $official = Join-Path $work 'official'
    New-Item -ItemType Directory -Force -Path $official | Out-Null
    & tar -xf $tar -C $official
    if ($LASTEXITCODE -ne 0) { Fail '解压官方源码失败' }

    $officialFiles = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    Get-ChildItem -LiteralPath $official -Recurse -File -Force | ForEach-Object {
        [void]$officialFiles.Add($_.FullName.Substring($official.Length + 1).Replace('\', '/'))
    }
    Write-Host "    官方源码 $($officialFiles.Count) 个文件"

    # 5. 删掉官方已移除的文件
    Write-Step '删除官方已移除的文件（只动 git 跟踪的文件）'
    $tracked = @(git ls-files -- backend)
    $deleted = 0
    foreach ($f in $tracked) {
        $rel = $f.Substring('backend/'.Length)
        if ($owned -contains $rel) { continue }
        if (-not $officialFiles.Contains($rel)) {
            Remove-Item -LiteralPath (Join-Path $repo $f) -Force
            $deleted = $deleted + 1
        }
    }
    Write-Host "    删除 $deleted 个"

    # 6. 覆盖
    Write-Step '用官方源码覆盖 backend/'
    & robocopy $official (Join-Path $repo 'backend') /E /COPY:DAT /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "复制官方源码失败（robocopy 退出码 $LASTEXITCODE）" }
    Write-Host '    ok'

    # 7. 重放补丁
    Write-Step '重放公司补丁'
    foreach ($p in $patchList) {
        $patchRel = $p.file -replace '/', '\'
        $patchAbs = Join-Path $repo ('company-patches\' + $patchRel)
        if (-not (Test-Path $patchAbs)) { Fail "补丁文件不存在：company-patches\$patchRel" }

        $check = @(& git apply --check $patchAbs 2>&1)
        if ($LASTEXITCODE -ne 0) {
            $detail = ($check | Select-Object -First 6) -join "`n    "
            Fail ("补丁 $($p.id) 打不上——官方这段代码变了，需要人工对齐：`n" +
                  "    1) 看 company-patches\$patchRel 的上下文，对照 backend 里对应文件改好`n" +
                  "    2) 用 git diff 重新生成这个补丁文件（路径要带 backend/ 前缀）`n" +
                  "    3) 更新 backend\PATCHES.md，然后重跑本脚本`n" +
                  "    现场：`n    $detail")
        }
        & git apply $patchAbs
        if ($LASTEXITCODE -ne 0) { Fail "补丁 $($p.id) 应用失败" }
        Write-Host "    已应用 $($p.id)：$($p.desc)"
    }

    # 8. 更新 UPSTREAM.md
    Write-Step '更新 backend\UPSTREAM.md'
    $upstreamDoc = Join-Path $repo 'backend\UPSTREAM.md'
    if (Test-Path $upstreamDoc) {
        $raw = [System.IO.File]::ReadAllText($upstreamDoc, [System.Text.Encoding]::UTF8)
        $oldTag = ''
        $m = [regex]::Match($raw, '\|\s*基线版本\s*\|\s*([^|\r\n]+?)\s*\|')
        if ($m.Success) { $oldTag = $m.Groups[1].Value.Trim() }

        # 只替换行内容，保留原有换行符，避免整文件被改写
        $raw = [regex]::Replace($raw, '\|\s*基线版本\s*\|[^\r\n]*', "| 基线版本 | $Tag |")
        $raw = [regex]::Replace($raw, '\|\s*基线 Commit SHA\s*\|[^\r\n]*', "| 基线 Commit SHA | $sha |")
        if ($oldTag -ne $Tag) {
            $today = Get-Date -Format 'yyyy-MM-dd'
            $raw = [regex]::Replace($raw, '\|\s*引入日期\s*\|[^\r\n]*', "| 引入日期 | $today |")
        }
        [System.IO.File]::WriteAllText($upstreamDoc, $raw, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "    $Tag / $($sha.Substring(0, 7))（原记录：$oldTag）"
    }
    else {
        Write-Host '    没有这个文件，跳过' -ForegroundColor Yellow
    }

    # 9. 编译
    if (-not $SkipBuild) {
        Write-Step '编译后端（go build ./...）'
        Push-Location (Join-Path $repo 'backend')
        & go build ./... 2>&1 | ForEach-Object { Write-Host "    $_" }
        $buildCode = $LASTEXITCODE
        Pop-Location
        if ($buildCode -ne 0) {
            Fail "编译失败。常见原因：官方新版依赖前端产物 backend/web/dist，先按 DEPLOY.md 构建前端再重试。"
        }
        Write-Host '    编译通过'
    }
    else {
        Write-Step '跳过编译（-SkipBuild）'
    }

    # 10. 汇总
    Write-Step '改动汇总'
    $changes = @(git status --short)
    if ($changes.Count -eq 0) {
        Write-Host '    没有任何文件变化：这个版本与当前状态等价。' -ForegroundColor Green
        Write-Host '    演练通过——说明补丁清单是完整的。' -ForegroundColor Green
        return
    }
    Write-Host "    $($changes.Count) 个文件有改动"
    $changes | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" }
    if ($changes.Count -gt 20) { Write-Host "    ...（共 $($changes.Count) 个）" }

    if ($Commit) {
        Write-Step '提交'
        & git add -A
        if ($LASTEXITCODE -ne 0) { Fail 'git add 失败' }
        $subject = "chore(upstream): 同步官方 $Tag（$($sha.Substring(0, 7))）"
        $body = "官方提交：$sha`n重放补丁：$(($patchList | ForEach-Object { $_.id }) -join ', ')"
        & git commit -m $subject -m $body | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { Fail 'git commit 失败' }
        Write-Host '    已提交。接下来按 UPGRADE.md 第四节验证，再更新 VERSION.md 的 7 项。' -ForegroundColor Yellow
    }
    else {
        $suggest = 'git add -A; git commit -m "chore(upstream): 同步官方 ' + $Tag + '"'
        Write-Host ''
        Write-Host "    没有提交。检查无误后执行：$suggest" -ForegroundColor Yellow
        Write-Host '    本次改动可以随时用 git checkout -- backend 还原。' -ForegroundColor Yellow
    }
}
catch {
    Write-Host ''
    Write-Host "[停下] $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Pop-Location
    if ($work -and (Test-Path $work)) {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}

exit $exitCode
