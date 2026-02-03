# tools/local-test-integration-shift-templates-activate-and-create.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

$DryUrl  = "$BaseUrl/api/integration/v1/shift-templates/upsert?dryRun=1"
$RealUrl = "$BaseUrl/api/integration/v1/shift-templates/upsert"

$BatchRef = "SHIFT-TPL-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Hedef:
# - 09:00–17:00 (pasifse aktifleşsin)  => signature: 0900-1700
# - 09:00–18:00 (pasifse aktifleşsin)  => signature: 0900-1800
# - 11:00–20:00 (yoksa oluşturulsun)   => signature: 1100-2000
# - 22:00–06:00 (yoksa oluşturulsun)   => signature: 2200-0600+1

$BodyObj = @{
  sourceSystem = "SAP"
  batchRef = $BatchRef
  templates = @(
    @{ startTime = "09:00"; endTime = "17:00" }
    @{ startTime = "09:00"; endTime = "18:00" }
    @{ startTime = "11:00"; endTime = "20:00" }
    @{ startTime = "22:00"; endTime = "06:00" }
  )
}

$BodyJson = $BodyObj | ConvertTo-Json -Depth 20

$Headers = @{
  "x-integration-api-key" = $ApiKey
  "Content-Type" = "application/json"
}

function Call-Api($url) {
  try {
    $res = Invoke-RestMethod -Method Post -Uri $url -Headers $Headers -Body $BodyJson
    Write-Host "HTTP OK" -ForegroundColor Green
    return $res
  } catch {
    Write-Host "HTTP ERROR" -ForegroundColor Red
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      $reader.Close()
      Write-Host $text -ForegroundColor Red
    } else {
      Write-Host ($_ | Out-String) -ForegroundColor Red
    }
    throw
  }
}

Write-Host "== Integration Shift Templates Activate + Create ==" -ForegroundColor Cyan
Write-Host "BatchRef: $BatchRef"
Write-Host ""
Write-Host "--- Request JSON ---" -ForegroundColor Yellow
Write-Host $BodyJson
Write-Host "--------------------"
Write-Host ""

Write-Host "== 1) DRY RUN ==" -ForegroundColor Cyan
$dry = Call-Api $DryUrl
$dry | ConvertTo-Json -Depth 30
Write-Host ""

Write-Host "== 2) REAL ==" -ForegroundColor Cyan
$real = Call-Api $RealUrl
$real | ConvertTo-Json -Depth 30
Write-Host ""

Write-Host "DONE. UI'de /shift-templates sayfasinda 0900-1700, 0900-1800 aktif mi ve 1100-2000 + 2200-0600+1 geldi mi kontrol et." -ForegroundColor Green
