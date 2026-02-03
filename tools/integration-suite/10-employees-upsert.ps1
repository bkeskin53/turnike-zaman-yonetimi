# tools/integration-suite/10-employees-upsert.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Employees Upsert"

$batchRef = "EMP-UPSERT-" + (Get-Date -Format "yyyyMMdd-HHmmss")

$employees = @(
  @{
    externalRef  = "EMP-EXT-001"
    employeeCode = "E001"
    firstName    = "Ali"
    lastName     = "Veli"
    email        = "ali.veli@local"
    isActive     = $true
    cardNo       = "CARD-0001"
    deviceUserId = "DEV-0001"
  },
  @{
    externalRef  = "EMP-EXT-002"
    employeeCode = "E002"
    firstName    = "Ayse"
    lastName     = "Yilmaz"
    email        = "ayse.yilmaz@local"
    isActive     = $true
    cardNo       = "CARD-0002"
    deviceUserId = "DEV-0002"
  }
)

$body = @{
  sourceSystem = $SourceSystem
  batchRef     = $batchRef
  employees    = $employees
}

$res = Invoke-IntegrationPost "/api/integration/v1/employees/upsert" $body
Assert-HasResultsOrOk $res "employees upsert response"
Write-Host (To-PrettyJson $res 50) -ForegroundColor Gray

# state yaz (her zaman Set-ObjProp)
$state = Load-LastRun
if ($null -eq $state) {
  $state = New-Object PSCustomObject
}

Set-ObjProp $state "sourceSystem" $SourceSystem
Set-ObjProp $state "batchRefEmployees" $batchRef
Set-ObjProp $state "employees" @(
  @{ externalRef = "EMP-EXT-001"; employeeCode = "E001" },
  @{ externalRef = "EMP-EXT-002"; employeeCode = "E002" }
)

$file = Save-LastRun $state
Write-Host "Saved state -> $file" -ForegroundColor DarkGreen
Write-Host "DONE ✅" -ForegroundColor Green
