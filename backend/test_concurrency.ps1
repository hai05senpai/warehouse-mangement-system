param(
    [string]$OrderIdOrCode = "PX-RACE-01",
    [long]$ProductId = 27,   # AC-PANA-12000
    [long]$LocationId = 27,  # C3-R03-S01
    [int]$Quantity = 2
)

$baseUrl = "http://localhost:8080/api/issue-orders"
$targetId = $null
$displayCode = $OrderIdOrCode

if ($OrderIdOrCode -match '^\d+$') {
    $targetId = [long]$OrderIdOrCode
} else {
    $orders = Invoke-RestMethod -Uri $baseUrl -Method Get
    $found = $orders | Where-Object { $_.code -eq $OrderIdOrCode } | Select-Object -First 1

    if ($null -eq $found) {
        Write-Host "Chua co don '$OrderIdOrCode' trong DB -> Tu dong tao don PENDING (AC-PANA-12000 @ C3-R03-S01, SL=$Quantity)..." -ForegroundColor Magenta
        $payload = @{
            code       = $OrderIdOrCode
            customerId = 1
            createdBy  = "demo_concurrency"
            items      = @(
                @{
                    productId  = $ProductId
                    locationId = $LocationId
                    quantity   = $Quantity
                }
            )
        } | ConvertTo-Json -Depth 4
        $created = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $payload
        $targetId = $created.id
        $displayCode = $created.code
        Write-Host "Da tao thanh cong don $displayCode (ID=$targetId, Status=$($created.status)).`n" -ForegroundColor Green
    } elseif ($found.status -ne "PENDING") {
        $autoCode = "$OrderIdOrCode-$(Get-Date -Format 'HHmmss')"
        Write-Host "Don '$OrderIdOrCode' da o trang thai $($found.status) -> Tu dong tao don moi '$autoCode' de test..." -ForegroundColor Magenta
        $payload = @{
            code       = $autoCode
            customerId = 1
            createdBy  = "demo_concurrency"
            items      = @(
                @{
                    productId  = $ProductId
                    locationId = $LocationId
                    quantity   = $Quantity
                }
            )
        } | ConvertTo-Json -Depth 4
        $created = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $payload
        $targetId = $created.id
        $displayCode = $created.code
        Write-Host "Da tao thanh cong don $displayCode (ID=$targetId, Status=$($created.status)).`n" -ForegroundColor Green
    } else {
        $targetId = $found.id
        $displayCode = $found.code
    }
}

Write-Host "Bat dau gui 2 request hoan tat don hang ID=$targetId ($displayCode) DONG THOI..." -ForegroundColor Cyan

$scriptBlock = {
    param($id)
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders/$id/complete" -Method Put
        return [PSCustomObject]@{
            KetQua    = "THANH CONG (HTTP 200)"
            MaPhieu   = $res.code
            TrangThai = $res.status
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        return [PSCustomObject]@{
            KetQua  = "BI CHAN BOI KHOA DONG / REDIS LOCK (HTTP $statusCode)"
            ChiTiet = $body
        }
    }
}

$job1 = Start-Job -ScriptBlock $scriptBlock -ArgumentList $targetId
$job2 = Start-Job -ScriptBlock $scriptBlock -ArgumentList $targetId

Wait-Job $job1, $job2 | Out-Null

Write-Host "`n=== KET QUA REQUEST 1 ===" -ForegroundColor Green
Receive-Job $job1 | Format-List

Write-Host "=== KET QUA REQUEST 2 ===" -ForegroundColor Yellow
Receive-Job $job2 | Format-List

Remove-Job $job1, $job2
