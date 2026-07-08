#Requires -Version 5.1
<#
.SYNOPSIS
    Runs the Cliff Access Playwright runbook against the published Frank Create app.
.DESCRIPTION
    Thin wrapper around scripts\cliff_access_playwright.py. Sets defaults, runs the
    script, and opens the Markdown report when finished.
#>
param(
    [string]$Url = "https://frank-create.lovable.app",
    [string]$Email = $env:CLIFF_QA_EMAIL,
    [string]$StorageState = "user\frank_create\qa\state.json",
    [string]$DenyStorageState = "user\frank_create\qa\state-deny.json",
    [switch]$Headed
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:CLIFF_QA_URL = $Url
if ($Email) { $env:CLIFF_QA_EMAIL = $Email }
if (Test-Path $StorageState) { $env:CLIFF_QA_STORAGE_STATE = (Resolve-Path $StorageState).Path }
if (Test-Path $DenyStorageState) { $env:CLIFF_QA_DENY_STORAGE_STATE = (Resolve-Path $DenyStorageState).Path }
if ($Headed) { $env:CLIFF_QA_HEADLESS = "0" } else { $env:CLIFF_QA_HEADLESS = "1" }

Write-Host "Running Cliff Access runbook against $Url ..." -ForegroundColor Cyan
python scripts\cliff_access_playwright.py
$exit = $LASTEXITCODE

$latestMd = Get-ChildItem "user\frank_create\qa\cliff-access-report-*.md" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestMd) {
    Write-Host "Opening $($latestMd.FullName)" -ForegroundColor Green
    Start-Process $latestMd.FullName
}

if ($exit -eq 0) {
    Write-Host "READY — safe to grant Cliff access." -ForegroundColor Green
} else {
    Write-Host "BLOCKED — review the report before granting Cliff access." -ForegroundColor Yellow
}
exit $exit
