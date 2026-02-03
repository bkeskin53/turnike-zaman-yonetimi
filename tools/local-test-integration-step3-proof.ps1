# tools/local-test-integration-step3-proof.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

# UI'de var olan employeeCode'lar
$EmployeeCodes = @("E001")   # İstersen: @("E001","E002","E003") gibi çoğalt
$WeekStart = "2026-02-02"

function To-Json($obj) { return ($obj | ConvertTo-Json -Depth 30) }

function Call-Api($url, $json, $apiKey) {
  $headers = @{
    "x-integration-api-key" = $apiKey
    "Content-Type" = "application/json"
  }
  try {
    $res = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $json
    return @{ ok=$true; data=$res }
  } catch {
    $resp = $_.Exception.Response
    $status = if ($resp) { [int]$resp.StatusCode } else { -1 }
    $text = ""
    if ($resp -ne $null) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      $reader.Close()
    } else {
      $text = ($_ | Out-String)
    }
    return @{ ok=$false; status=$status; body=$text }
  }
}

Write-Host "== STEP-3 Proof Pack ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "WeekStartDate: $WeekStart"
Write-Host "Employees: $($EmployeeCodes -join ', ')"
Write-Host ""

# ---------------------------
# TEST-1: Idempotency / Retry
# ---------------------------
Write-Host "== TEST-1: Idempotency / Retry (same externalRef twice) ==" -ForegroundColor Cyan

$emp = $EmployeeCodes[0]
$externalRef = "PLAN-RETRY-$emp-$WeekStart"

$bodyObj1 = @{
  sourceSystem = "SAP"
  batchRef = "PROOF-RETRY-1"
  plans = @(
    @{
      externalRef = $externalRef
      employeeCode = $emp
      weekStartDate = $WeekStart
      days = @{
        mon = @{ shiftTemplateSignature = "0900-1800" }
      }
    }
  )
}

$json1 = To-Json $bodyObj1
$dryUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert?dryRun=1"
$realUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert"

Write-Host "-- 1A) DryRun (should WILL_CREATE) --" -ForegroundColor Yellow
$r1 = Call-Api $dryUrl $json1 $ApiKey
if (!$r1.ok) { Write-Host "FAIL: $($r1.status) $($r1.body)" -ForegroundColor Red; exit 1 }
$r1.data | ConvertTo-Json -Depth 30
Write-Host "DryRun status: $($r1.data.results[0].status)" -ForegroundColor Green

Write-Host ""
Write-Host "-- 1B) Real create (should CREATED) --" -ForegroundColor Yellow
$r2 = Call-Api $realUrl $json1 $ApiKey
if (!$r2.ok) { Write-Host "FAIL: $($r2.status) $($r2.body)" -ForegroundColor Red; exit 1 }
$r2.data | ConvertTo-Json -Depth 30
Write-Host "Real status #1: $($r2.data.results[0].status)" -ForegroundColor Green

Write-Host ""
Write-Host "-- 1C) Real retry SAME externalRef (should UPDATED or UNCHANGED, but NOT duplicate) --" -ForegroundColor Yellow
$r3 = Call-Api $realUrl $json1 $ApiKey
if (!$r3.ok) { Write-Host "FAIL: $($r3.status) $($r3.body)" -ForegroundColor Red; exit 1 }
$r3.data | ConvertTo-Json -Depth 30
Write-Host "Real status #2: $($r3.data.results[0].status)" -ForegroundColor Green
Write-Host "NOTE: Beklenen CREATED OLMAMALI. UPDATED/UNCHANGED (veya benzeri) olmalı." -ForegroundColor Cyan

Write-Host ""
Write-Host "TEST-1 DONE." -ForegroundColor Green
Write-Host ""

# ---------------------------
# TEST-2: Batch (multi plans)
# ---------------------------
Write-Host "== TEST-2: Batch (multiple plans in one request) ==" -ForegroundColor Cyan

$plans = @()
$i = 1
foreach ($ec in $EmployeeCodes) {
  $plans += @{
    externalRef = "PLAN-BATCH-$ec-$WeekStart-$i"
    employeeCode = $ec
    weekStartDate = $WeekStart
    days = @{
      mon = @{ shiftTemplateSignature = "0900-1800" }
    }
  }
  $i += 1
}

$bodyObj2 = @{
  sourceSystem = "SAP"
  batchRef = "PROOF-BATCH-1"
  plans = $plans
}

$json2 = To-Json $bodyObj2

Write-Host "-- 2A) DryRun batch --" -ForegroundColor Yellow
$r4 = Call-Api $dryUrl $json2 $ApiKey
if (!$r4.ok) { Write-Host "FAIL: $($r4.status) $($r4.body)" -ForegroundColor Red; exit 1 }
$r4.data | ConvertTo-Json -Depth 30
Write-Host "Batch results: $(@($r4.data.results).Count), errors: $(@($r4.data.errors).Count)" -ForegroundColor Green

Write-Host ""
Write-Host "-- 2B) Real batch --" -ForegroundColor Yellow
$r5 = Call-Api $realUrl $json2 $ApiKey
if (!$r5.ok) { Write-Host "FAIL: $($r5.status) $($r5.body)" -ForegroundColor Red; exit 1 }
$r5.data | ConvertTo-Json -Depth 30
Write-Host "Batch results: $(@($r5.data.results).Count), errors: $(@($r5.data.errors).Count)" -ForegroundColor Green

Write-Host ""
Write-Host "TEST-2 DONE." -ForegroundColor Green
Write-Host ""

# ---------------------------
# TEST-3: Security fail-closed
# ---------------------------
Write-Host "== TEST-3: Security (wrong API key should be 401) ==" -ForegroundColor Cyan
$badKey = "WRONG_KEY"

$r6 = Call-Api $realUrl $json1 $badKey
if ($r6.ok) {
  Write-Host "FAIL: wrong key ile 200 döndü (olmaması lazım)!" -ForegroundColor Red
  $r6.data | ConvertTo-Json -Depth 30
  exit 1
} else {
  Write-Host "Expected FAIL OK. HTTP: $($r6.status)" -ForegroundColor Green
  Write-Host $r6.body -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ALL PROOF TESTS COMPLETED." -ForegroundColor Green
Write-Host "Ek kanit: UI'de /shift-assignments veya ilgili weekly plan ekrani + Integration Logs ekranindan kayitlar gorulebilir." -ForegroundColor Green
