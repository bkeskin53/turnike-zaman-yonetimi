# tools/integration-suite/60-callback-test-shift-templates.ps1
# Callback/Webhook testi: shift-templates/upsert
# Receiver: http://localhost:8088

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [string]$CallbackUrl = "http://localhost:8088/webhook",
  [string]$CallbackSecret = "demo_webhook_secret_change_me",
  [string]$CallbackMode = "ON_DONE",   # ON_DONE | ON_SUCCESS
  [int]$DryRun = 0,
  [int]$VerboseHttp = 1
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Callback Test (Shift Templates Upsert)"
Write-Host "CallbackUrl: $CallbackUrl" -ForegroundColor Cyan
Write-Host "CallbackMode: $CallbackMode" -ForegroundColor Cyan
Write-Host "DryRun: $DryRun (DryRun=1 ise callback atilmaz)" -ForegroundColor Yellow

$batchRef = "CB-SHIFT-TPL-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# Overnight signature guard: +1
$templates = @(
  @{
    signature  = "0900-1800"
    startTime  = "09:00"
    endTime    = "18:00"
  },
  @{
    signature  = "1800-0300+1"
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
    mode   = $CallbackMode
  }
}

$res = Invoke-IntegrationPost "/api/integration/v1/shift-templates/upsert" $body
Write-Host (To-PrettyJson $res 60) -ForegroundColor Gray

Write-Host ""
Write-Host "Now check webhook-receiver terminal for an incoming POST." -ForegroundColor Green
Write-Host "DONE ✅" -ForegroundColor Green
