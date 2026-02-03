# tools/integration-suite/00-config.ps1
# Ortak config + helper fonksiyonlar
# NOT: param bloğu dosyanın en başında olmalı (PowerShell kuralı)

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = $env:INTEGRATION_API_KEY,
  [string]$SourceSystem = "SAP",
  [int]$DryRun = 0,
  [int]$VerboseHttp = 0
)

$ErrorActionPreference = "Stop"

function Assert-NotEmpty([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required config: $name"
  }
}

Assert-NotEmpty "BaseUrl" $BaseUrl
Assert-NotEmpty "ApiKey (env: INTEGRATION_API_KEY or -ApiKey)" $ApiKey
Assert-NotEmpty "SourceSystem" $SourceSystem

function New-RequestId() {
  try {
    return ([guid]::NewGuid().ToString("N")).Substring(0, 16)
  } catch {
    return ("req-" + [DateTime]::UtcNow.Ticks)
  }
}

function To-PrettyJson($obj, [int]$depth = 12) {
  return ($obj | ConvertTo-Json -Depth $depth)
}

function Read-ErrorResponseBody($_err) {
  $resp = $_err.Exception.Response
  if ($resp -eq $null) { return $null }
  try {
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    $reader.Close()
    return $text
  } catch {
    return $null
  }
}

function Invoke-IntegrationGet([string]$pathWithQuery) {
  $url = "$BaseUrl$pathWithQuery"
  $headers = @{
    "x-integration-api-key" = $ApiKey
    "Accept" = "application/json"
  }
  if ($VerboseHttp -eq 1) {
    Write-Host "GET $url" -ForegroundColor DarkCyan
  }
  try {
    return Invoke-RestMethod -Method Get -Uri $url -Headers $headers
  } catch {
    Write-Host "HTTP ERROR (GET) $url" -ForegroundColor Red
    $body = Read-ErrorResponseBody $_
    if ($body) { Write-Host $body -ForegroundColor Red }
    throw
  }
}

function Invoke-IntegrationPost([string]$path, $bodyObj) {
  $requestId = New-RequestId
  $qs = ""
  if ($DryRun -eq 1) { $qs = "?dryRun=1" }
  $url = "$BaseUrl$path$qs"

  $headers = @{
    "x-integration-api-key" = $ApiKey
    "Content-Type" = "application/json"
    "Accept" = "application/json"
    "x-request-id" = $requestId
  }

  $json = $bodyObj | ConvertTo-Json -Depth 30

  if ($VerboseHttp -eq 1) {
    Write-Host "POST $url" -ForegroundColor DarkCyan
    Write-Host "--- Request JSON ---" -ForegroundColor Yellow
    Write-Host $json
    Write-Host "--------------------" -ForegroundColor Yellow
  }

  try {
    $res = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $json
    if ($VerboseHttp -eq 1) {
      Write-Host "--- Response JSON ---" -ForegroundColor Green
      Write-Host (To-PrettyJson $res 30)
      Write-Host "---------------------" -ForegroundColor Green
    }
    return $res
  } catch {
    Write-Host "HTTP ERROR (POST) $url" -ForegroundColor Red
    $body = Read-ErrorResponseBody $_
    if ($body) { Write-Host $body -ForegroundColor Red }
    throw
  }
}

function Write-Step([string]$title) {
  Write-Host ""
  Write-Host $title -ForegroundColor Cyan
  Write-Host ("=" * ($title.Length)) -ForegroundColor Cyan
}

function Save-LastRun($obj) {
  $dir = Join-Path $PSScriptRoot ".state"
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $file = Join-Path $dir "last-run.json"
  ($obj | ConvertTo-Json -Depth 80) | Set-Content -Path $file -Encoding UTF8
  return $file
}

function Load-LastRun() {
  $file = Join-Path (Join-Path $PSScriptRoot ".state") "last-run.json"
  if (!(Test-Path $file)) { return $null }
  try {
    $text = Get-Content -Path $file -Raw -Encoding UTF8
    return $text | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Assert-HasResultsOrOk($res, [string]$label = "response") {
  if ($null -eq $res) { throw "Missing $label" }
  if ($null -ne $res.results) { return }
  if ($null -ne $res.ok) { return }
  throw "Unexpected $label shape. Expected 'results' or 'ok'."
}

function Set-ObjProp($obj, [string]$name, $value) {
  if ($null -eq $obj) { throw "Set-ObjProp: obj is null" }
  # PSCustomObject için güvenli property set
  try {
    $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force | Out-Null
    return
  } catch {
    # fallback: direct set dene
    $obj.$name = $value
  }
}
