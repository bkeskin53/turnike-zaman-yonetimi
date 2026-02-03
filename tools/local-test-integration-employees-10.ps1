# tools/local-test-integration-employees-10.ps1
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

# Kaç test personel?
$Count = 10

# Kod prefix (E001..E010)
$Prefix = "E"

$BatchRef = "EMP-10-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$EndpointDry = "$BaseUrl/api/integration/v1/employees/upsert?dryRun=1"
$EndpointReal = "$BaseUrl/api/integration/v1/employees/upsert"

function New-TestEmployees($count, $prefix) {
  $list = @()
  for ($i=1; $i -le $count; $i++) {
    $n = $i.ToString("000")
    $code = "$prefix$n"

    # NOTE: Alanlar integrationEmployees.service.ts'e göre değişebilir.
    # Ama route kesin olarak "employees" array bekliyor.
    # En güvenlisi: employeeCode + externalRef + firstName + lastName (+ isActive) ile başlamak.
    $list += @{
      externalRef  = "TEST-EMP-$code"
      employeeCode = $code
      firstName    = "Test"
      lastName     = "User$n"
      email        = "test.$code@local"
      isActive     = $true
    }
  }
  return $list
}

$employees = New-TestEmployees $Count $Prefix

$bodyObj = @{
  sourceSystem = "LOCAL_TEST"
  batchRef = $BatchRef
  employees = $employees
}

$bodyJson = $bodyObj | ConvertTo-Json -Depth 30

$headers = @{
  "x-integration-api-key" = $ApiKey
  "Content-Type" = "application/json"
}

function Call-Api($url) {
  try {
    $res = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $bodyJson
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

Write-Host "== Integration Employees x$Count test ==" -ForegroundColor Cyan
Write-Host "BatchRef: $BatchRef"
Write-Host "Dry:  $EndpointDry"
Write-Host "Real: $EndpointReal"
Write-Host ""

Write-Host "--- Example employee[0] ---" -ForegroundColor Yellow
($employees[0] | ConvertTo-Json -Depth 10)
Write-Host "--------------------------"
Write-Host ""

# 1) DryRun
Write-Host "== 1) DRY RUN ==" -ForegroundColor Cyan
$dry = Call-Api $EndpointDry
$dry | ConvertTo-Json -Depth 30
Write-Host ""

# 2) Real
Write-Host "== 2) REAL ==" -ForegroundColor Cyan
$real = Call-Api $EndpointReal
$real | ConvertTo-Json -Depth 30
Write-Host ""

# 3) Retry aynı batchRef+externalRef set ile tekrar gönder (idempotency)
Write-Host "== 3) REAL RETRY (same externalRefs) ==" -ForegroundColor Cyan
$retry = Call-Api $EndpointReal
$retry | ConvertTo-Json -Depth 30
Write-Host ""

Write-Host "DONE. UI'de /employees sayfasinda E001..E010 gorunuyor mu kontrol et." -ForegroundColor Green
