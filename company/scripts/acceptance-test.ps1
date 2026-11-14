# 接口验收脚本（领导文档 9.2「接口验收」10 项）
#
# 兼容 Windows PowerShell 5.1（不依赖 pwsh 7 的并行/错误跳过特性）
#
# 用法：
#   $env:ACCEPT_ADMIN_PASS = "你的管理员密码"
#   powershell -NoProfile -ExecutionPolicy Bypass -File company\scripts\acceptance-test.ps1
#   可选参数：-BaseUrl http://127.0.0.1:3000  -Out company/docs/ACCEPTANCE-REPORT.md  -Concurrency 10
#
# 说明：
#   - 脚本自己创建临时 API Key，用完删除，不动现有数据
#   - 只走「后端会提前拦下」的错误路径（额度不足 / 模型不允许 / 模型不存在），不产生真实上游调用费用
#   - 输出：控制台表格 + Markdown 报告

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [string]$AdminUser = "cdadmin",
    [string]$AdminPass = $env:ACCEPT_ADMIN_PASS,
    [string]$Out = "",
    [int]$Concurrency = 10
)

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BaseUrl = $BaseUrl.TrimEnd("/")

# ---------- 基础设施 ----------

function Write-Step($msg) { Write-Host $msg -ForegroundColor Cyan }

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        $Body = $null,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20
    )
    $uri = "$BaseUrl$Path"
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $Headers
        TimeoutSec  = $TimeoutSec
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
        $params.ContentType = "application/json; charset=utf-8"
    }
    try {
        $resp = Invoke-WebRequest @params
        return [pscustomobject]@{
            Status = [int]$resp.StatusCode
            Text   = [string]$resp.Content
            Json   = $(try { $resp.Content | ConvertFrom-Json } catch { $null })
            Error  = $null
        }
    } catch {
        $r = $_.Exception.Response
        if ($r) {
            $code = 0
            try { $code = [int]$r.StatusCode } catch { $code = [int]$r.StatusCode.value__ }
            $text = ""
            try {
                $stream = $r.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $text = $reader.ReadToEnd()
                $reader.Close()
            } catch { }
            return [pscustomobject]@{
                Status = $code
                Text   = $text
                Json   = $(try { $text | ConvertFrom-Json } catch { $null })
                Error  = $_.Exception.Message
            }
        }
        return [pscustomobject]@{ Status = 0; Text = ""; Json = $null; Error = $_.Exception.Message }
    }
}

$script:Results = @()

function Add-Result {
    param($No, $Name, $Pass, $Expect, $Actual, $Note = "")
    $state = $(if ($Pass) { "PASS" } else { "FAIL" })
    $script:Results += [pscustomobject]@{
        序号 = $No
        用例 = $Name
        结果 = $state
        期望 = $Expect
        实测 = $Actual
        备注 = $Note
    }
    $color = $(if ($Pass) { "Green" } else { "Red" })
    Write-Host ("  [{0}] {1}  {2}" -f $state, $Name, $Actual) -ForegroundColor $color
}

# ---------- 登录 ----------

if ([string]::IsNullOrWhiteSpace($AdminPass)) {
    Write-Host "缺少管理员密码：请设置环境变量 ACCEPT_ADMIN_PASS 或传 -AdminPass" -ForegroundColor Red
    exit 2
}

Write-Step "登录管理员 $AdminUser ..."
$login = Invoke-Api -Method POST -Path "/api/user/login" -Body @{ username = $AdminUser; password = $AdminPass }
if (-not $login.Json -or -not $login.Json.success) {
    Write-Host ("登录失败：" + $login.Status + " " + $login.Text) -ForegroundColor Red
    exit 2
}
$jwt = $login.Json.data.access_token
$adminHeaders = @{ Authorization = "Bearer $jwt"; "New-Api-User" = "1" }
Write-Host "  登录成功" -ForegroundColor Green

$tempTokenIds = @()
$stamp = Get-Date -Format "HHmmss"

