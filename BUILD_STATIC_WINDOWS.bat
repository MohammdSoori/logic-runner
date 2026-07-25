@echo off
setlocal
title Logic Runner - Build Static Site
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
  echo Installing the build packages. This only needs to happen once...
  call npm ci
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Building the upload-ready static website...
call npm run build
if errorlevel 1 (
  echo.
  echo The build failed. Read the error above, then try again.
  pause
  exit /b 1
)

echo.
echo Finished. Upload everything INSIDE the "out" folder to your web host.
start "" "%CD%\out"
pause

endlocal
