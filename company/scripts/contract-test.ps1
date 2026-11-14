# 接口契约测试（领导文档第六章第 7 条「对官方接口进行契约测试」）
#
# 契约 = 前端 api-client / 控制台依赖的「字段名 + 类型 + 层级」。官方升级后若这些变了，
# 页面会静默白屏，本脚本把它们变成会失败的断言。
#
# 用法：
#   $env:ACCEPT_ADMIN_PASS = "管理员密码"
#   powershell -NoProfile -ExecutionPolicy Bypass -File company\scripts\contract-test.ps1
#   可选：-BaseUrl http://127.0.0.1:3000  -Out company/docs/CONTRACT-REPORT.md
#
# 兼容 Windows PowerShell 5.1。

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [string]$AdminUser = "cdadmin",
    [string]$AdminPass = $env:ACCEPT_ADMIN_PASS,
    [string]$Out = ""
)

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-Api {
    param([string]$Method = "GET", [string]$Path, $Body = $null, [hashtable]$Headers = @{}, [int]$TimeoutSec = 20)
    $uri = "$BaseUrl$Path"
    $params = @{ Uri = $uri; Method = $Method; Headers = $Headers; TimeoutSec = $TimeoutSec; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
        $params.ContentType = "application/json; charset=utf-8"
    }
    try {
        $resp = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Text = [string]$resp.Content; Json = $(try { $resp.Content | ConvertFrom-Json } catch { $null }) }
    } catch {
        $r = $_.Exception.Response
        $code = 0; $text = ""
        if ($r) {
            try { $code = [int]$r.StatusCode } catch { $code = 0 }
            try { $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); $text = $sr.ReadToEnd(); $sr.Close() } catch { }
        }
        return [pscustomobject]@{ Status = $code; Text = $text; Json = $(try { $text | ConvertFrom-Json } catch { $null }) }
    }
}

# 按 "a.b[0].c" 取值；不存在返回 $null 并置 $script:missing
function Get-Path {
    param($Obj, [string]$Path)
    $cur = $Obj
    foreach ($seg in $Path.Split(".")) {
        if ($null -eq $cur) { return $null }
        if ($seg -match '^(.+)\[(\d+)\]$') {
            $name = $matches[1]; $idx = [int]$matches[2]
            $cur = $cur.$name
            if ($null -eq $cur) { return $null }
            if ($cur.Count -le $idx) { return $null }
            $cur = $cur[$idx]
        } else {
            if ($cur.PSObject.Properties.Name -notcontains $seg) { return $null }
            $cur = $cur.$seg
        }
    }
    return $cur
}

function Test-Type {
    param($Value, [string]$Type)
    if ($null -eq $Value) { return $false }
    switch ($Type) {
        "string" { return ($Value -is [string]) }
        "int"    { return (($Value -is [int]) -or ($Value -is [long]) -or ($Value -is [double]) -or ($Value -is [decimal])) }
        "num"    { return (($Value -is [int]) -or ($Value -is [long]) -or ($Value -is [double]) -or ($Value -is [decimal])) }
        "bool"   { return ($Value -is [bool]) }
        "array"  { return ($Value -is [array]) }
        # PS 5.1 的 ConvertFrom-Json 会把单元素数组拆成标量，这类字段用 list 判定
        "list"   { return (($Value -is [array]) -or ($Value -is [string])) }
        "object" { return ($Value -is [pscustomobject]) }
        default  { return $true }
    }
}

$script:Results = @()

function Add-Case {
    param([string]$Name, [string]$Method, [string]$Path, $Rules, [int]$ExpectStatus = 200)
    $r = Invoke-Api -Method $Method -Path $Path -Headers $script:headers
    $problems = @()

    if ($r.Status -ne $ExpectStatus) { $problems += ("HTTP " + $r.Status + "（期望 " + $ExpectStatus + "）") }
    if ($null -eq $r.Json) { $problems += "响应不是合法 JSON" }
    elseif ($r.Json.PSObject.Properties.Name -contains "success" -and $r.Json.success -ne $true) {
        $problems += ("success=false：" + $r.Json.message)
    }

    if ($Rules -and $r.Json) {
        foreach ($rule in $Rules) {
            $parts = $rule.Split("|")
            $rulePath = $parts[0]
            $type = $(if ($parts.Count -gt 1) { $parts[1] } else { "" })
            $v = Get-Path -Obj $r.Json -Path $rulePath
            if ($null -eq $v) { $problems += ("缺字段 " + $rulePath); continue }
            if ($type -and -not (Test-Type -Value $v -Type $type)) {
                $problems += ("字段 " + $rulePath + " 类型应为 " + $type + "，实际 " + $v.GetType().Name)
            }
        }
    }

    $ok = ($problems.Count -eq 0)
    $script:Results += [pscustomobject]@{
        用例   = $Name
        接口   = ($Method + " " + ($Path -replace '\?.*$', ''))
        结果   = $(if ($ok) { "PASS" } else { "FAIL" })
        问题   = ($problems -join "；")
    }
    $color = $(if ($ok) { "Green" } else { "Red" })
    Write-Host ("  [{0}] {1}" -f $(if ($ok) { "PASS" } else { "FAIL" }), $Name) -ForegroundColor $color
    if (-not $ok) { Write-Host ("         " + ($problems -join "；")) -ForegroundColor DarkYellow }
}

