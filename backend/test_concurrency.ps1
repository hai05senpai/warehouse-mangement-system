param(
    [string]$OrderIdOrCode = "25"
)

# Neu nguoi dung truyen ma code (VD: ORD-ISS-025), tu dong tim ID so tuong ung
$targetId = $OrderIdOrCode
if ($OrderIdOrCode -notmatch '^\d+$') {
    $orders = Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders" -Method Get
    $found = $orders | Where-Object { $_.code -eq $OrderIdOrCode } | Select-Object -First 1
    if ($null -eq $found) {
        Write-Host "Khong tim thay don hang co ma: $OrderIdOrCode" -ForegroundColor Red
        exit 1
    }
    $targetId = $found.id
}

Write-Host "Bat dau gui 2 request hoan tat don hang ID=$targetId ($OrderIdOrCode) DONG THOI..." -ForegroundColor Cyan

$scriptBlock = {
    param($id)
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/issue-orders/$id/complete" -Method Put
        return [PSCustomObject]@{
            KetQua  = "THANH CONG (HTTP 200)"
            MaPhieu = $res.code
            TrangThai = $res.status
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        return [PSCustomObject]@{
            KetQua  = "BI CHAN BOI KHOA DONG (HTTP $statusCode)"
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
