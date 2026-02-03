$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:3000"
$ApiKey  = "demo_integration_key_change_me"

$WeekStart = "2026-02-02"

$Headers = @{
  "x-integration-api-key" = $ApiKey
  "Content-Type" = "application/json"
}

function Post($bodyObj) {
  $json = $bodyObj | ConvertTo-Json -Depth 30
  try {
    Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/integration/v1/shift-assignments/upsert?dryRun=1" `
      -Headers $Headers `
      -Body $json
  } catch {
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $reader.ReadToEnd()
    } else {
      $_ | Out-String
    }
  }
}

Write-Host "== CONTRACT PROBE ==" -ForegroundColor Cyan

# 1) days format (bizim şu an kullandığımız)
$body1 = @{
  sourceSystem="SAP"
  batchRef="PROBE-1"
  plans=@(
    @{
      externalRef="PROBE-E002-$WeekStart"
      employeeCode="E002"
      weekStartDate=$WeekStart
      days=@{ mon=@{ shiftTemplateSignature="0900-1800" } }
    }
  )
}
Write-Host "`n-- PROBE-1 (days) --" -ForegroundColor Yellow
Post $body1 | ConvertTo-Json -Depth 30

# 2) week-level signature denemesi (bilinmiyor; hata mesajı bize doğru alanı söyler)
$body2 = @{
  sourceSystem="SAP"
  batchRef="PROBE-2"
  plans=@(
    @{
      externalRef="PROBE2-E002-$WeekStart"
      employeeCode="E002"
      weekStartDate=$WeekStart
      shiftTemplateSignature="0900-1800"
    }
  )
}
Write-Host "`n-- PROBE-2 (week-level candidate field) --" -ForegroundColor Yellow
Post $body2 | ConvertTo-Json -Depth 30