# ---------- 登录 ----------

if ([string]::IsNullOrWhiteSpace($AdminPass)) {
    Write-Host "缺少管理员密码：设置 ACCEPT_ADMIN_PASS 或传 -AdminPass" -ForegroundColor Red
    exit 2
}
Write-Host "登录并建立会话 ..." -ForegroundColor Cyan
$login = Invoke-Api -Method POST -Path "/api/user/login" -Body @{ username = $AdminUser; password = $AdminPass }
if (-not $login.Json -or -not $login.Json.success) { Write-Host ("登录失败：" + $login.Text) -ForegroundColor Red; exit 2 }
$jwt = $login.Json.data.access_token
$script:headers = @{ Authorization = ("Bearer " + $jwt); "New-Api-User" = "1" }
Write-Host "开始校验契约 ..." -ForegroundColor Cyan

$now = [int][double]::Parse((Get-Date -Date (Get-Date).ToUniversalTime() -UFormat %s))
$weekAgo = $now - 7 * 86400

# ---------- 契约清单 ----------

Add-Case -Name "系统状态：版本与品牌字段" -Method GET -Path "/api/status" -Rules @(
    "data.version|string", "data.system_name|string"
)

Add-Case -Name "当前用户：身份与额度字段" -Method GET -Path "/api/user/self" -Rules @(
    "data.id|int", "data.username|string", "data.quota|int", "data.used_quota|int", "data.request_count|int"
)

Add-Case -Name "令牌列表：分页外壳与条目字段" -Method GET -Path "/api/token/?p=0&page_size=10" -Rules @(
    "data.items|array", "data.total|int",
    "data.items[0].id|int", "data.items[0].name|string", "data.items[0].remain_quota|int",
    "data.items[0].unlimited_quota|bool", "data.items[0].expired_time|int"
)

Add-Case -Name "消费日志：分页外壳与条目字段" -Method GET -Path "/api/log/self?p=0&page_size=10" -Rules @(
    "data|object", "data.page|int", "data.total|int", "data.items|array",
    "data.items[0].id|int", "data.items[0].type|int", "data.items[0].model_name|string",
    "data.items[0].quota|int", "data.items[0].created_at|int"
)

Add-Case -Name "消费统计：按时间范围" -Method GET -Path ("/api/log/self/stat?type=0&start_timestamp=" + $weekAgo + "&end_timestamp=" + $now) -Rules @(
    "data|object", "data.quota|int", "data.rpm|int", "data.tpm|int"
)

Add-Case -Name "用量曲线：按日期聚合" -Method GET -Path ("/api/data/self?start_timestamp=" + $weekAgo + "&end_timestamp=" + $now) -Rules @(
    "data|array"
)

Add-Case -Name "模型定价：价格字段" -Method GET -Path "/api/pricing" -Rules @(
    "data|array",
    "data[0].model_name|string", "data[0].quota_type|int",
    "data[0].model_ratio|num", "data[0].model_price|num", "data[0].completion_ratio|num",
    "data[0].enable_groups|list", "data[0].supported_endpoint_types|list"
)

Add-Case -Name "系统设置：键值对数组" -Method GET -Path "/api/option/" -Rules @(
    "data|array", "data[0].key|string"
)

# ---------- 模型列表（v1）：需要真实 API Key ----------

