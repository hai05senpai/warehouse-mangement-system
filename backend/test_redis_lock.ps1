$lockKey = "lock:inventory:27:27" # AC-PANA-12000 @ C3-R03-S01
$stockTakeCode = "KK-REDIS-$(Get-Date -Format 'HHmmss')"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " DEMO GIA LAP XUNG DOT KHOA REDIS (REDIS DISTRIBUTED LOCK - TASK 5)" -ForegroundColor Cyan
Write-Host "=================================================================`n" -ForegroundColor Cyan

Write-Host "[Buoc 1] Khoa key '$lockKey' (AC-PANA-12000 @ C3-R03-S01) tren Redis trong 20 giay..." -ForegroundColor Yellow
$setResult = docker exec logistic-redis redis-cli SET $lockKey "demo-lock-from-cli" NX EX 20
Write-Host "-> Ket qua Redis SET NX EX: $setResult`n" -ForegroundColor Green

$payload = @{
    code      = $stockTakeCode
    createdBy = "demo_redis_lock"
    items     = @(
        @{ productId = 27; locationId = 27; actualQty = 35 }, # AC-PANA-12000 @ C3-R03-S01
        @{ productId = 19; locationId = 19; actualQty = 45 }  # CAM-CANON-R6 @ B2-R03-S03
    )
} | ConvertTo-Json -Depth 4

Write-Host "[Buoc 2] Gui API tao phieu kiem ke '$stockTakeCode' (AC-PANA-12000 + CAM-CANON-R6) KHI KHOA DANG TON TAI..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/stock-takes" -Method Post -ContentType "application/json" -Body $payload
    $sw.Stop()
    Write-Host "-> Khong bi chan (Kiem tra lai container Redis dang chay chua!): $($res.code)" -ForegroundColor Red
} catch {
    $sw.Stop()
    $statusCode = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    Write-Host "-> BI CHAN NGAY LAP TUC (Fail-fast trong $($sw.ElapsedMilliseconds) ms) - HTTP $statusCode" -ForegroundColor Red
    Write-Host "-> Phan hoi tu Server: $body`n" -ForegroundColor Yellow
}

Write-Host "[Buoc 3] Giai phong khoa '$lockKey' tren Redis..." -ForegroundColor Yellow
$delResult = docker exec logistic-redis redis-cli DEL $lockKey
Write-Host "-> Ket qua Redis DEL: $delResult (Da mo khoa)`n" -ForegroundColor Green

Write-Host "[Buoc 4] Gui lai API tao phieu kiem ke '$stockTakeCode' SAU KHI DA MO KHOA..." -ForegroundColor Yellow
$resAfter = Invoke-RestMethod -Uri "http://localhost:8080/api/stock-takes" -Method Post -ContentType "application/json" -Body $payload
Write-Host "-> THANH CONG (HTTP 200)!" -ForegroundColor Green
[PSCustomObject]@{
    ID        = $resAfter.id
    MaPhieu   = $resAfter.code
    TrangThai = $resAfter.status
    NguoiTao  = $resAfter.createdBy
} | Format-List
