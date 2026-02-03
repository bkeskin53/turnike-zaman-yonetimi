# tools/integration-suite/20-shift-templates-upsert.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Shift Templates Upsert"

$batchRef = "SHIFT-TPL-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# IMPORTANT:
# Overnight shift (18:00 -> 03:00) derived signature = "1800-0300+1"
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
}

$res = Invoke-IntegrationPost "/api/integration/v1/shift-templates/upsert" $body
Assert-HasResultsOrOk $res "shift templates upsert response"

Write-Host (To-PrettyJson $res 50) -ForegroundColor Gray

# state'e merge (PSCustomObject güvenli set)
$state = Load-LastRun
if ($null -eq $state) {
  $state = New-Object PSCustomObject
  Set-ObjProp $state "sourceSystem" $SourceSystem
}

Set-ObjProp $state "batchRefShiftTemplates" $batchRef
Set-ObjProp $state "shiftTemplates" @(
  @{ signature = "0900-1800"; startTime = "09:00"; endTime = "18:00" },
  @{ signature = "1800-0300+1"; startTime = "18:00"; endTime = "03:00" }
)

$file = Save-LastRun $state
Write-Host "Saved state -> $file" -ForegroundColor DarkGreen
Write-Host "DONE ✅" -ForegroundColor Green
