<#
.SYNOPSIS
  发一个公司版本：从 develop 切出 release 分支 → 跑检查 → 合进 main → 打版本标签。

.DESCRIPTION
  对应领导 md 3.1 的分支策略：main 只接收验过的代码，日常改动走 develop。
  这个脚本就是把这条规矩变成一条命令，免得靠人记。

  做完脚本还会提醒你后面四件事（更新版本记录、构建镜像、部署、回滚方案）。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\make-release.ps1 -Version 0.2.0

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\make-release.ps1 -Version 0.2.0 -SkipChecks -Push
  跳过单元测试并直接推远端（只在明确知道自己在干什么时用）。

.PARAMETER Version
  公司版本号，三段数字，例如 0.2.0。不要带 v。

.PARAMETER SkipChecks
  跳过单元测试。冒烟测试不在脚本里跑（要服务在跑），见 scripts\smoke-test.ps1。

.PARAMETER Push
  合并打标签后直接推 main 与标签到 origin。

.PARAMETER KeepBranch
  保留 release 分支，方便事后查。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version,

    [switch]$SkipChecks,

    [switch]$Push,

    [switch]$KeepBranch
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $repo
$exitCode = 0

function Write-Step([string]$Message) {
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw [System.Exception]::new($Message)
}

try {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Fail "版本号要三段数字，例如 0.2.0，不要带 v 前缀（当前填的是 $Version）"
    }
    $branch = "release/v$Version"
    $tag = "company-v$Version"

    $dirty = @(git status --porcelain)
    if ($dirty.Count -gt 0) {
        Fail "工作区有未提交的改动，先提交再发版：`n    $(($dirty | Select-Object -First 5) -join "`n    ")"
    }

    $current = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($current -ne 'develop') {
        Fail "发版要从 develop 切出来，现在在 $current。先执行：git switch develop"
    }

    $existing = @(git tag --list $tag)
    if ($existing.Count -gt 0) {
        Fail "标签 $tag 已经有了，版本号不能重复用；换个号或者先删旧标签"
    }

    Write-Step "从 develop 切出 $branch"
    & git switch -c $branch
    if ($LASTEXITCODE -ne 0) { Fail '建分支失败' }

    if (-not $SkipChecks) {
        Write-Step '跑前端单元测试'
        Push-Location (Join-Path $repo 'frontend')
        & bun --cwd apps/website run test:unit 2>&1 | ForEach-Object { Write-Host "    $_" }
        $testCode = $LASTEXITCODE
        Pop-Location
        if ($testCode -ne 0) {
            Fail '单元测试没过，先修好再发版；确认要跳过就加 -SkipChecks'
        }
        Write-Host '    通过' -ForegroundColor Green
        Write-Host '    冒烟测试要服务在跑，单独跑：powershell -File scripts\smoke-test.ps1' -ForegroundColor Yellow
    }
    else {
        Write-Step '跳过检查（-SkipChecks）'
    }

    Write-Step '合进 main'
    & git switch main
    if ($LASTEXITCODE -ne 0) { Fail '切到 main 失败' }
    & git merge --no-ff $branch -m "release: v$Version"
    if ($LASTEXITCODE -ne 0) { Fail '合并失败，可能有冲突。解决后手动提交，再重跑本脚本' }

    Write-Step "打标签 $tag"
    & git tag -a $tag -m "公司版 v$Version"
    if ($LASTEXITCODE -ne 0) { Fail '打标签失败' }

    if (-not $KeepBranch) {
        & git branch -d $branch 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { & git branch -D $branch 2>&1 | Out-Null }
        Write-Host "    已删掉临时分支 $branch"
    }

    if ($Push) {
        Write-Step '推送到远端'
        & git push origin main
        & git push origin $tag
    }
    else {
        Write-Host ''
        Write-Host "    没推。要推执行：git push origin main; git push origin $tag" -ForegroundColor Yellow
    }

    Write-Step '接下来还要做四件事'
    Write-Host '    1) 更新 VERSION.md 的 7 项（公司版本 / 官方版本 / 官方 SHA / 补丁号 / Portal 版本 / 数据库 / 镜像标签）'
    Write-Host "    2) 构建镜像：docker build -f backend/Dockerfile.company -t company-newapi:$Version backend"
    Write-Host '    3) 按 DEPLOY.md 部署，然后跑 scripts\smoke-test.ps1'
    Write-Host '    4) 出问题按 ROLLBACK.md 退回上一版'
    Write-Host ''
    Write-Host "    现在停在 main 分支，版本 v$Version 已打过标签。" -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host "[停下] $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Pop-Location
}

exit $exitCode
