param (
    [switch]$Reinstall
)

$ErrorActionPreference = "Stop"

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    $adb = "adb"
}

if ($Reinstall -and (Test-Path $adb)) {
    Write-Host "Uninstalling existing debug build from Android device..." -ForegroundColor Yellow
    & $adb uninstall com.tauri.dev.debug | Out-Null
}

try {
    Write-Host "Setting up ADB reverse port forwarding for Vite (5173) and Backend (8000)..." -ForegroundColor Cyan
    & $adb reverse tcp:5173 tcp:5173 2>$null
    & $adb reverse tcp:8000 tcp:8000 2>$null
} catch {}

try {
    $lanIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4Address.IPAddress
    if ($lanIp) {
        $env:VITE_BACKEND_URL = "http://${lanIp}:8000"
        Write-Host "Configured VITE_BACKEND_URL=$env:VITE_BACKEND_URL for Android dev server." -ForegroundColor Cyan
    }
} catch {
    Write-Host "Could not auto-detect LAN IP for VITE_BACKEND_URL." -ForegroundColor Yellow
}

Write-Host "Starting Tauri Android Dev Server..." -ForegroundColor Green
npx @tauri-apps/cli android dev
