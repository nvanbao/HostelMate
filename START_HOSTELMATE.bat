@echo off
chcp 65001 >nul
cd /d "%~dp0"
title HostelMate - Khoi dong he thong

echo ================================================
echo       HOSTELMATE - QUAN LY PHONG TRO TICH HOP
echo ================================================

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Hay cai Node.js 20 LTS tro len.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] Dang cai thu vien giao dien...
  call npm install
  if errorlevel 1 goto :error
)

if not exist server\node_modules (
  echo [2/3] Dang cai thu vien may chu...
  pushd server
  call npm install
  if errorlevel 1 (popd & goto :error)
  popd
)

echo [3/3] Khoi dong Web va API...
echo Truy cap: http://localhost:5173
echo Tai khoan Admin: admin / 123456
echo.
call npm run dev:all
goto :eof

:error
echo.
echo [LOI] Cai dat hoac khoi dong that bai. Kiem tra thong bao phia tren.
pause
exit /b 1
