# tools/local-test-shift-assignments-batch.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

# UI'de seçtiğin hafta (Pazartesi)
$WeekStart = "2026-02-02"

# UI'de dropdown'da gördüğün vardiya signature'ı:
# Örn: 0900-1700 veya 0900-1800
$ShiftSignature = "0900-1700"

# Entegrasyonla atamak istediğin employeeCode listesi
$EmployeeCodes = @("E002","E003","E004","E005","E006","E007","E008","E009","E010")

Write-Host "== Integration Batch WEEK_TEMPLATE apply ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "WeekStart: $WeekStart"
Write-Host "ShiftSignature: $ShiftSignature"
Write-Host "Employees: $($EmployeeCodes -join ', ')"
Write-Host ""

# Plans array üret
$Plans = @()
foreach ($code in $EmployeeCodes) {
  $Plans += @{
    externalRef = "PLAN-$WeekStart-$code"   # idempotent: tekrar yollarsan aynı externalRef ile update/unchanged olur
    employeeCode = $code
    weekStartDate = $WeekStart

    # Asıl kritik alan: WEEK_TEMPLATE bununla set edilir
    defaultShiftTemplateSignature = $ShiftSignature

    # İstersen days'i hiç göndermeyelim. Çünkü UI WEEK_TEMPLATE gösteriyor.
    # days = @{ mon = @{ shiftTemplateSignature = $ShiftSignature } }
  }
}

$BodyObj = @{
  sourceSystem = "SAP"
  batchRef = "BATCH-WEEK-$WeekStart"
  plans = $Plans
}

$BodyJson = $BodyObj | ConvertTo-Json -Depth 20

Write-Host "--- Request JSON (preview) ---" -ForegroundColor Yellow
Write-Host $BodyJson
Write-Host "------------------------------"
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
Write-Host "== 1) DryRun ==" -ForegroundColor Cyan
$dry = Call-Api $dryUrl
$dry | ConvertTo-Json -Depth 20

Write-Host ""
Write-Host "DryRun summary: willCreate=$($dry.dryRunSummary.willCreate) willUpdate=$($dry.dryRunSummary.willUpdate) willFailed=$($dry.dryRunSummary.willFailed)" -ForegroundColor Cyan

# 2) Real
$realUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert"
Write-Host ""
Write-Host "== 2) Real ==" -ForegroundColor Cyan
$real = Call-Api $realUrl
$real | ConvertTo-Json -Depth 20

# Mini özet
$created = ($real.results | Where-Object { $_.status -eq "CREATED" }).Count
$updated = ($real.results | Where-Object { $_.status -eq "UPDATED" }).Count
$unch    = ($real.results | Where-Object { $_.status -eq "UNCHANGED" }).Count
$failed  = ($real.results | Where-Object { $_.status -eq "FAILED" }).Count

Write-Host ""
Write-Host "RESULT: CREATED=$created UPDATED=$updated UNCHANGED=$unch FAILED=$failed" -ForegroundColor Green
Write-Host "DONE. Simdi UI'de /shift-assignments ekraninda bu hafta icin E002..E010 'Mevcut Week' dolu mu kontrol et." -ForegroundColor Green
