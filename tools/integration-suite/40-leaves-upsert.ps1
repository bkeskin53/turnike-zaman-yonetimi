# tools/integration-suite/40-leaves-upsert.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Leaves Upsert"

$state = Load-LastRun
if ($null -eq $state) { throw "Missing state. Run previous scripts first." }
if ($null -eq $state.employees -or $state.employees.Count -lt 1) { throw "State has no employees. Run 10-employees-upsert.ps1 first." }

$batchRef = "LEAVE-" + (Get-Date -Format "yyyyMMdd-HHmmss")

$d1 = (Get-Date).ToString("yyyy-MM-dd")
$d2 = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

$employeeCode = $state.employees[0].employeeCode

$leaves = @(
  @{
    externalRef = "LEAVE-EXT-001"
    employeeCode = $employeeCode
    dateFrom = $d1
    dateTo   = $d2
    type     = "ANNUAL"
    note     = "Integration suite test leave"
  }
)

$body = @{
  sourceSystem = $SourceSystem
  batchRef     = $batchRef
  leaves       = $leaves
}

$res = Invoke-IntegrationPost "/api/integration/v1/leaves/upsert" $body
Assert-HasResultsOrOk $res "leaves upsert response"
Write-Host (To-PrettyJson $res 50) -ForegroundColor Gray

# state yaz
Set-ObjProp $state "batchRefLeaves" $batchRef
Set-ObjProp $state "leaves" @(
  @{ externalRef = "LEAVE-EXT-001"; employeeCode = $employeeCode; dateFrom = $d1; dateTo = $d2; type = "ANNUAL" }
)

$file = Save-LastRun $state
Write-Host "Saved state -> $file" -ForegroundColor DarkGreen
Write-Host "DONE ✅" -ForegroundColor Green
