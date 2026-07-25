@echo off
setlocal
title Logic Runner - Local Mode
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed yet.
  echo Download the LTS version from: https://nodejs.org/
  echo Install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing the game packages. This only needs to happen once...
  call npm ci
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Logic Runner at http://localhost:3000
echo Keep this black window open while playing.
echo Press Ctrl+C in this window when you want to stop the local server.
echo.
start "" "http://localhost:3000"
call npm run dev

endlocal
