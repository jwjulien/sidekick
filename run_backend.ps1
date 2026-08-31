param (
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Write-Host "Starting FastAPI Backend Server on ${HostAddress}:${Port}..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\server"
poetry run uvicorn app.main:app --host $HostAddress --port $Port --reload
