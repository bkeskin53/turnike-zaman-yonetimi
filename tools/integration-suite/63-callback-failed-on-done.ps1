# tools/integration-suite/63-callback-failed-on-done.ps1
# Amaç: ON_DONE modunda FAILED olsa bile webhook atılmalı.

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

Write-Step "Callback Test: ON_DONE + FAILED should webhook"
Write-Host "Receiver SHOULD log a webhook for this request." -ForegroundColor Yellow
Write-Host "CallbackUrl: $CallbackUrl" -ForegroundColor Cyan

$batchRef = "CB-FAIL-ONDONE-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# KASITLI HATA (aynı):
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
    mode   = "ON_DONE"
  }
}

$res = Invoke-IntegrationPost "/api/integration/v1/shift-templates/upsert" $body
Write-Host (To-PrettyJson $res 60) -ForegroundColor Gray

Write-Host ""
Write-Host "Expected: API response has FAILED item(s)." -ForegroundColor Yellow
Write-Host "Expected: Receiver SHOULD receive webhook with status FAILED/PARTIAL." -ForegroundColor Yellow
Write-Host "DONE ✅" -ForegroundColor Green
