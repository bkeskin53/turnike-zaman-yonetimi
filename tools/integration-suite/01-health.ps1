# tools/integration-suite/01-health.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Integration Health"

$res = Invoke-IntegrationGet "/api/integration/v1/health"
Write-Host (To-PrettyJson $res 30) -ForegroundColor Gray

if ($res.ok -ne $true) {
  throw "Health check failed"
}

Write-Host "OK ✅" -ForegroundColor Green