$tmpTokenId = $null
$v1Ok = $false
$v1Problems = @()
try {
    $stamp = Get-Date -Format "HHmmss"
    $name = "_contract_" + $stamp
    $create = Invoke-Api -Method POST -Path "/api/token/" -Headers $script:headers -Body @{
        name = $name; remain_quota = 100000; unlimited_quota = $false;
        expired_time = -1; model_limits_enabled = $false; model_limits = ""; group = ""
    }
    $list = Invoke-Api -Path "/api/token/?p=0&page_size=100" -Headers $script:headers
    $hit = $list.Json.data.items | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $hit) { throw "临时 Key 创建后找不到" }
    $tmpTokenId = $hit.id
    $keyRes = Invoke-Api -Method POST -Path ("/api/token/" + $hit.id + "/key") -Headers $script:headers
    $plain = $null
    if ($keyRes.Json.data -is [string]) { $plain = $keyRes.Json.data } elseif ($keyRes.Json.data.key) { $plain = $keyRes.Json.data.key }
    if (-not $plain) { throw "拿不到明文 Key" }
    if ($plain -notlike "sk-*") { $plain = "sk-" + $plain }

    $r = Invoke-Api -Path "/v1/models" -Headers @{ Authorization = ("Bearer " + $plain) }
    if ($r.Status -ne 200) { $v1Problems += ("HTTP " + $r.Status) }
    if ($null -eq $r.Json) { $v1Problems += "响应不是合法 JSON" }
    else {
        if ($null -eq (Get-Path -Obj $r.Json -Path "data")) { $v1Problems += "缺字段 data" }
        if ($null -eq (Get-Path -Obj $r.Json -Path "data[0].id")) { $v1Problems += "缺字段 data[0].id" }
        if ($null -eq (Get-Path -Obj $r.Json -Path "data[0].object")) { $v1Problems += "缺字段 data[0].object" }
    }
} catch {
    $v1Problems += ("准备临时 Key 失败：" + $_.Exception.Message)
} finally {
    if ($tmpTokenId) { Invoke-Api -Method DELETE -Path ("/api/token/" + $tmpTokenId) -Headers $script:headers | Out-Null }
}
$v1Ok = ($v1Problems.Count -eq 0)
$script:Results += [pscustomobject]@{
    用例 = "模型列表（v1）：OpenAI 兼容外壳"
    接口 = "GET /v1/models"
    结果 = $(if ($v1Ok) { "PASS" } else { "FAIL" })
    问题 = ($v1Problems -join "；")
}
Write-Host ("  [{0}] 模型列表（v1）：OpenAI 兼容外壳" -f $(if ($v1Ok) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($v1Ok) { "Green" } else { "Red" })
if (-not $v1Ok) { Write-Host ("         " + ($v1Problems -join "；")) -ForegroundColor DarkYellow }

# ---------- 错误契约：未授权 ----------
# 注意：官方对未认证请求返回 401 且正文为空，这是既定行为，契约只锁状态码。

$r = Invoke-Api -Path "/api/user/self"
$errOk = ($r.Status -eq 401)
$script:Results += [pscustomobject]@{
    用例 = "错误契约：未认证访问返回 401"
    接口 = "GET /api/user/self"
    结果 = $(if ($errOk) { "PASS" } else { "FAIL" })
    问题 = $(if ($errOk) { "" } else { "HTTP " + $r.Status + "（期望 401）" })
}
Write-Host ("  [{0}] 错误契约：未认证访问返回 401" -f $(if ($errOk) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($errOk) { "Green" } else { "Red" })

# ---------- 汇总 ----------

$passCount = @($script:Results | Where-Object { $_.结果 -eq "PASS" }).Count
$failCount = @($script:Results | Where-Object { $_.结果 -eq "FAIL" }).Count
$total = $script:Results.Count
Write-Host ""
Write-Host ("契约测试：通过 " + $passCount + " / " + $total + "，失败 " + $failCount) -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
$script:Results | Format-Table -AutoSize

if ($Out) {
    $md = @()
    $md += "# 接口契约测试报告"
    $md += ""
    $md += ("- 目标地址：``" + $BaseUrl + "``")
    $md += ("- 执行时间：" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $md += ("- 结果：**通过 " + $passCount + " / " + $total + "**（失败 " + $failCount + "）")
    $md += "- 依据：领导文档第六章第 7 条「对官方接口进行契约测试」"
    $md += ""
    $md += "| 用例 | 接口 | 结果 | 问题 |"
    $md += "| --- | --- | --- | --- |"
    foreach ($x in $script:Results) {
        $md += ("| " + $x.用例 + " | ``" + $x.接口 + "`` | " + $x.结果 + " | " + $x.问题 + " |")
    }
    $md += ""
    $md += "> 契约指字段名、类型与层级；官方升级后若结构变化，这里会红，避免页面静默白屏。"
    $dir = Split-Path -Parent $Out
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    ($md -join "`n") | Out-File -FilePath $Out -Encoding utf8
    Write-Host ("报告已写入 " + $Out) -ForegroundColor Green
}

if ($failCount -gt 0) { exit 1 }
exit 0


