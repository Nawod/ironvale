@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 from https://nodejs.org before starting Ironvale.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)
echo Starting Ironvale. Keep this window open. Press Ctrl+C to stop.
powershell -NoProfile -Command "Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 3; Start-Process http://localhost:5180'"
call npx vite preview --port 5180 --strictPort --host 127.0.0.1
if errorlevel 1 pause
