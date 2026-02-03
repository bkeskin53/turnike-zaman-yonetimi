# tools/integration-suite/62-callback-failed-on-success.ps1
# Amaç: ON_SUCCESS modunda FAILED olunca webhook atılmamalı.

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [string]$CallbackUrl = "http://localhost:8088/callback",
  [string]$CallbackSecret = "demo_webhook_secret_change_me",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 1
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Callback Test: ON_SUCCESS + FAILED should NOT webhook"
Write-Host "Receiver should NOT log a webhook for this request." -ForegroundColor Yellow
Write-Host "CallbackUrl: $CallbackUrl" -ForegroundColor Cyan

$batchRef = "CB-FAIL-ONSUCCESS-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# KASITLI HATA:
# 18:00 -> 03:00 overnight olduğundan derived signature = 1800-0300+1
# Biz yanlış signature gönderiyoruz => SIGNATURE_MISMATCH => FAILED
$templates = @(
  @{
    signature  = "1800-0300"   # <-- yanlış (kasıtlı)
    startTime  = "18:00"
    endTime    = "03:00"
  }
)

$body = @{
  sourceSystem = $SourceSystem
  batchRef     = $batchRef
  templates    = $templates
  callback     = @{
    url    = $CallbackUrl
    secret = $CallbackSecret
    mode   = "ON_SUCCESS"
  }
}

$res = Invoke-IntegrationPost "/api/integration/v1/shift-templates/upsert" $body
Write-Host (To-PrettyJson $res 60) -ForegroundColor Gray

Write-Host ""
Write-Host "Expected: API response has FAILED item(s)." -ForegroundColor Yellow
Write-Host "Expected: Receiver SHOULD NOT receive webhook (ON_SUCCESS)." -ForegroundColor Yellow
Write-Host "DONE ✅" -ForegroundColor Green
