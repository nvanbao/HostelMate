@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Thao tac nay se xoa phong, nguoi thue, hoa don, sua chua va giao dich.
set /p confirm=Nhap RESET de tiep tuc: 
if /I not "%confirm%"=="RESET" exit /b 0
call npm run reset-db
pause
