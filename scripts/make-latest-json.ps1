<#
.SYNOPSIS
    Builds the updater manifest (latest.json) for a GitHub Release.

.DESCRIPTION
    Reads the signed updater artifacts (*-setup.exe + *-setup.exe.sig) produced
    by "npm run tauri:build" (requires TAURI_SIGNING_PRIVATE_KEY) and writes
    latest.json next to the NSIS installer, ready to upload as Release assets
    together with the installer.

.EXAMPLE
    .\scripts\make-latest-json.ps1 -Version 1.0.10 -Tag v1.0.10
#>
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Tag,
    [string]$Repo = "abdelben2025/goft3",
    [string]$BundleDir = "src-tauri\target\release\bundle\nsis"
)

$ErrorActionPreference = "Stop"

$exe = Get-ChildItem $BundleDir -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) { throw "No *-setup.exe found in $BundleDir. Run 'npm run tauri:build' with TAURI_SIGNING_PRIVATE_KEY set." }

$sigFile = "$($exe.FullName).sig"
if (-not (Test-Path $sigFile)) { throw "Signature file not found: $sigFile. Build with TAURI_SIGNING_PRIVATE_KEY set." }

$signature = (Get-Content $sigFile -Raw).Trim()
$url = "https://github.com/$Repo/releases/download/$Tag/$([uri]::EscapeDataString($exe.Name))"
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$manifest = [ordered]@{
    version  = $Version
    pub_date = $pubDate
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            url       = $url
            signature = $signature
            pub_date  = $pubDate
        }
    }
}

$out = Join-Path $exe.DirectoryName "latest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $out -Encoding UTF8

Write-Host ""
Write-Host "Manifest written: $out" -ForegroundColor Green
Write-Host "Release asset URL: $url"
Write-Host ""
Write-Host "Upload BOTH of these to GitHub Release '$Tag':" -ForegroundColor Yellow
Write-Host "  1. $($exe.Name)"
Write-Host "  2. latest.json"
Write-Host ""
Write-Host "The app endpoint checks: https://github.com/$Repo/releases/latest/download/latest.json"
Write-Host "NOTE: the repository must be PUBLIC for anonymous download."
