# tools/local-test-integration-assign-10-employees.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

# Pazartesi olmalı (canonical week plan)
$WeekStart = "2026-02-02"  # Monday

$EndpointDry  = "$BaseUrl/api/integration/v1/shift-assignments/upsert?dryRun=1"
$EndpointReal = "$BaseUrl/api/integration/v1/shift-assignments/upsert"

$BatchRef = "SA-10-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Sistemde olan template signature'ları
$Templates = @(
  "0900-1700",
  "0900-1800",
  "1100-2000",
  "2200-0600+1"
)

# 10 employeeCode (E001..E010)
$EmployeeCodes = 1..10 | ForEach-Object { "E{0:D3}" -f $_ }

function Build-Plans($employeeCodes, $weekStart, $templates) {
  $plans = @()
  $i = 0
  foreach ($code in $employeeCodes) {
    $tpl = $templates[$i % $templates.Length]

    # externalRef: idempotency anahtarı (employee+week bazında unique)
    $externalRef = "PLAN-$code-$weekStart"

    # Bu payload formatı: senin projedeki shift-assignments/upsert contract'ına uygun
    $plans += @{
      externalRef   = $externalRef
      employeeCode  = $code
      weekStartDate = $weekStart
      days = @{
        mon = @{ shiftTemplateSignature = $tpl }
        tue = @{ shiftTemplateSignature = $tpl }
        wed = @{ shiftTemplateSignature = $tpl }
        thu = @{ shiftTemplateSignature = $tpl }
        fri = @{ shiftTemplateSignature = $tpl }
        # İstersen hafta sonuna da koyabiliriz:
        # sat = @{ shiftTemplateSignature = $tpl }
        # sun = @{ shiftTemplateSignature = $tpl }
      }
    }

    $i++
  }
  return $plans
}

$plans = Build-Plans $EmployeeCodes $WeekStart $Templates

$BodyObj = @{
  sourceSystem = "SAP"
  batchRef = $BatchRef
  plans = $plans
}

$BodyJson = $BodyObj | ConvertTo-Json -Depth 30

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

Write-Host "== Integration Shift Assignments x10 (weekly plans) ==" -ForegroundColor Cyan
Write-Host "WeekStartDate: $WeekStart"
Write-Host "BatchRef: $BatchRef"
Write-Host ""

Write-Host "--- Example plan[0] ---" -ForegroundColor Yellow
($plans[0] | ConvertTo-Json -Depth 10)
Write-Host "----------------------"
Write-Host ""

Write-Host "== 1) DRY RUN ==" -ForegroundColor Cyan
$dry = Call-Api $EndpointDry
$dry | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "== 2) REAL ==" -ForegroundColor Cyan
$real = Call-Api $EndpointReal
$real | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "DONE. UI'de /shift-assignments (veya weekly plan ekranında) E001..E010 için $WeekStart haftasını kontrol et." -ForegroundColor Green
