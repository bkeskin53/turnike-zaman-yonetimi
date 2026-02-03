# tools/local-test-integration.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"
$EmployeeCode = "E001"   # <-- UI'de var olan employeeCode ile değiştir
$WeekStart = "2026-02-02"

Write-Host "== Integration Shift Assignments DRY RUN test ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "EmployeeCode: $EmployeeCode"
Write-Host "WeekStartDate: $WeekStart"
Write-Host ""

$BodyObj = @{
  sourceSystem = "SAP"
  batchRef = "STEP3-DRYRUN-1"
  plans = @(
    @{
      externalRef = "PLAN-STEP3-1"
      employeeCode = $EmployeeCode
      weekStartDate = $WeekStart
      days = @{
        mon = @{ shiftTemplateSignature = "0900-1800" }
      }
    }
  )
}

$BodyJson = $BodyObj | ConvertTo-Json -Depth 10

Write-Host "--- Request JSON ---" -ForegroundColor Yellow
Write-Host $BodyJson
Write-Host "--------------------"
Write-Host ""

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
    # Response body'yi bas
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      $reader.Close()
      Write-Host $text -ForegroundColor Red
    } else {
      Write-Host $_ -ForegroundColor Red
    }
    throw
  }
}

# 1) DryRun
$dryUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert?dryRun=1"
Write-Host "== 1) DryRun POST $dryUrl ==" -ForegroundColor Cyan
$dry = Call-Api $dryUrl
$dry | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "DryRun status: $($dry.results[0].status)" -ForegroundColor Cyan
Write-Host "DryRun errors count: $(@($dry.errors).Count)" -ForegroundColor Cyan

# 2) Real
Write-Host ""
$realUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert"
Write-Host "== 2) Real POST $realUrl ==" -ForegroundColor Cyan
$real = Call-Api $realUrl
$real | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "Real status: $($real.results[0].status)" -ForegroundColor Cyan
Write-Host "Real errors count: $(@($real.errors).Count)" -ForegroundColor Cyan

Write-Host ""
Write-Host "DONE. Simdi UI'de /shift-templates sayfasinda 0900-1800 template aktif mi kontrol et." -ForegroundColor Green
