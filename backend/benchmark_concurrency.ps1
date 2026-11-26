param(
    [int]$Concurrency = 20,
    [long]$ProductId = 27,   # AC-PANA-12000
    [long]$LocationId = 27   # C3-R03-S01
)

$baseUrl = "http://localhost:8080/api/issue-orders"

function Run-ApiConcurrencyBenchmark {
    param(
        [string]$Label,
        [int]$Threads
    )

    $orderCode = "PX-BENCH-$(Get-Date -Format 'HHmmss')-$(Get-Random -Minimum 100 -Maximum 999)"
    $payload = @{
        code       = $orderCode
        customerId = 1
        createdBy  = "benchmark"
        items      = @(
            @{
                productId  = $ProductId
                locationId = $LocationId
                quantity   = 1
            }
        )
    } | ConvertTo-Json -Depth 4

    $created = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $payload
    $orderId = $created.id

    $scriptBlock = {
        param($id)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $null = Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders/$id/complete" -Method Put
            $sw.Stop()
            return [PSCustomObject]@{ Status = 200; ElapsedMs = $sw.Elapsed.TotalMilliseconds; Message = "OK" }
        } catch {
            $sw.Stop()
            $code = 0
            $body = ""
            if ($_.Exception.Response) {
                $code = $_.Exception.Response.StatusCode.value__
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
            }
            return [PSCustomObject]@{ Status = $code; ElapsedMs = $sw.Elapsed.TotalMilliseconds; Message = $body }
        }
    }

    $totalSw = [System.Diagnostics.Stopwatch]::StartNew()
    $jobs = @()
    for ($i = 1; $i -le $Threads; $i++) {
        $jobs += Start-Job -ScriptBlock $scriptBlock -ArgumentList $orderId
    }
    Wait-Job $jobs | Out-Null
    $totalSw.Stop()

    $results = $jobs | Receive-Job
    $jobs | Remove-Job

    $okCount = ($results | Where-Object { $_.Status -eq 200 }).Count
    $conflictCount = ($results | Where-Object { $_.Status -eq 409 }).Count
    $otherCount = $Threads - $okCount - $conflictCount
    $avgMs = [Math]::Round(($results | Measure-Object -Property ElapsedMs -Average).Average, 2)
    $minMs = [Math]::Round(($results | Measure-Object -Property ElapsedMs -Minimum).Minimum, 2)
    $maxMs = [Math]::Round(($results | Measure-Object -Property ElapsedMs -Maximum).Maximum, 2)
    $totalMs = [Math]::Round($totalSw.Elapsed.TotalMilliseconds, 2)
    $throughput = [Math]::Round(($Threads / ($totalSw.Elapsed.TotalSeconds)), 2)

    return [PSCustomObject]@{
        CheDo             = $Label
        SoLuongDongThoi   = $Threads
        ThanhCong_200     = $okCount
        BiChan_409        = $conflictCount
        LoiKhac           = $otherCount
        MinLatency_ms     = $minMs
        AvgLatency_ms     = $avgMs
        MaxLatency_ms     = $maxMs
        TongThoiGian_ms   = $totalMs
        Throughput_req_s  = $throughput
    }
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " BENCHMARK DIEU KHIEN DONG THOI: POSTGRESQL 17 vs REDIS 7 ($Concurrency luong)" -ForegroundColor Cyan
Write-Host "========================================================================`n" -ForegroundColor Cyan

# 1. Benchmark che do 1: Redis Distributed Lock + PostgreSQL (Docker Redis DANG BAT)
Write-Host "[1/2] Dang bat Redis (logistic-redis) va chay $Concurrency luong dong thoi (Redis + PostgreSQL)..." -ForegroundColor Yellow
docker start logistic-redis | Out-Null
Start-Sleep -Seconds 2
$resRedisAndPg = Run-ApiConcurrencyBenchmark -Label "Redis 7 + PostgreSQL 17 (Fail-fast)" -Threads $Concurrency

# 2. Benchmark che do 2: Chi PostgreSQL Pessimistic Lock (Tam dung Docker Redis -> Fallback sang PG)
Write-Host "[2/2] Tam dung Redis de do rieng PostgreSQL 17 SELECT ... FOR UPDATE ($Concurrency luong)..." -ForegroundColor Yellow
docker stop logistic-redis | Out-Null
Start-Sleep -Seconds 1
$resPgOnly = Run-ApiConcurrencyBenchmark -Label "Chi PostgreSQL 17 (SELECT FOR UPDATE)" -Threads $Concurrency

# Bat lai Redis sau khi benchmark xong
Write-Host "`nDang khoi dong lai container logistic-redis..." -ForegroundColor Gray
docker start logistic-redis | Out-Null

# 3. Do toc do thuan cua Redis SET NX EX bang redis-benchmark (10,000 lenh)
Write-Host "`n=== SO LIEU TONG HOP BENCHMARK ($Concurrency REQUEST DONG THOI TREN CUNG 1 DON HANG) ===" -ForegroundColor Green
@($resPgOnly, $resRedisAndPg) | Format-Table -AutoSize

Write-Host "=== DO HIEU NANG THUAN TREN RAM CUA REDIS 7 (10,000 lenh SET) ===" -ForegroundColor Cyan
docker exec logistic-redis redis-benchmark -t set -n 10000 -c $Concurrency -q