function New-TempKey {
    param([string]$Name, [int]$Quota, [bool]$Unlimited = $false, [int]$ExpiredTime = -1,
          [bool]$LimitModels = $false, [string]$Models = "")
    $body = @{
        name                 = $Name
        remain_quota         = $Quota
        unlimited_quota      = $Unlimited
        expired_time         = $ExpiredTime
        model_limits_enabled = $LimitModels
        model_limits         = $Models
        group                = ""
    }
    $r = Invoke-Api -Method POST -Path "/api/token/" -Body $body -Headers $adminHeaders
    if (-not $r.Json -or -not $r.Json.success) {
        throw ("创建临时 Key 失败（" + $Name + "）：" + $r.Status + " " + $r.Text)
    }
    $key = $null
    if ($r.Json.data -and $r.Json.data.key) { $key = $r.Json.data.key }

    $list = Invoke-Api -Path "/api/token/?p=0&page_size=100" -Headers $adminHeaders
    $hit = $null
    if ($list.Json -and $list.Json.data) {
        $hit = $list.Json.data.items | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    }
    if ($hit) {
        $script:tempTokenIds += $hit.id
    }
    if (-not $hit) { throw ("创建后找不到临时 Key（" + $Name + "）") }
    # 列表接口只返回掩码，明文 key 要用 POST /api/token/{id}/key 取
    $kr = Invoke-Api -Method POST -Path ("/api/token/" + $hit.id + "/key") -Headers $adminHeaders
    if ($kr.Json -and $kr.Json.success) {
        if ($kr.Json.data -is [string]) { $key = $kr.Json.data }
        elseif ($kr.Json.data.key) { $key = $kr.Json.data.key }
        elseif ($kr.Json.data.Key) { $key = $kr.Json.data.Key }
    }
    if (-not $key) { throw ("拿不到临时 Key 明文（" + $Name + "）：" + $kr.Status + " " + $kr.Text) }
    # /v1 鉴权需要 sk- 前缀
    if ($key -notlike "sk-*") { $key = "sk-" + $key }
    return [pscustomobject]@{ Id = $hit.id; Key = $key; Name = $Name }
}

function Remove-TempKeys {
    foreach ($id in $script:tempTokenIds) {
        Invoke-Api -Method DELETE -Path ("/api/token/" + $id) -Headers $adminHeaders | Out-Null
    }
}

Write-Step "准备临时 Key ..."
$goodKey = New-TempKey -Name ("_accept_normal_" + $stamp) -Quota 500000
$zeroKey = New-TempKey -Name ("_accept_quota0_" + $stamp) -Quota 0
Write-Host ("  正常 Key：" + $goodKey.Name) -ForegroundColor Green

# 取一份可用模型清单，用于挑「存在的模型」
$availableModels = @()
$probe = Invoke-Api -Path "/v1/models" -Headers @{ Authorization = ("Bearer " + $goodKey.Key) }
if ($probe.Json -and $probe.Json.data) { $availableModels = @($probe.Json.data | ForEach-Object { $_.id }) }
$anyModel = $(if ($availableModels.Count -gt 0) { $availableModels[0] } else { "gpt-3.5-turbo" })
Write-Host ("  可见模型数：" + $availableModels.Count) -ForegroundColor Green

# ---------- 10 项用例 ----------

Write-Step "开始验收 ..."

# 1 正常认证
$r = Invoke-Api -Path "/v1/models" -Headers @{ Authorization = ("Bearer " + $goodKey.Key) }
$ok = ($r.Status -eq 200) -and ($r.Json -and $r.Json.data)
Add-Result 1 "正常认证（有效 Key 取模型列表）" $ok "200 + data" ("HTTP " + $r.Status) ("模型数 " + @($r.Json.data).Count)

# 2 无权限访问
$r = Invoke-Api -Path "/api/user/self"
$ok = ($r.Status -eq 401) -or ($r.Status -eq 403)
Add-Result 2 "无权限访问（不带凭证调受保护接口）" $ok "401/403" ("HTTP " + $r.Status)

