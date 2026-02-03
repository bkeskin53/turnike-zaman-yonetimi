$ErrorActionPreference = "Stop"

function New-IntegrationHeaders([string]$ApiKey) {
  if (-not $ApiKey) { throw "INTEGRATION_API_KEY_REQUIRED" }
  return @{
    "x-integration-api-key" = $ApiKey
    "Content-Type" = "application/json"
  }
}

function Invoke-IntegrationPost([string]$Url, [hashtable]$Headers, [string]$BodyJson) {
  try {
    return Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -Body $BodyJson
  } catch {
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      $reader.Close()
      Write-Host "HTTP ERROR BODY:" -ForegroundColor Red
      Write-Host $text -ForegroundColor Red
    } else {
      Write-Host $_ -ForegroundColor Red
    }
    throw
  }
}

function Summarize-Results($results) {
  $created = ($results | Where-Object { $_.status -eq "CREATED" }).Count
  $updated = ($results | Where-Object { $_.status -eq "UPDATED" }).Count
  $unch    = ($results | Where-Object { $_.status -eq "UNCHANGED" }).Count
  $failed  = ($results | Where-Object { $_.status -eq "FAILED" }).Count
  return @{ created = $created; updated = $updated; unchanged = $unch; failed = $failed }
}

function Assert-ISODate([string]$v) {
  if ($v -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "INVALID_ISO_DATE: $v" }
}

function New-ShiftAssignmentsBatchBody(
  [string]$SourceSystem,
  [string]$BatchRef,
  [string]$WeekStartDate,
  [string[]]$EmployeeCodes,
  [string]$Mode,
  [string]$ShiftSignature
) {
  Assert-ISODate $WeekStartDate
  if (-not $SourceSystem) { throw "sourceSystem is required" }
  if (-not $BatchRef) { throw "batchRef is required" }
  if (-not $EmployeeCodes -or $EmployeeCodes.Count -lt 1) { throw "employeeCodes must be a non-empty array" }
  if (-not $Mode) { throw "mode is required (WEEK_TEMPLATE or DAY_OVERRIDE)" }

  $modeUpper = $Mode.ToUpperInvariant()
  if ($modeUpper -ne "WEEK_TEMPLATE" -and $modeUpper -ne "DAY_OVERRIDE") {
    throw "INVALID_MODE: $Mode (expected WEEK_TEMPLATE or DAY_OVERRIDE)"
  }

  if ($modeUpper -eq "WEEK_TEMPLATE" -and (-not $ShiftSignature)) {
    throw "WEEK_TEMPLATE_REQUIRES_defaultShiftTemplateSignature"
  }

  $plans = @()
  foreach ($code in $EmployeeCodes) {
    if (-not $code) { continue }

    if ($modeUpper -eq "WEEK_TEMPLATE") {
      $plans += @{
        externalRef = "PLAN-$WeekStartDate-$code"
        employeeCode = $code
        weekStartDate = $WeekStartDate
        defaultShiftTemplateSignature = $ShiftSignature
      }
    } else {
      # DAY_OVERRIDE (bilinçli olarak week template'e dokunmadan day-level set eder)
      $plans += @{
        externalRef = "PLAN-DAY-$WeekStartDate-$code"
        employeeCode = $code
        weekStartDate = $WeekStartDate
        days = @{
          mon = @{ shiftTemplateSignature = $ShiftSignature }
        }
      }
    }
  }

  return @{
    sourceSystem = $SourceSystem
    batchRef = $BatchRef
    plans = $plans
  }
}
