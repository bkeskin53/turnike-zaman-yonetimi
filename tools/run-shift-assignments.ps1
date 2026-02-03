param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey  = "demo_integration_key_change_me",
  [string]$WeekStartDate = "2026-02-02",
  [string]$Mode = "WEEK_TEMPLATE", # WEEK_TEMPLATE | DAY_OVERRIDE
  [string]$ShiftSignature = "0900-1700",
  [string]$SourceSystem = "SAP",
  [string]$BatchRef = "",
  [string[]]$EmployeeCodes = @("E002","E003","E004","E005","E006","E007","E008","E009","E010")
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/_lib/integration.ps1"

if (-not $BatchRef) {
  $BatchRef = "TOOLS-$Mode-$WeekStartDate"
}

Write-Host "== Tools Shift Assignments Runner ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Mode: $Mode"
Write-Host "WeekStartDate: $WeekStartDate"
Write-Host "ShiftSignature: $ShiftSignature"
Write-Host "Employees: $($EmployeeCodes -join ', ')"
Write-Host ""

$headers = New-IntegrationHeaders $ApiKey
$bodyObj = New-ShiftAssignmentsBatchBody -SourceSystem $SourceSystem -BatchRef $BatchRef -WeekStartDate $WeekStartDate -EmployeeCodes $EmployeeCodes -Mode $Mode -ShiftSignature $ShiftSignature
$bodyJson = $bodyObj | ConvertTo-Json -Depth 20

Write-Host "--- Request JSON ---" -ForegroundColor Yellow
Write-Host $bodyJson
Write-Host "--------------------"
Write-Host ""

$dryUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert?dryRun=1"
Write-Host "== 1) DryRun POST $dryUrl ==" -ForegroundColor Cyan
$dry = Invoke-IntegrationPost -Url $dryUrl -Headers $headers -BodyJson $bodyJson
$dry | ConvertTo-Json -Depth 20

Write-Host ""
Write-Host "DryRun summary: willCreate=$($dry.dryRunSummary.willCreate) willUpdate=$($dry.dryRunSummary.willUpdate) willUnchanged=$($dry.dryRunSummary.willUnchanged) willFailed=$($dry.dryRunSummary.willFailed)" -ForegroundColor Cyan

$realUrl = "$BaseUrl/api/integration/v1/shift-assignments/upsert"
Write-Host ""
Write-Host "== 2) Real POST $realUrl ==" -ForegroundColor Cyan
$real = Invoke-IntegrationPost -Url $realUrl -Headers $headers -BodyJson $bodyJson
$real | ConvertTo-Json -Depth 20

$sum = Summarize-Results $real.results
Write-Host ""
Write-Host ("RESULT: CREATED={0} UPDATED={1} UNCHANGED={2} FAILED={3}" -f $sum.created, $sum.updated, $sum.unchanged, $sum.failed) -ForegroundColor Green
Write-Host "DONE. UI: /shift-assignments -> Mevcut Week kolonunu kontrol et." -ForegroundColor Green