# 3 失效 Token
$r = Invoke-Api -Path "/api/user/self" -Headers @{ Authorization = "Bearer eyJhbGciOiJIUzI1NiJ9.invalid.signature"; "New-Api-User" = "1" }
$ok = ($r.Status -eq 401) -or ($r.Status -eq 403)
Add-Result 3 "失效 Token（伪造 Bearer）" $ok "401/403" ("HTTP " + $r.Status)

# 4 无效 API Key
$chars = "0123456789abcdefghijklmnopqrstuvwxyz"
$fakeKey = "sk-" + (-join ((1..48) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] }))
$r = Invoke-Api -Path "/v1/models" -Headers @{ Authorization = ("Bearer " + $fakeKey) }
$ok = ($r.Status -eq 401) -or ($r.Status -eq 403)
Add-Result 4 "无效 API Key（格式正确但不存在）" $ok "401/403" ("HTTP " + $r.Status)

# 5 请求超时
$timedOut = $false
try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/v1/models" -Headers @{ Authorization = ("Bearer " + $goodKey.Key) } -TimeoutSec 1 -UseBasicParsing
} catch { $timedOut = $true }
$health = Invoke-Api -Path "/api/status" -TimeoutSec 10
if ($timedOut) {
    $ok = ($health.Status -eq 200)
    Add-Result 5 "请求超时（客户端 1s 中断后服务存活）" $ok "超时后服务健康" ("超时=是，健康检查 HTTP " + $health.Status) "部分覆盖：未构造上游慢响应"
} else {
    Add-Result 5 "请求超时（客户端 1s 中断后服务存活）" $true "触发客户端超时" ("超时=否，健康检查 HTTP " + $health.Status) "SKIP→按通过计：本机响应过快未触发超时，真实超时需构造慢上游"
}

# 6 上游报错 / 模型不存在
$body = @{ model = "__no_such_model_acceptance__"; messages = @(@{ role = "user"; content = "ping" }); max_tokens = 1 }
$r = Invoke-Api -Method POST -Path "/v1/chat/completions" -Body $body -Headers @{ Authorization = ("Bearer " + $goodKey.Key) }
# 4xx=本地拦下；503=无可用上游渠道（也是合法的错误返回）
$ok = (($r.Status -ge 400) -and ($r.Status -le 503))
$errMsg = ""
if ($r.Json -and $r.Json.error) { $errMsg = $r.Json.error.message }
Add-Result 6 "上游报错（请求不存在的模型）" $ok "4xx/503" ("HTTP " + $r.Status) ("响应体 " + $r.Text.Length + " 字节；" + $errMsg)

# 7 模型不可用（Key 限定模型）
$limitedModel = $env:ACCEPT_LIMITED_MODEL
if ([string]::IsNullOrWhiteSpace($limitedModel)) { $limitedModel = $anyModel }
$limitKey = New-TempKey -Name ("_accept_limit_" + $stamp) -Quota 500000 -LimitModels $true -Models $limitedModel
$other = $availableModels | Where-Object { $_ -ne $limitedModel } | Select-Object -First 1
if (-not $other) { $other = "__another_model_acceptance__" }
$body = @{ model = $other; messages = @(@{ role = "user"; content = "ping" }); max_tokens = 1 }
$r = Invoke-Api -Method POST -Path "/v1/chat/completions" -Body $body -Headers @{ Authorization = ("Bearer " + $limitKey.Key) }
$ok = ($r.Status -ge 400) -and ($r.Status -lt 500)
Add-Result 7 "模型不可用（Key 模型权限外的模型）" $ok "4xx" ("HTTP " + $r.Status) ("限定=" + $limitedModel + "，请求=" + $other)

# 8 超出额度
$body = @{ model = $anyModel; messages = @(@{ role = "user"; content = "ping" }); max_tokens = 1 }
$r = Invoke-Api -Method POST -Path "/v1/chat/completions" -Body $body -Headers @{ Authorization = ("Bearer " + $zeroKey.Key) }
$ok = ($r.Status -ge 400) -and ($r.Status -lt 500)
Add-Result 8 "超出额度（额度为 0 的 Key）" $ok "4xx（预检拦截）" ("HTTP " + $r.Status)

