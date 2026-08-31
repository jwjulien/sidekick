$ErrorActionPreference = "Stop"

Write-Host "Starting Tauri Dev Server (which automatically starts the Vite client)..." -ForegroundColor Green
# Running Tauri via npx since there's no package.json in the root directory
npx @tauri-apps/cli dev
