<#
.SYNOPSIS
  把官方某个发布版本合并进来（Fork 模式）。

.DESCRIPTION
  仓库是从官方分出来的 Fork，官方代码与我们在同一棵提交历史里。
  升级不再整包替换 backend/，而是用 git 合并官方 tag：

    1. 检查工作区是否干净（有未提交改动就停下）
    2. 解析官方 tag（本地没有就去 upstream 拉）
    3. 从当前分支切出升级分支 upgrade/<tag>
    4. git merge 该 tag；有冲突就停下并列出冲突文件
    5. 编译后端（-SkipBuild 可跳过）
    6. 提示后续动作：解决冲突、跑冒烟、更新 VERSION.md

  与旧版脚本的区别：旧版把官方源码整包覆盖到 backend/ 再重放补丁；
  Fork 之后不需要了——git 自己会算差异，我们只处理冲突（通常只有主题色那一处）。

.PARAMETER Tag
  官方版本号，例如 v1.0.0-rc.50。必须带 v 前缀。

.PARAMETER SkipBuild
  跳过 go build 验证。只做演练时用。

.PARAMETER Continue
  冲突已经手工解决、并且 git add 过之后，用这个参数继续完成合并提交。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Tag,

    [switch]$SkipBuild,

    [switch]$Continue
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
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
    if (-not (Test-Path (Join-Path $repo '.git'))) {
        Fail "这里不是 git 仓库：$repo"
    }

    # 继续模式：冲突已解决，直接提交
    if ($Continue) {
        Write-Step '继续完成合并'
        $unmerged = @(git diff --name-only --diff-filter=U)
        if ($unmerged.Count -gt 0) {
            Fail ("还有 $($unmerged.Count) 个文件没解决冲突：`n    " + ($unmerged -join "`n    "))
        }
        & git commit --no-edit
        if ($LASTEXITCODE -ne 0) { Fail '合并提交失败' }
        Write-Host '    合并已提交。接下来：跑 smoke-test.ps1，更新 company/VERSION.md。' -ForegroundColor Yellow
        return
    }

    # 1. 工作区必须干净
    $dirty = @(git status --porcelain)
    if ($dirty.Count -gt 0) {
        $preview = ($dirty | Select-Object -First 8) -join "`n    "
        Fail "工作区有未提交的改动，先提交或 stash 再升级：`n    $preview"
    }

    # 2. 解析 tag
    Write-Step "解析官方版本 $Tag"
    $sha = $null
    $rev = @(git rev-parse "$Tag^{commit}" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $rev.Count -ge 1) { $sha = $rev[0].Trim() }

    if (-not $sha) {
        $hasUpstream = @(git remote | Where-Object { $_ -eq 'upstream' }).Count -gt 0
        if (-not $hasUpstream) {
            Fail "本地没有 $Tag，也没有配置 upstream 远程。先执行：git remote add upstream https://github.com/QuantumNous/new-api.git"
        }
        Write-Host '    本地没有这个版本，去官方拉标签...'
        & git fetch upstream --tags 2>&1 | Out-Null
        $rev = @(git rev-parse "$Tag^{commit}" 2>$null)
        if ($LASTEXITCODE -eq 0 -and $rev.Count -ge 1) { $sha = $rev[0].Trim() }
    }
    if (-not $sha) { Fail "解析不到 $Tag（网络或标签名不对）。" }
    Write-Host "    官方提交：$sha"

    # 3. 切升级分支
    $branch = "upgrade/$Tag"
    $current = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($current -ne $branch) {
        Write-Step "从 $current 切出 $branch"
        $exists = @(git branch --list $branch).Count -gt 0
        if ($exists) { Fail "分支 $branch 已存在，先删掉或换个名字。" }
        & git switch -c $branch
        if ($LASTEXITCODE -ne 0) { Fail '切分支失败' }
    }

    # 4. 合并
    Write-Step "合并官方 $Tag"
    & git merge --no-ff --no-commit $Tag 2>&1 | ForEach-Object { Write-Host "    $_" }
    $mergeCode = $LASTEXITCODE

    $conflicts = @(git diff --name-only --diff-filter=U)
    if ($conflicts.Count -gt 0) {
        Write-Host ''
        Write-Host "[有冲突] $($conflicts.Count) 个文件需要人工处理：" -ForegroundColor Yellow
        foreach ($c in $conflicts) { Write-Host "    $c" }
        Write-Host ''
        Write-Host '    通常是主题色那处（web/src/styles/theme.css）。处理办法：' -ForegroundColor Yellow
        Write-Host '      1) 打开冲突文件，保留公司品牌色（#4F46E5 / #6366F1 / #4338CA / #818CF8），其余取官方新版' -ForegroundColor Yellow
        Write-Host '      2) git add <文件>' -ForegroundColor Yellow
        Write-Host "      3) powershell -ExecutionPolicy Bypass -File company\scripts\upgrade-official.ps1 -Tag $Tag -Continue" -ForegroundColor Yellow
        Write-Host '    本次合并先停在这里，不提交。' -ForegroundColor Yellow
        return
    }

    if ($mergeCode -ne 0) {
        Fail "合并失败（退出码 $mergeCode），看上面输出。"
    }

    # 5. 编译
    if (-not $SkipBuild) {
        Write-Step '编译（go build ./...）'
        & go build ./... 2>&1 | ForEach-Object { Write-Host "    $_" }
        $buildCode = $LASTEXITCODE
        if ($buildCode -ne 0) {
            Fail "编译失败。常见原因：web/dist 缺失，先在 web/ 下 bun run build。"
        }
        Write-Host '    编译通过'
    }
    else {
        Write-Step '跳过编译（-SkipBuild）'
    }

    # 6. 汇总
    Write-Step '合并结果'
    $changes = @(git status --short)
    Write-Host "    $($changes.Count) 个文件有改动"
    $changes | Select-Object -First 15 | ForEach-Object { Write-Host "    $_" }
    if ($changes.Count -gt 15) { Write-Host "    ...（共 $($changes.Count) 个）" }

    Write-Host ''
    Write-Host '    确认无误后提交：' -ForegroundColor Yellow
    Write-Host "      git commit -m `"chore(upstream): 合并官方 $Tag`"" -ForegroundColor Yellow
    Write-Host '    然后：跑 company\scripts\smoke-test.ps1，更新 company\VERSION.md 的 7 项，合回 main。' -ForegroundColor Yellow
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
