<#
.SYNOPSIS
    升级后冒烟测试 —— 对照领导文档 8.3「自动化检查」的 13 项。

.DESCRIPTION
    每次同步官方版本、或部署新镜像后跑一遍。只读 + 可回滚的写操作（建 Key 后立即删），
    不改动任何业务数据。

    用法（最少只需要 API Key）：
        .\scripts\smoke-test.ps1 -ApiKey sk-xxx

    带管理员账号可多验两项：
        .\scripts\smoke-test.ps1 -ApiKey sk-xxx -AdminUser root -AdminPass '***'

    退出码：0 = 全部通过；1 = 有失败项。

.NOTES
    对应 8.3 的 13 项里，以下 3 项无法由脚本完成，需人工：
      - 官方后端是否能够正常编译
      - 公司前端是否能够正常构建
      - Docker 镜像是否正常构建
    这三项在升级流程里由 CI 或手工执行，本脚本会在结果里标注「人工」。

    若提示「禁止运行脚本」，先在本进程内放开策略再执行：
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    本文件必须以 UTF-8 with BOM 保存，否则 Windows PowerShell 会按 GBK 读取，中文全部乱码。
#>
param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$ApiKey = '',
    [string]$AdminUser = '',
    [string]$AdminPass = '',
    [string]$ModelName = 'deepseek-flash'
)

$ErrorActionPreference = 'Stop'
$script:failed = 0
$script:passed = 0
$script:manual = 0

function Write-Result {
    param([string]$Name, [string]$State, [string]$Detail = '')

    switch ($State) {
        'PASS' {
            $script:passed++
            Write-Host ('  [OK]   {0}' -f $Name) -ForegroundColor Green
        }
        'FAIL' {
            $script:failed++
            Write-Host ('  [FAIL] {0}' -f $Name) -ForegroundColor Red
        }
        'MANUAL' {
            $script:manual++
            Write-Host ('  [人工] {0}' -f $Name) -ForegroundColor DarkYellow
        }
        default {
            Write-Host ('  [跳过] {0}' -f $Name) -ForegroundColor DarkGray
        }
    }

    if ($Detail) {
        Write-Host ('         {0}' -f $Detail) -ForegroundColor DarkGray
    }
}

function Invoke-Api {
    param(
        [string]$Method = 'GET',
        [string]$Path,
        [hashtable]$Headers = @{},
        $Body = $null
    )

    $uri = "$BaseUrl$Path"
    $params = @{
        Uri             = $uri
        Method          = $Method
        Headers         = $Headers
        TimeoutSec      = 30
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8)
        $params.ContentType = 'application/json'
    }

    try {
        $resp = Invoke-WebRequest @params
        return @{ Ok = $true; Status = [int]$resp.StatusCode; Body = ($resp.Content | ConvertFrom-Json) }
    }
    catch {
        $status = 0
        $content = $null
        $raw = ''
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $content = $raw | ConvertFrom-Json
            }
            catch { }
        }
        if (-not $raw) { $raw = $_.Exception.Message }
        return @{ Ok = $false; Status = $status; Body = $content; Error = $_.Exception.Message; Raw = $raw }
    }
}

