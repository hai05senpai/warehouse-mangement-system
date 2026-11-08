Write-Host "Bat dau gui 2 request hoan tat don hang so 21 DONG THOI..." -ForegroundColor Cyan

$job1 = Start-Job -ScriptBlock {
    Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders/21/complete" -Method Put
}

$job2 = Start-Job -ScriptBlock {
    Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders/21/complete" -Method Put
}

Wait-Job $job1, $job2

Write-Host "=== KET QUA REQUEST 1 ===" -ForegroundColor Green
Receive-Job $job1

Write-Host "=== KET QUA REQUEST 2 ===" -ForegroundColor Yellow
Receive-Job $job2