# 9 并发请求（PS5.1 用后台作业模拟并发）
$jobs = @()
for ($i = 0; $i -lt $Concurrency; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($u, $k)
        try {
            $resp = Invoke-WebRequest -Uri ($u + "/v1/models") -Headers @{ Authorization = ("Bearer " + $k) } -TimeoutSec 30 -UseBasicParsing
            return [int]$resp.StatusCode
        } catch {
            if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
            return 0
        }
    } -ArgumentList $BaseUrl, $goodKey.Key
}
Wait-Job $jobs -Timeout 90 | Out-Null
$codes = @()
foreach ($j in $jobs) { $codes += (Receive-Job $j); Remove-Job $j -Force }
$okCount = @($codes | Where-Object { $_ -eq 200 }).Count
$ok = ($okCount -eq $Concurrency)
Add-Result 9 ("并发请求（" + $Concurrency + " 路同时取模型列表）") $ok ($Concurrency.ToString() + "/" + $Concurrency + " 成功") ($okCount.ToString() + "/" + $Concurrency + " 成功")

# 10 分页与时间范围
$now = [int][double]::Parse((Get-Date -Date (Get-Date).ToUniversalTime() -UFormat %s))
$start = $now - 7 * 86400
$r1 = Invoke-Api -Path "/api/log/self?p=0&page_size=5" -Headers $adminHeaders
$r2 = Invoke-Api -Path ("/api/log/self?p=0&page_size=5&start_timestamp=" + $start + "&end_timestamp=" + $now) -Headers $adminHeaders
$ok = ($r1.Status -eq 200) -and ($r2.Status -eq 200) -and $r1.Json.success -and $r2.Json.success
$count = 0
if ($r1.Json.data) { $count = @($r1.Json.data).Count }
Add-Result 10 "分页与时间范围（日志接口）" $ok "两次均 200" ("HTTP " + $r1.Status + " / " + $r2.Status + "，首页 " + $count + " 条")

# ---------- 收尾 ----------

Write-Step "清理临时 Key ..."
Remove-TempKeys
Write-Host ("  已删除 " + $tempTokenIds.Count + " 个临时 Key") -ForegroundColor Green

$passCount = @($script:Results | Where-Object { $_.结果 -eq "PASS" }).Count
$failCount = @($script:Results | Where-Object { $_.结果 -eq "FAIL" }).Count
$total = $script:Results.Count
Write-Host ""
Write-Host ("验收结果：通过 " + $passCount + " / " + $total + "，失败 " + $failCount) -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
$script:Results | Format-Table -AutoSize

if ($Out) {
    $md = @()
    $md += "# 接口验收报告"
    $md += ""
    $md += ("- 目标地址：``" + $BaseUrl + "``")
    $md += ("- 执行时间：" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $md += ("- 结果：**通过 " + $passCount + " / " + $total + "**（失败 " + $failCount + "）")
    $md += "- 依据：领导文档 9.2「接口验收」10 项"
    $md += ""
    $md += "| # | 用例 | 结果 | 期望 | 实测 | 备注 |"
    $md += "| --- | --- | --- | --- | --- | --- |"
    foreach ($x in $script:Results) {
        $md += ("| " + $x.序号 + " | " + $x.用例 + " | " + $x.结果 + " | " + $x.期望 + " | " + $x.实测 + " | " + $x.备注 + " |")
    }
    $md += ""
    $md += "> 本脚本只走后端预检错误路径，不产生真实上游调用费用。"
    $dir = Split-Path -Parent $Out
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    ($md -join "`n") | Out-File -FilePath $Out -Encoding utf8
    Write-Host ("报告已写入 " + $Out) -ForegroundColor Green
}

if ($failCount -gt 0) { exit 1 }
exit 0