Write-Host ''
Write-Host '升级后冒烟测试' -ForegroundColor Cyan
Write-Host "目标：$BaseUrl"
Write-Host ('时间：{0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Host ('-' * 60)

# ── 1. 后端可达（/api/status 返回 success） ─────────────────────────────
$status = Invoke-Api -Path '/api/status'
if ($status.Ok -and $status.Body.success) {
    $version = $status.Body.data.version
    Write-Result '后端服务可达' 'PASS' "版本 $version"
}
else {
    Write-Result '后端服务可达' 'FAIL' "状态码 $($status.Status) / $($status.Error)"
    Write-Host ''
    Write-Host '后端不可达，后续检查无法进行，提前结束。' -ForegroundColor Red
    exit 1
}

# ── 2. 数据库连接（status 能返回说明主库已就绪） ────────────────────────
# 官方 status 里的 setup 字段只有在数据库读写正常时才会返回 true
if ($status.Body.data.setup -eq $true) {
    Write-Result '数据库连接与初始化' 'PASS'
}
else {
    Write-Result '数据库连接与初始化' 'FAIL' 'status.setup 不为 true，可能未完成初始化'
}

# ── 3~4. 用户登录与用户信息（需要账号密码） ────────────────────────────
$sessionToken = $null
if ($AdminUser) {
    $login = Invoke-Api -Method POST -Path '/api/user/login' -Body @{
        username = $AdminUser
        password = $AdminPass
    }
    if ($login.Ok -and $login.Body.success) {
        $sessionToken = $login.Body.data.access_token
        Write-Result '账号登录' 'PASS'
    }
    else {
        Write-Result '账号登录' 'FAIL' "状态码 $($login.Status) / $($login.Body.message)"
    }
}
else {
    Write-Result '账号登录' 'SKIP' '未提供 -AdminUser / -AdminPass'
}

if ($sessionToken) {
    $self = Invoke-Api -Path '/api/user/self' -Headers @{ Authorization = "Bearer $sessionToken" }
    if ($self.Ok -and $self.Body.success) {
        Write-Result '用户信息查询' 'PASS' "用户 $($self.Body.data.username)"
    }
    else {
        Write-Result '用户信息查询' 'FAIL' "状态码 $($self.Status)"
    }
}
else {
    Write-Result '用户信息查询' 'SKIP' '需要登录态'
}

# ── 5. 模型列表（用 API Key 走 /v1/models） ────────────────────────────
if ($ApiKey) {
    $authHeader = @{ Authorization = "Bearer $ApiKey" }
    $models = Invoke-Api -Path '/v1/models' -Headers $authHeader
    if ($models.Ok -and $models.Body.data) {
        $ids = @($models.Body.data | ForEach-Object { $_.id })
        Write-Result '模型列表' 'PASS' ("{0} 个：{1}" -f $ids.Count, ($ids -join ', '))
        if ($ids -notcontains $ModelName) {
            Write-Host ("         注意：-ModelName {0} 不在可用列表里，后续调用会失败" -f $ModelName) -ForegroundColor DarkYellow
        }
    }
    else {
        Write-Result '模型列表' 'FAIL' "状态码 $($models.Status)"
    }
}
else {
    Write-Result '模型列表' 'SKIP' '未提供 -ApiKey'
    $authHeader = $null
}

# ── 6. 模型实际调用 + 8. 额度扣减一致性 ────────────────────────────────
if ($ApiKey) {
    $balanceBefore = $null
    if ($sessionToken) {
        $before = Invoke-Api -Path '/api/user/self' -Headers @{ Authorization = "Bearer $sessionToken" }
        if ($before.Ok) { $balanceBefore = $before.Body.data.quota }
    }

    $chat = Invoke-Api -Method POST -Path '/v1/chat/completions' -Headers $authHeader -Body @{
        model      = $ModelName
        messages   = @(@{ role = 'user'; content = 'ping' })
        max_tokens = 8
    }

    if ($chat.Ok -and $chat.Body.choices) {
        $tokens = $chat.Body.usage.total_tokens
        Write-Result '模型实际调用' 'PASS' "返回正常，消耗 $tokens tokens"

        # 额度一致性：调用后余额应减少
        if ($balanceBefore -ne $null) {
            Start-Sleep -Seconds 2   # 结算可能异步
            $after = Invoke-Api -Path '/api/user/self' -Headers @{ Authorization = "Bearer $sessionToken" }
            if ($after.Ok) {
                $delta = $balanceBefore - $after.Body.data.quota
                if ($delta -gt 0) {
                    Write-Result '额度扣减与消费一致' 'PASS' "扣减 $delta quota"
                }
                elseif ($delta -eq 0) {
                    Write-Result '额度扣减与消费一致' 'FAIL' '调用成功但余额未变化，可能结算异常'
                }
                else {
                    Write-Result '额度扣减与消费一致' 'FAIL' "余额增加了 $(-$delta)，数据可能被其它操作影响"
                }
            }
            else {
                Write-Result '额度扣减与消费一致' 'FAIL' '调用后无法读取余额'
            }
        }
        else {
            Write-Result '额度扣减与消费一致' 'SKIP' '需要登录态才能比对余额'
        }
    }
    else {
        $chatDetail = $chat.Raw
        if ($chat.Body -and $chat.Body.error) {
            if ($chat.Body.error -is [string]) { $chatDetail = $chat.Body.error }
            elseif ($chat.Body.error.message) { $chatDetail = $chat.Body.error.message }
        }
        Write-Result '模型实际调用' 'FAIL' ("状态码 {0} / {1}" -f $chat.Status, $chatDetail)
        Write-Result '额度扣减与消费一致' 'SKIP' '调用失败，无需比对'
    }
}
else {
    Write-Result '模型实际调用' 'SKIP' '未提供 -ApiKey'
    Write-Result '额度扣减与消费一致' 'SKIP' '未提供 -ApiKey'
}

# ── 7. 消费明细（需要登录态） ──────────────────────────────────────────
if ($sessionToken) {
    $logs = Invoke-Api -Path '/api/log/self?p=0&page_size=3' -Headers @{ Authorization = "Bearer $sessionToken" }
    if ($logs.Ok -and $logs.Body.success) {
        $total = $logs.Body.data.total
        Write-Result '消费明细查询' 'PASS' "共 $total 条记录"
    }
    else {
        Write-Result '消费明细查询' 'FAIL' "状态码 $($logs.Status)"
    }
}
else {
    Write-Result '消费明细查询' 'SKIP' '需要登录态'
}

# ── 9. API Key 创建与删除（需要登录态） ────────────────────────────────
if ($sessionToken) {
    $created = Invoke-Api -Method POST -Path '/api/token/' -Headers @{ Authorization = "Bearer $sessionToken" } -Body @{
        name           = ('smoke-test-{0}' -f (Get-Date -Format 'HHmmss'))
        remain_quota   = 0
        unlimited_quota = $true
        expired_time   = -1
    }

    if ($created.Ok -and $created.Body.success) {
        # 官方接口创建成功后不直接返回 id，回查最近一条
        $list = Invoke-Api -Path '/api/token/?p=0&size=10' -Headers @{ Authorization = "Bearer $sessionToken" }
        $newKey = $null
        if ($list.Ok -and $list.Body.data) {
            $newKey = @($list.Body.data) | Where-Object { $_.name -like 'smoke-test-*' } | Select-Object -First 1
        }

        if ($newKey) {
            $deleted = Invoke-Api -Method DELETE -Path ("/api/token/{0}" -f $newKey.id) -Headers @{ Authorization = "Bearer $sessionToken" }
            if ($deleted.Ok -and $deleted.Body.success) {
                Write-Result 'API Key 创建与删除' 'PASS' '创建后已清理'
            }
            else {
                Write-Result 'API Key 创建与删除' 'FAIL' '创建成功但删除失败，请手动清理 smoke-test-* 开头的 Key'
            }
        }
        else {
            Write-Result 'API Key 创建与删除' 'FAIL' '创建成功但回查不到记录'
        }
    }
    else {
        Write-Result 'API Key 创建与删除' 'FAIL' "状态码 $($created.Status) / $($created.Body.message)"
    }
}
else {
    Write-Result 'API Key 创建与删除' 'SKIP' '需要登录态'
}

# ── 10. 管理员功能（用管理员账号访问管理接口） ──────────────────────────
if ($sessionToken) {
    $channels = Invoke-Api -Path '/api/channel/?p=0&page_size=1' -Headers @{ Authorization = "Bearer $sessionToken" }
    if ($channels.Ok -and $channels.Body.success) {
        Write-Result '管理接口可访问（渠道）' 'PASS'
    }
    elseif ($channels.Status -eq 403) {
        Write-Result '管理接口可访问（渠道）' 'SKIP' '当前账号非管理员'
    }
    else {
        Write-Result '管理接口可访问（渠道）' 'FAIL' "状态码 $($channels.Status)"
    }
}
else {
    Write-Result '管理接口可访问（渠道）' 'SKIP' '需要登录态'
}

# ── 11~13. 无法脚本化的三项 ────────────────────────────────────────────
Write-Result '官方后端编译' 'MANUAL' '在升级流程里执行 go build ./...'
Write-Result '公司前端构建' 'MANUAL' '执行 npm run build（company/portal/apps/website 与 console）'
Write-Result 'Docker 镜像构建' 'MANUAL' '执行 cd web && bun run build；回根后 docker build -f company/Dockerfile -t company-newapi:<tag> .'

# ── 汇总 ──────────────────────────────────────────────────────────────
Write-Host ('-' * 60)
Write-Host ('通过 {0} 项 ｜ 失败 {1} 项 ｜ 待人工 {2} 项' -f $script:passed, $script:failed, $script:manual) -ForegroundColor Cyan

if ($script:failed -gt 0) {
    Write-Host '存在失败项，本次升级不应进入生产。' -ForegroundColor Red
    exit 1
}

Write-Host '自动检查全部通过，再完成人工三项即可放行。' -ForegroundColor Green
exit 0
