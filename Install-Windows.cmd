@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Windows.ps1"
set "install_result=%ERRORLEVEL%"
if not "%install_result%"=="0" echo Installation failed. See the message above.
pause
exit /b %install_result%
