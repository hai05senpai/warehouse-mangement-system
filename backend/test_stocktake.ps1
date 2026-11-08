Write-Host "Bat dau duyet phieu kiem ke so 25..." -ForegroundColor Cyan

# Goi API /complete kem theo tham so approvedBy
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/stock-takes/25/complete?approvedBy=manager_hai" -Method Put

Write-Host "=== KET QUA REQUEST ===" -ForegroundColor Green
$response | ConvertTo-Json -Depth 3