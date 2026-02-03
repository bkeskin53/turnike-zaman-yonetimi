# tools/integration-suite/30-shift-assignments-upsert.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0,
  [string]$WeekStartDate = ""   # opsiyonel override (YYYY-MM-DD)
)

. "$PSScriptRoot/00-config.ps1" -BaseUrl $BaseUrl -ApiKey $ApiKey -SourceSystem $SourceSystem -DryRun $DryRun -VerboseHttp $VerboseHttp

Write-Step "Shift Assignments Upsert"

$state = Load-LastRun
if ($null -eq $state) { throw "Missing state. Run 10-employees-upsert.ps1 and 20-shift-templates-upsert.ps1 first." }
if ($null -eq $state.employees -or $state.employees.Count -lt 1) { throw "State has no employees. Run 10-employees-upsert.ps1 first." }

$batchRef = "SHIFT-ASG-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# WeekStartDate: boşsa bu haftanın Pazartesi'si (local)
if ([string]::IsNullOrWhiteSpace($WeekStartDate)) {
  $today = Get-Date
  $dayOfWeek = [int]$today.DayOfWeek  # Sunday=0
  if ($dayOfWeek -eq 0) { $offset = -6 } else { $offset = 1 - $dayOfWeek }
  $monday = $today.AddDays($offset)
  $WeekStartDate = $monday.ToString("yyyy-MM-dd")
}

$employeeCode = $state.employees[0].employeeCode

$plans = @(
  @{
    externalRef = "PLAN-EXT-001"
    employeeCode = $employeeCode
    weekStartDate = $WeekStartDate
    defaultShiftTemplateSignature = "0900-1800"
    days = @{
      mon = @{ shiftTemplateSignature = "0900-1800" }
      tue = @{ startMinute = 9*60; endMinute = 18*60 }
    }
  }
)

$body = @{
  sourceSystem = $SourceSystem
  batchRef     = $batchRef
  plans        = $plans
}

$res = Invoke-IntegrationPost "/api/integration/v1/shift-assignments/upsert" $body
Assert-HasResultsOrOk $res "shift assignments upsert response"
Write-Host (To-PrettyJson $res 50) -ForegroundColor Gray

# state yaz
Set-ObjProp $state "batchRefShiftAssignments" $batchRef
Set-ObjProp $state "weekStartDate" $WeekStartDate
Set-ObjProp $state "shiftAssignments" @(
  @{ externalRef = "PLAN-EXT-001"; employeeCode = $employeeCode; weekStartDate = $WeekStartDate }
)

$file = Save-LastRun $state
Write-Host "Saved state -> $file" -ForegroundColor DarkGreen
Write-Host "DONE ✅" -ForegroundColor Green
