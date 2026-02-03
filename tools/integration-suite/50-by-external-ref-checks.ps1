# tools/integration-suite/50-by-external-ref-checks.ps1
# GET by-external-ref doğrulama:
# - shift-assignments/by-external-ref
# - leaves/by-external-ref

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "By External Ref Checks"

$state = Load-LastRun
if ($null -eq $state) {
  throw "Missing state. Run previous scripts first."
}

# Shift Assignment by externalRef
if ($null -ne $state.shiftAssignments -and $state.shiftAssignments.Count -gt 0) {
  $as = $state.shiftAssignments[0]
  $externalRef = $as.externalRef

  Write-Host ""
  Write-Host "Check Shift Assignment by externalRef: $externalRef" -ForegroundColor Cyan

  $q = "/api/integration/v1/shift-assignments/by-external-ref?sourceSystem=$($state.sourceSystem)&externalRef=$externalRef"
  $res1 = Invoke-IntegrationGet $q
  Write-Host (To-PrettyJson $res1 50) -ForegroundColor Gray
} else {
  Write-Host "No shiftAssignments found in state." -ForegroundColor Yellow
}

# Leave by externalRef
if ($null -ne $state.leaves -and $state.leaves.Count -gt 0) {
  $lv = $state.leaves[0]
  $externalRef = $lv.externalRef

  Write-Host ""
  Write-Host "Check Leave by externalRef: $externalRef" -ForegroundColor Cyan

  $q2 = "/api/integration/v1/leaves/by-external-ref?sourceSystem=$($state.sourceSystem)&externalRef=$externalRef"
  $res2 = Invoke-IntegrationGet $q2
  Write-Host (To-PrettyJson $res2 50) -ForegroundColor Gray
} else {
  Write-Host "No leaves found in state." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "DONE ✅" -ForegroundColor Green
